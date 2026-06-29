-- =============================================================================
-- Migration: CBN Invoice Synchronization RPCs
-- =============================================================================
-- send_cbn_invoice(invoice_id, connection_id)
--   Supplier pushes a posted invoice to a connected buyer.
--   1. Lock invoice; verify it belongs to caller's org and is 'posted'
--   2. Validate accepted connection + cbn.sync permission
--   3. Verify 'receive_invoices' is in caller's grants (what caller grants to counterparty)
--   4. Verify invoice not already sent on this connection
--   5. Insert cbn_invoices record
--   6. Share document record
--   7. Log CBN event
--   Returns: cbn_invoice_id UUID
--
-- accept_cbn_invoice(cbn_invoice_id, buyer_org_id, notes)
--   Buyer approves the synced invoice.
--   Attempts to find a matching supplier in the buyer's system (by GST number).
--   If a supplier is found: creates a draft purchase invoice.
--   If no supplier: raises a clear error asking the buyer to add the org as a supplier first.
--   Returns: buyer_purchase_invoice_id UUID
--
-- reject_cbn_invoice(cbn_invoice_id, reason)
--   Buyer rejects the synced invoice.
--   Returns: void
-- =============================================================================

-- ── send_cbn_invoice ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_cbn_invoice(
  p_invoice_id    UUID,
  p_connection_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_invoice      RECORD;
  v_conn         RECORD;
  v_my_org       UUID;
  v_buyer_org    UUID;
  v_caller_grants TEXT[];
  v_cbn_inv_id   UUID;
BEGIN
  -- 1. Load and lock the source invoice
  SELECT organization_id, invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status
    INTO v_invoice
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'not_found: invoice';
  END IF;
  IF v_invoice.status <> 'posted' THEN
    RAISE EXCEPTION 'invalid_status: only posted invoices can be sent via CBN (current: %)', v_invoice.status;
  END IF;

  -- 2. Validate caller is member of the invoice's org
  IF NOT public.is_org_member(v_invoice.organization_id) THEN
    RAISE EXCEPTION 'permission_denied: invoice does not belong to your organization';
  END IF;

  -- 3. cbn.sync permission
  IF NOT public.has_permission(v_invoice.organization_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 4. Load and validate connection
  SELECT requester_organization_id, recipient_organization_id,
         status, requester_grants, recipient_grants
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;
  IF v_conn.status <> 'accepted' THEN
    RAISE EXCEPTION 'invalid_status: connection is not accepted (current: %)', v_conn.status;
  END IF;

  -- 5. Determine caller's role in the connection
  IF v_invoice.organization_id = v_conn.requester_organization_id THEN
    v_my_org        := v_conn.requester_organization_id;
    v_buyer_org     := v_conn.recipient_organization_id;
    v_caller_grants := v_conn.requester_grants;
  ELSIF v_invoice.organization_id = v_conn.recipient_organization_id THEN
    v_my_org        := v_conn.recipient_organization_id;
    v_buyer_org     := v_conn.requester_organization_id;
    v_caller_grants := v_conn.recipient_grants;
  ELSE
    RAISE EXCEPTION 'permission_denied: invoice org is not a participant in this connection';
  END IF;

  -- 6. Verify 'receive_invoices' permission granted by this org
  IF NOT ('receive_invoices' = ANY(v_caller_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_invoices permission not granted in this connection';
  END IF;

  -- 7. Prevent duplicate sends
  IF EXISTS (
    SELECT 1 FROM public.cbn_invoices
     WHERE source_invoice_id = p_invoice_id
       AND connection_id = p_connection_id
       AND deleted_at IS NULL
       AND status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'duplicate: this invoice has already been sent on this connection';
  END IF;

  -- 8. Insert cbn_invoices record
  INSERT INTO public.cbn_invoices (
    organization_id,
    counterparty_organization_id,
    connection_id,
    source_invoice_id,
    invoice_number,
    invoice_date,
    due_date,
    subtotal,
    tax_amount,
    total_amount,
    currency,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_my_org,
    v_buyer_org,
    p_connection_id,
    p_invoice_id,
    v_invoice.invoice_number,
    v_invoice.invoice_date,
    v_invoice.due_date,
    COALESCE(v_invoice.subtotal, 0),
    COALESCE(v_invoice.tax_amount, 0),
    COALESCE(v_invoice.total_amount, 0),
    'INR',
    'pending',
    v_user,
    v_user
  )
  RETURNING id INTO v_cbn_inv_id;

  -- 9. Shared document record
  INSERT INTO public.cbn_shared_documents (
    organization_id,
    counterparty_organization_id,
    connection_id,
    document_type,
    document_reference_type,
    document_reference_id,
    document_number,
    document_date,
    amount,
    currency,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_my_org,
    v_buyer_org,
    p_connection_id,
    'tax_invoice',
    'cbn_invoice',
    v_cbn_inv_id,
    v_invoice.invoice_number,
    v_invoice.invoice_date,
    COALESCE(v_invoice.total_amount, 0),
    'INR',
    'active',
    v_user,
    v_user
  );

  -- 10. Update supplier's sent count
  UPDATE public.business_profiles
     SET total_invoices_sent = total_invoices_sent + 1, updated_by = v_user
   WHERE organization_id = v_my_org;

  -- 11. Log CBN event
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'invoice.sent',
    v_user, v_my_org, v_buyer_org,
    'cbn_invoice', v_cbn_inv_id,
    jsonb_build_object(
      'invoice_number', v_invoice.invoice_number,
      'total_amount',   v_invoice.total_amount
    ),
    'success'
  );

  RETURN v_cbn_inv_id;
END;
$$;

-- ── accept_cbn_invoice ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_cbn_invoice(
  p_cbn_invoice_id UUID,
  p_buyer_org_id   UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_cbn           RECORD;
  v_conn          RECORD;
  v_supplier_gst  TEXT;
  v_supplier_id   UUID;
  v_pi_id         UUID;
  v_pi_num        TEXT;
  v_grants        TEXT[];
BEGIN
  -- 1. Load and lock the CBN invoice
  SELECT organization_id, counterparty_organization_id, connection_id,
         invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status
    INTO v_cbn
    FROM public.cbn_invoices
   WHERE id = p_cbn_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn invoice';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn invoice is not pending (current: %)', v_cbn.status;
  END IF;

  -- 2. Caller must be member of the BUYER org (counterparty)
  IF v_cbn.counterparty_organization_id <> p_buyer_org_id THEN
    RAISE EXCEPTION 'validation: buyer org does not match the cbn invoice counterparty';
  END IF;
  IF NOT public.is_org_member(p_buyer_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the buyer organization';
  END IF;
  IF NOT public.has_permission(p_buyer_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 3. Validate connection + permission
  SELECT requester_organization_id, recipient_organization_id,
         requester_grants, recipient_grants
    INTO v_conn
    FROM public.business_connections
   WHERE id = v_cbn.connection_id AND deleted_at IS NULL;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;

  v_grants := CASE
    WHEN p_buyer_org_id = v_conn.requester_organization_id THEN v_conn.requester_grants
    ELSE v_conn.recipient_grants
  END;

  IF NOT ('receive_invoices' = ANY(v_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_invoices not in buyer grants';
  END IF;

  -- 4. Find matching supplier in buyer's system by supplier org GST number
  SELECT o.gst_number INTO v_supplier_gst
    FROM public.organizations o
   WHERE o.id = v_cbn.organization_id AND o.deleted_at IS NULL;

  IF v_supplier_gst IS NOT NULL THEN
    SELECT s.id INTO v_supplier_id
      FROM public.suppliers s
     WHERE s.organization_id = p_buyer_org_id
       AND s.gst_number = v_supplier_gst
       AND s.deleted_at IS NULL
       AND s.status = 'active'
     LIMIT 1;
  END IF;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'prerequisite: no matching supplier found in your system. Please add the connected business as a supplier before accepting their invoices.';
  END IF;

  -- 5. Generate purchase invoice number
  v_pi_num := 'SYNC-PI-' || v_cbn.invoice_number;

  -- 6. Insert draft purchase invoice in buyer's system
  INSERT INTO public.purchase_invoices (
    organization_id,
    invoice_number,
    invoice_date,
    due_date,
    supplier_id,
    subtotal,
    tax_amount,
    total_amount,
    status,
    notes,
    created_by,
    updated_by
  ) VALUES (
    p_buyer_org_id,
    v_pi_num,
    v_cbn.invoice_date,
    v_cbn.due_date,
    v_supplier_id,
    v_cbn.subtotal,
    v_cbn.tax_amount,
    v_cbn.total_amount,
    'draft',
    COALESCE(p_notes, 'Auto-created from CBN invoice sync: ' || v_cbn.invoice_number),
    v_user,
    v_user
  )
  RETURNING id INTO v_pi_id;

  -- 7. Mark cbn_invoice as accepted
  UPDATE public.cbn_invoices
     SET status                   = 'accepted',
         accepted_at              = NOW(),
         accepted_by              = v_user,
         buyer_purchase_invoice_id = v_pi_id,
         updated_by               = v_user
   WHERE id = p_cbn_invoice_id;

  -- 8. Update buyer's received count
  UPDATE public.business_profiles
     SET total_invoices_received = total_invoices_received + 1, updated_by = v_user
   WHERE organization_id = p_buyer_org_id;

  -- 9. Log CBN event
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_buyer_org_id, v_cbn.connection_id, 'invoice.accepted',
    v_user, p_buyer_org_id, v_cbn.organization_id,
    'cbn_invoice', p_cbn_invoice_id,
    jsonb_build_object(
      'invoice_number',            v_cbn.invoice_number,
      'buyer_purchase_invoice_id', v_pi_id
    ),
    'success'
  );

  RETURN v_pi_id;
END;
$$;

-- ── reject_cbn_invoice ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_cbn_invoice(
  p_cbn_invoice_id UUID,
  p_buyer_org_id   UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cbn  RECORD;
BEGIN
  SELECT organization_id, counterparty_organization_id, connection_id,
         invoice_number, status
    INTO v_cbn
    FROM public.cbn_invoices
   WHERE id = p_cbn_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn invoice';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn invoice is not pending (current: %)', v_cbn.status;
  END IF;
  IF v_cbn.counterparty_organization_id <> p_buyer_org_id THEN
    RAISE EXCEPTION 'permission_denied: not the recipient of this invoice';
  END IF;
  IF NOT public.is_org_member(p_buyer_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the buyer organization';
  END IF;
  IF NOT public.has_permission(p_buyer_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  UPDATE public.cbn_invoices
     SET status           = 'rejected',
         rejected_at      = NOW(),
         rejected_by      = v_user,
         rejection_reason = p_reason,
         updated_by       = v_user
   WHERE id = p_cbn_invoice_id;

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_buyer_org_id, v_cbn.connection_id, 'invoice.rejected',
    v_user, p_buyer_org_id, v_cbn.organization_id,
    'cbn_invoice', p_cbn_invoice_id,
    jsonb_build_object('reason', p_reason, 'invoice_number', v_cbn.invoice_number),
    'success'
  );
END;
$$;

COMMENT ON FUNCTION public.send_cbn_invoice IS
  'Atomic invoice push via CBN. Validates posted status, accepted connection, and sync permissions.';
COMMENT ON FUNCTION public.accept_cbn_invoice IS
  'Atomic invoice acceptance. Looks up matching supplier by GST and creates a draft purchase invoice.';
COMMENT ON FUNCTION public.reject_cbn_invoice IS
  'Atomic invoice rejection. Notifies supplier to initiate correction workflow.';
