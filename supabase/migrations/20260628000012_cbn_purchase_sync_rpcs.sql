-- =============================================================================
-- Migration: CBN Purchase Order Synchronization RPCs
-- =============================================================================
-- send_cbn_purchase_order(po_id, connection_id)
--   Buyer pushes an approved PO to a connected supplier.
--   1. Lock PO; verify approved or ordered status
--   2. Validate accepted connection + cbn.sync permission
--   3. Verify 'receive_purchase_orders' in caller's grants
--   4. Insert cbn_purchase_orders record + shared_document record
--   5. Log CBN event
--   Returns: cbn_po_id UUID
--
-- accept_cbn_purchase_order(cbn_po_id, supplier_org_id, notes)
--   Supplier accepts the PO.
--   Looks up the buyer in supplier's system (by GST) to get customer_id.
--   Creates a draft sales_orders record in the supplier's system.
--   Returns: supplier_sales_order_id UUID
--
-- reject_cbn_purchase_order(cbn_po_id, supplier_org_id, reason)
--   Returns: void
-- =============================================================================

-- ── send_cbn_purchase_order ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_cbn_purchase_order(
  p_po_id         UUID,
  p_connection_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_po            RECORD;
  v_conn          RECORD;
  v_my_org        UUID;
  v_supplier_org  UUID;
  v_caller_grants TEXT[];
  v_cbn_po_id     UUID;
BEGIN
  -- 1. Load and lock the PO
  -- Valid statuses for CBN sending: approved or ordered
  SELECT organization_id, po_number, order_date, expected_delivery_date,
         subtotal, tax_amount, total_amount, status
    INTO v_po
    FROM public.purchase_orders
   WHERE id = p_po_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_po IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase order';
  END IF;
  IF v_po.status NOT IN ('approved', 'ordered') THEN
    RAISE EXCEPTION 'invalid_status: only approved/ordered POs can be sent via CBN (current: %)', v_po.status;
  END IF;

  -- 2. Caller must be member of the PO's org
  IF NOT public.is_org_member(v_po.organization_id) THEN
    RAISE EXCEPTION 'permission_denied: purchase order does not belong to your organization';
  END IF;
  IF NOT public.has_permission(v_po.organization_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 3. Load and validate connection
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

  -- 4. Determine caller's role in the connection
  IF v_po.organization_id = v_conn.requester_organization_id THEN
    v_my_org        := v_conn.requester_organization_id;
    v_supplier_org  := v_conn.recipient_organization_id;
    v_caller_grants := v_conn.requester_grants;
  ELSIF v_po.organization_id = v_conn.recipient_organization_id THEN
    v_my_org        := v_conn.recipient_organization_id;
    v_supplier_org  := v_conn.requester_organization_id;
    v_caller_grants := v_conn.recipient_grants;
  ELSE
    RAISE EXCEPTION 'permission_denied: PO org is not a participant in this connection';
  END IF;

  -- 5. Verify 'receive_purchase_orders' permission
  IF NOT ('receive_purchase_orders' = ANY(v_caller_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_purchase_orders permission not granted in this connection';
  END IF;

  -- 6. Prevent duplicates
  IF EXISTS (
    SELECT 1 FROM public.cbn_purchase_orders
     WHERE source_purchase_order_id = p_po_id
       AND connection_id = p_connection_id
       AND deleted_at IS NULL
       AND status NOT IN ('rejected', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'duplicate: this purchase order has already been sent on this connection';
  END IF;

  -- 7. Insert cbn_purchase_orders record
  INSERT INTO public.cbn_purchase_orders (
    organization_id,
    counterparty_organization_id,
    connection_id,
    source_purchase_order_id,
    po_number,
    po_date,
    expected_delivery_date,
    subtotal,
    tax_amount,
    total_amount,
    currency,
    status,
    created_by,
    updated_by
  ) VALUES (
    v_my_org,
    v_supplier_org,
    p_connection_id,
    p_po_id,
    v_po.po_number,
    v_po.order_date,
    v_po.expected_delivery_date,
    COALESCE(v_po.subtotal, 0),
    COALESCE(v_po.tax_amount, 0),
    COALESCE(v_po.total_amount, 0),
    'INR',
    'pending',
    v_user,
    v_user
  )
  RETURNING id INTO v_cbn_po_id;

  -- 8. Shared document record
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
    v_supplier_org,
    p_connection_id,
    'purchase_order',
    'cbn_purchase_order',
    v_cbn_po_id,
    v_po.po_number,
    v_po.order_date,
    COALESCE(v_po.total_amount, 0),
    'INR',
    'active',
    v_user,
    v_user
  );

  -- 9. Update buyer's sent count
  UPDATE public.business_profiles
     SET total_pos_sent = total_pos_sent + 1, updated_by = v_user
   WHERE organization_id = v_my_org;

  -- 10. Log CBN event
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'purchase_order.sent',
    v_user, v_my_org, v_supplier_org,
    'cbn_purchase_order', v_cbn_po_id,
    jsonb_build_object(
      'po_number',    v_po.po_number,
      'total_amount', v_po.total_amount
    ),
    'success'
  );

  RETURN v_cbn_po_id;
END;
$$;

-- ── accept_cbn_purchase_order ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_cbn_purchase_order(
  p_cbn_po_id       UUID,
  p_supplier_org_id UUID,
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_cbn         RECORD;
  v_conn        RECORD;
  v_grants      TEXT[];
  v_buyer_gst   TEXT;
  v_customer_id UUID;
  v_so_id       UUID;
  v_so_num      TEXT;
BEGIN
  -- 1. Load and lock CBN PO
  SELECT organization_id, counterparty_organization_id, connection_id,
         po_number, po_date, expected_delivery_date, total_amount, status
    INTO v_cbn
    FROM public.cbn_purchase_orders
   WHERE id = p_cbn_po_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn purchase order';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn purchase order is not pending (current: %)', v_cbn.status;
  END IF;

  -- 2. Caller must be supplier (counterparty)
  IF v_cbn.counterparty_organization_id <> p_supplier_org_id THEN
    RAISE EXCEPTION 'validation: supplier org does not match the cbn po counterparty';
  END IF;
  IF NOT public.is_org_member(p_supplier_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the supplier organization';
  END IF;
  IF NOT public.has_permission(p_supplier_org_id, 'cbn.sync') THEN
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
    WHEN p_supplier_org_id = v_conn.requester_organization_id THEN v_conn.requester_grants
    ELSE v_conn.recipient_grants
  END;

  IF NOT ('receive_purchase_orders' = ANY(v_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_purchase_orders not in supplier grants';
  END IF;

  -- 4. Find matching customer in supplier's system by buyer org GST number
  SELECT o.gst_number INTO v_buyer_gst
    FROM public.organizations o
   WHERE o.id = v_cbn.organization_id AND o.deleted_at IS NULL;

  IF v_buyer_gst IS NOT NULL THEN
    SELECT c.id INTO v_customer_id
      FROM public.customers c
     WHERE c.organization_id = p_supplier_org_id
       AND c.gst_number = v_buyer_gst
       AND c.deleted_at IS NULL
       AND c.status = 'active'
     LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'prerequisite: no matching customer found in your system. Please add the connected business as a customer before accepting their purchase orders.';
  END IF;

  -- 5. Generate sales order number
  v_so_num := 'SYNC-SO-' || v_cbn.po_number;

  -- 6. Insert draft sales_order in supplier's system
  -- Note: sales_orders uses so_number (not order_number) and delivery_date (not expected_delivery_date)
  INSERT INTO public.sales_orders (
    organization_id,
    so_number,
    order_date,
    delivery_date,
    customer_id,
    total_amount,
    tax_amount,
    status,
    notes,
    created_by,
    updated_by
  ) VALUES (
    p_supplier_org_id,
    v_so_num,
    v_cbn.po_date,
    v_cbn.expected_delivery_date,
    v_customer_id,
    v_cbn.total_amount,
    0,
    'draft',
    COALESCE(p_notes, 'Auto-created from CBN purchase order sync: ' || v_cbn.po_number),
    v_user,
    v_user
  )
  RETURNING id INTO v_so_id;

  -- 7. Mark cbn_po as accepted
  UPDATE public.cbn_purchase_orders
     SET status                  = 'accepted',
         accepted_at             = NOW(),
         accepted_by             = v_user,
         supplier_sales_order_id = v_so_id,
         updated_by              = v_user
   WHERE id = p_cbn_po_id;

  -- 8. Update supplier's received count
  UPDATE public.business_profiles
     SET total_pos_received = total_pos_received + 1, updated_by = v_user
   WHERE organization_id = p_supplier_org_id;

  -- 9. Log CBN event
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_supplier_org_id, v_cbn.connection_id, 'purchase_order.accepted',
    v_user, p_supplier_org_id, v_cbn.organization_id,
    'cbn_purchase_order', p_cbn_po_id,
    jsonb_build_object(
      'po_number',               v_cbn.po_number,
      'supplier_sales_order_id', v_so_id
    ),
    'success'
  );

  RETURN v_so_id;
END;
$$;

-- ── reject_cbn_purchase_order ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_cbn_purchase_order(
  p_cbn_po_id       UUID,
  p_supplier_org_id UUID,
  p_reason          TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_cbn  RECORD;
BEGIN
  SELECT organization_id, counterparty_organization_id, connection_id,
         po_number, status
    INTO v_cbn
    FROM public.cbn_purchase_orders
   WHERE id = p_cbn_po_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn purchase order';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn purchase order is not pending (current: %)', v_cbn.status;
  END IF;
  IF v_cbn.counterparty_organization_id <> p_supplier_org_id THEN
    RAISE EXCEPTION 'permission_denied: not the recipient of this purchase order';
  END IF;
  IF NOT public.is_org_member(p_supplier_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the supplier organization';
  END IF;
  IF NOT public.has_permission(p_supplier_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  UPDATE public.cbn_purchase_orders
     SET status           = 'rejected',
         rejected_at      = NOW(),
         rejected_by      = v_user,
         rejection_reason = p_reason,
         updated_by       = v_user
   WHERE id = p_cbn_po_id;

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_supplier_org_id, v_cbn.connection_id, 'purchase_order.rejected',
    v_user, p_supplier_org_id, v_cbn.organization_id,
    'cbn_purchase_order', p_cbn_po_id,
    jsonb_build_object('reason', p_reason, 'po_number', v_cbn.po_number),
    'success'
  );
END;
$$;

COMMENT ON FUNCTION public.send_cbn_purchase_order IS
  'Atomic PO push via CBN. Validates approved/ordered status, accepted connection, and sync permissions.';
COMMENT ON FUNCTION public.accept_cbn_purchase_order IS
  'Atomic PO acceptance. Looks up matching customer by GST and creates a draft sales order.';
COMMENT ON FUNCTION public.reject_cbn_purchase_order IS
  'Atomic PO rejection. Notifies buyer to revise the purchase order.';
