-- =============================================================================
-- Migration: Bind CBN connections to a local customer / supplier record
-- =============================================================================
-- A connection is between two ORGANIZATIONS, but every document flow needs the
-- LOCAL party record: accepting an invoice must create a bill against one of
-- *your* suppliers, and sending an invoice must target one of *your* customers.
-- Until now nothing tied the two together, so accept_cbn_invoice fell back to
-- guessing by GST number and failed outright when it found no match:
--   "prerequisite: no matching supplier found in your system"
--
-- The link is now established when the connection is made, not inferred later:
--
--   * The requester declares what the counterparty is to them ("they are my
--     supplier") and picks the matching unlinked local record.
--   * The relationship is necessarily INVERSE on the other side — if they are
--     my supplier, I am their customer — so the accepter is required to pick a
--     record of the opposite type. That inversion is enforced here, in the DB,
--     not left to the UI.
--
-- `requester_counterparty_role` lives on business_connections because both
-- orgs must read it (the accepter needs to know which type to pick), and the
-- per-org links live on customers/suppliers because those rows are org-scoped.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Role column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.business_connections
  ADD COLUMN IF NOT EXISTS requester_counterparty_role TEXT
    CHECK (requester_counterparty_role IN ('customer', 'supplier'));

COMMENT ON COLUMN public.business_connections.requester_counterparty_role IS
  'What the counterparty is TO THE REQUESTER: customer or supplier. The recipient''s role is always the inverse. Null on connections created before party linking existed.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. request_business_connection — declare role + link the local record
-- ─────────────────────────────────────────────────────────────────────────────
-- Dropped rather than replaced: the parameter list changes, which CREATE OR
-- REPLACE cannot do (it would create a second overload instead).

DROP FUNCTION IF EXISTS public.request_business_connection(UUID, UUID, TEXT);

CREATE FUNCTION public.request_business_connection(
  p_requester_org_id     UUID,
  p_recipient_org_id     UUID,
  p_message              TEXT DEFAULT NULL,
  p_counterparty_role    TEXT DEFAULT NULL,
  p_link_entity_id       UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_conn_id      UUID;
  v_existing     TEXT;
  v_recipient_ok BOOLEAN;
  v_linked       BOOLEAN;
BEGIN
  -- 1. Caller must be member of requester org
  IF NOT public.is_org_member(p_requester_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the requester organization';
  END IF;

  -- 2. Caller must have cbn.connect permission in requester org
  IF NOT public.has_permission(p_requester_org_id, 'cbn.connect') THEN
    RAISE EXCEPTION 'permission_denied: cbn.connect permission required';
  END IF;

  -- 3. Cannot connect to own org
  IF p_requester_org_id = p_recipient_org_id THEN
    RAISE EXCEPTION 'validation: cannot connect to your own organization';
  END IF;

  -- 4. Role + local record are mandatory: a connection with no local party is
  --    exactly the state that made document exchange fail.
  IF p_counterparty_role IS NULL OR p_counterparty_role NOT IN ('customer', 'supplier') THEN
    RAISE EXCEPTION 'validation: counterparty role must be customer or supplier';
  END IF;
  IF p_link_entity_id IS NULL THEN
    RAISE EXCEPTION 'validation: a local customer or supplier must be selected';
  END IF;

  -- 5. Validate recipient org exists and is discoverable
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.business_profiles bp ON bp.organization_id = o.id AND bp.deleted_at IS NULL
    WHERE o.id = p_recipient_org_id
      AND o.deleted_at IS NULL
      AND o.status = 'active'
      AND bp.is_discoverable = true
  ) INTO v_recipient_ok;

  IF NOT v_recipient_ok THEN
    RAISE EXCEPTION 'not_found: target business not found or not discoverable';
  END IF;

  -- 6. The chosen record must belong to the requester and be unlinked.
  IF p_counterparty_role = 'customer' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.customers
       WHERE id = p_link_entity_id
         AND organization_id = p_requester_org_id
         AND deleted_at IS NULL
         AND cbn_connection_id IS NULL
    ) INTO v_linked;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.suppliers
       WHERE id = p_link_entity_id
         AND organization_id = p_requester_org_id
         AND deleted_at IS NULL
         AND cbn_connection_id IS NULL
    ) INTO v_linked;
  END IF;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'validation: the selected % is not available to link', p_counterparty_role;
  END IF;

  -- 7. Check for existing connection in either direction
  SELECT status INTO v_existing
    FROM public.business_connections
   WHERE deleted_at IS NULL
     AND (
       (requester_organization_id = p_requester_org_id AND recipient_organization_id = p_recipient_org_id)
       OR (requester_organization_id = p_recipient_org_id AND recipient_organization_id = p_requester_org_id)
     )
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing IN ('pending', 'accepted') THEN
      RAISE EXCEPTION 'duplicate: a connection with this business already exists (status: %)', v_existing;
    END IF;

    -- Rejected/disconnected: retire the dead row so a new request can replace
    -- it. Soft-deleting does NOT fire the ON DELETE SET NULL on the party
    -- links, so clear them explicitly or the old parties stay bound to a dead
    -- connection and can never be linked again.
    UPDATE public.customers
       SET cbn_connection_id = NULL, updated_by = v_user
     WHERE cbn_connection_id IN (
       SELECT id FROM public.business_connections
        WHERE deleted_at IS NULL
          AND (
            (requester_organization_id = p_requester_org_id AND recipient_organization_id = p_recipient_org_id)
            OR (requester_organization_id = p_recipient_org_id AND recipient_organization_id = p_requester_org_id)
          )
     );

    UPDATE public.suppliers
       SET cbn_connection_id = NULL, updated_by = v_user
     WHERE cbn_connection_id IN (
       SELECT id FROM public.business_connections
        WHERE deleted_at IS NULL
          AND (
            (requester_organization_id = p_requester_org_id AND recipient_organization_id = p_recipient_org_id)
            OR (requester_organization_id = p_recipient_org_id AND recipient_organization_id = p_requester_org_id)
          )
     );

    UPDATE public.business_connections
       SET deleted_at = NOW(), deleted_by = v_user, updated_by = v_user
     WHERE deleted_at IS NULL
       AND (
         (requester_organization_id = p_requester_org_id AND recipient_organization_id = p_recipient_org_id)
         OR (requester_organization_id = p_recipient_org_id AND recipient_organization_id = p_requester_org_id)
       );
  END IF;

  -- 8. Insert new connection request
  INSERT INTO public.business_connections (
    organization_id,
    requester_organization_id,
    recipient_organization_id,
    status,
    connection_message,
    requester_counterparty_role,
    created_by,
    updated_by
  ) VALUES (
    p_requester_org_id,
    p_requester_org_id,
    p_recipient_org_id,
    'pending',
    p_message,
    p_counterparty_role,
    v_user,
    v_user
  )
  RETURNING id INTO v_conn_id;

  -- 9. Bind the requester's local record to the new connection
  IF p_counterparty_role = 'customer' THEN
    UPDATE public.customers
       SET cbn_connection_id = v_conn_id, updated_by = v_user
     WHERE id = p_link_entity_id;
  ELSE
    UPDATE public.suppliers
       SET cbn_connection_id = v_conn_id, updated_by = v_user
     WHERE id = p_link_entity_id;
  END IF;

  -- 10. Log CBN event
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status, created_at
  ) VALUES (
    p_requester_org_id, v_conn_id, 'connection.requested',
    v_user, p_requester_org_id, p_recipient_org_id,
    'business_connection', v_conn_id,
    jsonb_build_object('message', p_message, 'counterparty_role', p_counterparty_role),
    'success', NOW()
  );

  RETURN v_conn_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. accept_connection_request — link the INVERSE party type
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.accept_connection_request(UUID);

CREATE FUNCTION public.accept_connection_request(
  p_connection_id  UUID,
  p_link_entity_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_conn          RECORD;
  v_required_role TEXT;
  v_linked        BOOLEAN;
  v_all_perms     TEXT[] := ARRAY[
    'receive_invoices', 'receive_purchase_orders', 'receive_quotations',
    'view_catalog', 'view_stock', 'receive_payments',
    'share_documents', 'receive_delivery_updates', 'view_pricing'
  ];
BEGIN
  -- 1. Load and lock the connection row
  SELECT requester_organization_id, recipient_organization_id, status,
         requester_counterparty_role
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection request';
  END IF;
  IF v_conn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: connection is not in pending state (current: %)', v_conn.status;
  END IF;

  -- 2. Caller must be member of the RECIPIENT org
  IF NOT public.is_org_member(v_conn.recipient_organization_id) THEN
    RAISE EXCEPTION 'permission_denied: only the recipient can accept a connection request';
  END IF;

  IF NOT public.has_permission(v_conn.recipient_organization_id, 'cbn.connect') THEN
    RAISE EXCEPTION 'permission_denied: cbn.connect permission required';
  END IF;

  -- 3. Mirror the requester's declaration. If they called us their supplier,
  --    they are our customer. Connections predating this column carry no role,
  --    and stay linkable later rather than blocking the accept.
  IF v_conn.requester_counterparty_role IS NOT NULL THEN
    v_required_role := CASE v_conn.requester_counterparty_role
                         WHEN 'customer' THEN 'supplier'
                         ELSE 'customer'
                       END;

    IF p_link_entity_id IS NULL THEN
      RAISE EXCEPTION 'validation: a local % must be selected to accept this connection', v_required_role;
    END IF;

    IF v_required_role = 'customer' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.customers
         WHERE id = p_link_entity_id
           AND organization_id = v_conn.recipient_organization_id
           AND deleted_at IS NULL
           AND cbn_connection_id IS NULL
      ) INTO v_linked;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.suppliers
         WHERE id = p_link_entity_id
           AND organization_id = v_conn.recipient_organization_id
           AND deleted_at IS NULL
           AND cbn_connection_id IS NULL
      ) INTO v_linked;
    END IF;

    IF NOT v_linked THEN
      RAISE EXCEPTION 'validation: the selected % is not available to link', v_required_role;
    END IF;

    IF v_required_role = 'customer' THEN
      UPDATE public.customers
         SET cbn_connection_id = p_connection_id, updated_by = v_user
       WHERE id = p_link_entity_id;
    ELSE
      UPDATE public.suppliers
         SET cbn_connection_id = p_connection_id, updated_by = v_user
       WHERE id = p_link_entity_id;
    END IF;
  END IF;

  -- 4. Accept with full default permissions
  UPDATE public.business_connections
     SET status            = 'accepted',
         accepted_at       = NOW(),
         requester_grants  = v_all_perms,
         recipient_grants  = v_all_perms,
         updated_by        = v_user
   WHERE id = p_connection_id;

  -- 5. Increment total_connections on both business_profiles
  UPDATE public.business_profiles
     SET total_connections = total_connections + 1, updated_by = v_user
   WHERE organization_id IN (v_conn.requester_organization_id, v_conn.recipient_organization_id);

  -- 6. Log CBN event (recipient perspective)
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_conn.recipient_organization_id, p_connection_id, 'connection.accepted',
    v_user, v_conn.recipient_organization_id, v_conn.requester_organization_id,
    'business_connection', p_connection_id,
    '{}'::jsonb, 'success'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. accept_cbn_invoice — resolve the supplier by LINK, not by GST guesswork
-- ─────────────────────────────────────────────────────────────────────────────
-- Only step 4 of the body changes; the rest is reproduced verbatim so the
-- function stays a single source of truth.

DROP FUNCTION IF EXISTS public.accept_cbn_invoice(UUID, UUID, TEXT);

CREATE FUNCTION public.accept_cbn_invoice(
  p_cbn_invoice_id UUID,
  p_buyer_org_id   UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 4a. Preferred: the supplier bound to this connection when it was accepted.
  SELECT s.id INTO v_supplier_id
    FROM public.suppliers s
   WHERE s.organization_id = p_buyer_org_id
     AND s.cbn_connection_id = v_cbn.connection_id
     AND s.deleted_at IS NULL
   LIMIT 1;

  -- 4b. Fallback for connections made before party linking existed: match the
  --     sending organization's GST against the buyer's supplier book.
  IF v_supplier_id IS NULL THEN
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
  END IF;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'prerequisite: this connection is not linked to a supplier in your books. Open the connection and link a supplier, then accept the invoice again.';
  END IF;

  -- 5. Generate purchase invoice number
  v_pi_num := 'SYNC-PI-' || v_cbn.invoice_number;

  -- 6. Insert draft purchase invoice in buyer's system
  INSERT INTO public.purchase_invoices (
    organization_id, invoice_number, invoice_date, due_date, supplier_id,
    subtotal, tax_amount, total_amount, status, notes, created_by, updated_by
  ) VALUES (
    p_buyer_org_id, v_pi_num, v_cbn.invoice_date, v_cbn.due_date, v_supplier_id,
    v_cbn.subtotal, v_cbn.tax_amount, v_cbn.total_amount, 'draft',
    COALESCE(p_notes, 'Auto-created from CBN invoice sync: ' || v_cbn.invoice_number),
    v_user, v_user
  )
  RETURNING id INTO v_pi_id;

  -- 7. Mark cbn_invoice as accepted
  UPDATE public.cbn_invoices
     SET status                    = 'accepted',
         accepted_at               = NOW(),
         accepted_by               = v_user,
         buyer_purchase_invoice_id = v_pi_id,
         updated_by                = v_user
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
