-- =============================================================================
-- Migration: CBN Connection RPCs
-- =============================================================================
-- Atomic operations for the connection lifecycle.
--
-- request_business_connection(requester_org_id, recipient_org_id, message)
--   1. Validate caller is member of requester_org with cbn.connect permission
--   2. Validate target org exists and is discoverable
--   3. Validate no existing pending/accepted connection
--   4. Insert business_connections row (status=pending)
--   5. Log CBN event
--   Returns: connection_id UUID
--
-- accept_connection_request(connection_id)
--   1. Validate caller is member of the RECIPIENT org
--   2. Validate status = 'pending'
--   3. Set status='accepted', accepted_at, grant ALL default permissions
--   4. Increment total_connections on both business_profiles
--   5. Log CBN event
--
-- reject_connection_request(connection_id, reason)
--   1. Validate caller is member of the RECIPIENT org
--   2. Validate status = 'pending'
--   3. Set status='rejected', rejected_at, reason
--   4. Log CBN event
--
-- disconnect_business(connection_id, reason)
--   1. Validate caller is member of EITHER org
--   2. Validate status = 'accepted'
--   3. Set status='disconnected', disconnected_at
--   4. Decrement total_connections on both business_profiles
--   5. Log CBN event
--
-- update_connection_permissions(connection_id, my_grants TEXT[])
--   1. Validate caller is a member of one of the connection's orgs
--   2. Update the appropriate grants column for the caller's org side
--   3. Log CBN event
--
-- All functions: SECURITY INVOKER — caller's RLS applies for SELECT validation.
-- INSERT into business_connections uses RLS policies that allow requester.
-- =============================================================================

-- Default permissions granted when a connection is accepted
-- (full access on both sides by default; can be restricted later)
DO $$
BEGIN
  -- Nothing to do here — the DEFAULT permissions constant is embedded in the RPC
END $$;

-- ── request_business_connection ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_business_connection(
  p_requester_org_id UUID,
  p_recipient_org_id UUID,
  p_message          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_conn_id      UUID;
  v_existing     TEXT;
  v_recipient_ok BOOLEAN;
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

  -- 4. Validate recipient org exists and is active (SECURITY DEFINER bypass via subquery)
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

  -- 5. Check for existing connection in either direction
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
    -- If rejected/disconnected, allow a new request
    -- Soft-delete the old one first to satisfy unique constraint
    UPDATE public.business_connections
       SET deleted_at = NOW(), deleted_by = v_user, updated_by = v_user
     WHERE deleted_at IS NULL
       AND (
         (requester_organization_id = p_requester_org_id AND recipient_organization_id = p_recipient_org_id)
         OR (requester_organization_id = p_recipient_org_id AND recipient_organization_id = p_requester_org_id)
       );
  END IF;

  -- 6. Insert new connection request
  INSERT INTO public.business_connections (
    organization_id,
    requester_organization_id,
    recipient_organization_id,
    status,
    connection_message,
    created_by,
    updated_by
  ) VALUES (
    p_requester_org_id,
    p_requester_org_id,
    p_recipient_org_id,
    'pending',
    p_message,
    v_user,
    v_user
  )
  RETURNING id INTO v_conn_id;

  -- 7. Log CBN event (requester perspective)
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status, created_at
  ) VALUES (
    p_requester_org_id, v_conn_id, 'connection.requested',
    v_user, p_requester_org_id, p_recipient_org_id,
    'business_connection', v_conn_id,
    jsonb_build_object('message', p_message), 'success', NOW()
  );

  RETURN v_conn_id;
END;
$$;

-- ── accept_connection_request ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_connection_request(p_connection_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_conn      RECORD;
  v_all_perms TEXT[] := ARRAY[
    'receive_invoices', 'receive_purchase_orders', 'receive_quotations',
    'view_catalog', 'view_stock', 'receive_payments',
    'share_documents', 'receive_delivery_updates', 'view_pricing'
  ];
BEGIN
  -- 1. Load and lock the connection row
  SELECT requester_organization_id, recipient_organization_id, status
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

  -- 3. Accept with full default permissions
  UPDATE public.business_connections
     SET status            = 'accepted',
         accepted_at       = NOW(),
         requester_grants  = v_all_perms,
         recipient_grants  = v_all_perms,
         updated_by        = v_user
   WHERE id = p_connection_id;

  -- 4. Increment total_connections on both business_profiles
  UPDATE public.business_profiles
     SET total_connections = total_connections + 1, updated_by = v_user
   WHERE organization_id IN (v_conn.requester_organization_id, v_conn.recipient_organization_id);

  -- 5. Log CBN event (recipient perspective)
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

-- ── reject_connection_request ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_connection_request(
  p_connection_id UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn RECORD;
BEGIN
  SELECT requester_organization_id, recipient_organization_id, status
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection request';
  END IF;
  IF v_conn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: can only reject pending requests';
  END IF;

  -- Only the recipient can reject
  IF NOT public.is_org_member(v_conn.recipient_organization_id) THEN
    RAISE EXCEPTION 'permission_denied: only the recipient can reject a connection request';
  END IF;

  UPDATE public.business_connections
     SET status           = 'rejected',
         rejected_at      = NOW(),
         rejection_reason = p_reason,
         updated_by       = v_user
   WHERE id = p_connection_id;

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id,
    metadata, status
  ) VALUES (
    v_conn.recipient_organization_id, p_connection_id, 'connection.rejected',
    v_user, v_conn.recipient_organization_id, v_conn.requester_organization_id,
    'business_connection', p_connection_id,
    jsonb_build_object('reason', p_reason), 'success'
  );
END;
$$;

-- ── disconnect_business ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.disconnect_business(
  p_connection_id UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_conn RECORD;
  v_my_org UUID;
BEGIN
  SELECT requester_organization_id, recipient_organization_id, status
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;
  IF v_conn.status <> 'accepted' THEN
    RAISE EXCEPTION 'invalid_status: can only disconnect accepted connections';
  END IF;

  -- Either party can disconnect
  IF public.is_org_member(v_conn.requester_organization_id) THEN
    v_my_org := v_conn.requester_organization_id;
  ELSIF public.is_org_member(v_conn.recipient_organization_id) THEN
    v_my_org := v_conn.recipient_organization_id;
  ELSE
    RAISE EXCEPTION 'permission_denied: not a participant in this connection';
  END IF;

  UPDATE public.business_connections
     SET status           = 'disconnected',
         disconnected_at  = NOW(),
         rejection_reason = p_reason,
         updated_by       = v_user
   WHERE id = p_connection_id;

  -- Decrement total_connections on both profiles
  UPDATE public.business_profiles
     SET total_connections = GREATEST(0, total_connections - 1), updated_by = v_user
   WHERE organization_id IN (v_conn.requester_organization_id, v_conn.recipient_organization_id);

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'connection.disconnected',
    v_user, v_my_org,
    CASE WHEN v_my_org = v_conn.requester_organization_id
         THEN v_conn.recipient_organization_id
         ELSE v_conn.requester_organization_id END,
    'business_connection', p_connection_id,
    jsonb_build_object('reason', p_reason), 'success'
  );
END;
$$;

-- ── update_connection_permissions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_connection_permissions(
  p_connection_id UUID,
  p_my_grants     TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_conn   RECORD;
  v_my_org UUID;
BEGIN
  SELECT requester_organization_id, recipient_organization_id, status
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;
  IF v_conn.status <> 'accepted' THEN
    RAISE EXCEPTION 'invalid_status: can only update permissions on accepted connections';
  END IF;

  -- Identify caller's side
  IF public.is_org_member(v_conn.requester_organization_id) THEN
    v_my_org := v_conn.requester_organization_id;
    UPDATE public.business_connections
       SET requester_grants = p_my_grants, updated_by = v_user
     WHERE id = p_connection_id;
  ELSIF public.is_org_member(v_conn.recipient_organization_id) THEN
    v_my_org := v_conn.recipient_organization_id;
    UPDATE public.business_connections
       SET recipient_grants = p_my_grants, updated_by = v_user
     WHERE id = p_connection_id;
  ELSE
    RAISE EXCEPTION 'permission_denied: not a participant in this connection';
  END IF;

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'connection.permissions_updated',
    v_user, v_my_org, NULL,
    'business_connection', p_connection_id,
    jsonb_build_object('new_grants', p_my_grants), 'success'
  );
END;
$$;

COMMENT ON FUNCTION public.request_business_connection IS
  'Atomic CBN connection request. Validates permissions and uniqueness. Returns new connection ID.';
COMMENT ON FUNCTION public.accept_connection_request IS
  'Atomic connection acceptance. Grants full default permissions. Only the recipient may call.';
COMMENT ON FUNCTION public.reject_connection_request IS
  'Atomic connection rejection. Only the recipient may call.';
COMMENT ON FUNCTION public.disconnect_business IS
  'Atomic disconnect. Either party may disconnect an accepted connection.';
COMMENT ON FUNCTION public.update_connection_permissions IS
  'Update the caller-side grants on an accepted connection.';
