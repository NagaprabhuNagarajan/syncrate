-- =============================================================================
-- Migration: CBN SECURITY DEFINER helper functions
-- =============================================================================
-- These functions bypass RLS deliberately and safely:
--
-- 1. get_connected_organization_ids()
--    Returns org IDs that have an ACCEPTED connection with any of the
--    caller's orgs. Used in RLS policies for cross-org readable tables.
--    Reads business_connections directly (bypasses RLS, no recursion).
--
-- 2. search_businesses(query, limit, offset)
--    Business discovery: returns PUBLIC profile fields for any discoverable
--    org. The organizations table RLS restricts to members only — this
--    SECURITY DEFINER function is the ONLY way to read other orgs'
--    public data for discovery. NEVER exposes private fields.
--
-- 3. get_business_public_profile(org_id)
--    Returns the public profile of a specific org (for connection request flow).
--
-- 4. search_supplier_catalog(supplier_org_id, limit, offset)
--    Returns published catalog items from a connected supplier.
--    Validates the connection before returning data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_connected_organization_ids()
-- Returns all org IDs that have an ACCEPTED connection with the caller's orgs.
-- NEVER reads business_connections under RLS (SECURITY DEFINER bypasses it).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_connected_organization_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT
      CASE
        WHEN bc.requester_organization_id = ANY(public.get_user_organization_ids())
          THEN bc.recipient_organization_id
        ELSE bc.requester_organization_id
      END
    FROM public.business_connections bc
    WHERE bc.status = 'accepted'
      AND bc.deleted_at IS NULL
      AND (
        bc.requester_organization_id = ANY(public.get_user_organization_ids())
        OR bc.recipient_organization_id = ANY(public.get_user_organization_ids())
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. search_businesses(query, limit, offset)
-- Business Discovery: returns PUBLIC fields only. Private data never exposed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_businesses(
  p_query  TEXT,
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  display_name        TEXT,
  business_id         TEXT,
  gst_number          TEXT,
  business_type       TEXT,
  city                TEXT,
  state               TEXT,
  country             TEXT,
  logo_url            TEXT,
  verification_status TEXT,
  verification_level  INT,
  trust_score         NUMERIC,
  is_connected        BOOLEAN,
  connection_status   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_orgs UUID[] := public.get_user_organization_ids();
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.display_name,
    o.business_id,
    o.gst_number,
    o.business_type,
    o.city,
    o.state,
    o.country,
    o.logo_url,
    o.verification_status,
    bp.verification_level,
    bp.trust_score,
    -- Is this org already connected to any of the caller's orgs?
    EXISTS (
      SELECT 1 FROM public.business_connections bc
      WHERE bc.status = 'accepted'
        AND bc.deleted_at IS NULL
        AND (
          (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = o.id)
          OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = o.id)
        )
    ) AS is_connected,
    -- Existing connection status if any
    (
      SELECT bc.status FROM public.business_connections bc
      WHERE bc.deleted_at IS NULL
        AND (
          (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = o.id)
          OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = o.id)
        )
      ORDER BY bc.created_at DESC
      LIMIT 1
    ) AS connection_status
  FROM public.organizations o
  JOIN public.business_profiles bp ON bp.organization_id = o.id AND bp.deleted_at IS NULL
  WHERE o.deleted_at IS NULL
    AND o.status = 'active'
    AND bp.is_discoverable = true
    -- Exclude the caller's own orgs
    AND o.id <> ALL(v_my_orgs)
    -- Search filter
    AND (
      p_query = ''
      OR o.name ILIKE '%' || p_query || '%'
      OR o.gst_number ILIKE '%' || p_query || '%'
      OR o.business_id ILIKE '%' || p_query || '%'
      OR o.email ILIKE '%' || p_query || '%'
      OR o.phone ILIKE '%' || p_query || '%'
      OR o.city ILIKE '%' || p_query || '%'
    )
  ORDER BY bp.trust_score DESC, o.name ASC
  LIMIT LEAST(p_limit, 50)   -- cap at 50 per page for safety
  OFFSET p_offset;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. get_business_public_profile(org_id)
-- Returns the public profile of a single org for the connection request flow.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_business_public_profile(p_organization_id UUID)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  display_name        TEXT,
  business_id         TEXT,
  gst_number          TEXT,
  business_type       TEXT,
  city                TEXT,
  state               TEXT,
  country             TEXT,
  logo_url            TEXT,
  website             TEXT,
  email               TEXT,
  phone               TEXT,
  verification_status TEXT,
  verification_level  INT,
  trust_score         NUMERIC,
  catalog_enabled     BOOLEAN,
  total_connections   INT,
  is_connected        BOOLEAN,
  connection_id       UUID,
  connection_status   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_orgs UUID[] := public.get_user_organization_ids();
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.display_name,
    o.business_id,
    o.gst_number,
    o.business_type,
    o.city,
    o.state,
    o.country,
    o.logo_url,
    o.website,
    o.email,
    o.phone,
    o.verification_status,
    bp.verification_level,
    bp.trust_score,
    bp.catalog_enabled,
    bp.total_connections,
    EXISTS (
      SELECT 1 FROM public.business_connections bc
      WHERE bc.status = 'accepted'
        AND bc.deleted_at IS NULL
        AND (
          (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = p_organization_id)
          OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = p_organization_id)
        )
    ) AS is_connected,
    (
      SELECT bc.id FROM public.business_connections bc
      WHERE bc.deleted_at IS NULL
        AND (
          (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = p_organization_id)
          OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = p_organization_id)
        )
      ORDER BY bc.created_at DESC
      LIMIT 1
    ) AS connection_id,
    (
      SELECT bc.status FROM public.business_connections bc
      WHERE bc.deleted_at IS NULL
        AND (
          (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = p_organization_id)
          OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = p_organization_id)
        )
      ORDER BY bc.created_at DESC
      LIMIT 1
    ) AS connection_status
  FROM public.organizations o
  JOIN public.business_profiles bp ON bp.organization_id = o.id AND bp.deleted_at IS NULL
  WHERE o.id = p_organization_id
    AND o.deleted_at IS NULL
    AND o.status = 'active';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. search_supplier_catalog(supplier_org_id, query, limit, offset)
-- Returns published catalog items from a connected supplier.
-- Validates: accepted connection + catalog enabled before returning data.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_supplier_catalog(
  p_supplier_org_id UUID,
  p_query           TEXT DEFAULT '',
  p_limit           INT  DEFAULT 20,
  p_offset          INT  DEFAULT 0
)
RETURNS TABLE (
  id                 UUID,
  product_id         UUID,
  product_name       TEXT,
  product_sku        TEXT,
  catalog_price      NUMERIC,
  currency           TEXT,
  moq                INT,
  lead_time_days     INT,
  stock_availability TEXT,
  catalog_notes      TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_orgs UUID[] := public.get_user_organization_ids();
  v_connected BOOLEAN;
BEGIN
  -- Validate: accepted connection must exist
  SELECT EXISTS (
    SELECT 1 FROM public.business_connections bc
    WHERE bc.status = 'accepted'
      AND bc.deleted_at IS NULL
      AND (
        (bc.requester_organization_id = ANY(v_my_orgs) AND bc.recipient_organization_id = p_supplier_org_id)
        OR (bc.recipient_organization_id = ANY(v_my_orgs) AND bc.requester_organization_id = p_supplier_org_id)
      )
      -- Verify 'view_catalog' permission granted to caller
      AND (
        (bc.requester_organization_id = ANY(v_my_orgs)
          AND 'view_catalog' = ANY(bc.requester_grants))
        OR (bc.recipient_organization_id = ANY(v_my_orgs)
          AND 'view_catalog' = ANY(bc.recipient_grants))
      )
  ) INTO v_connected;

  IF NOT v_connected THEN
    RAISE EXCEPTION 'permission_denied: no accepted connection with catalog access to this supplier';
  END IF;

  RETURN QUERY
  SELECT
    sci.id,
    sci.product_id,
    p.name AS product_name,
    p.sku  AS product_sku,
    sci.catalog_price,
    sci.currency,
    sci.moq,
    sci.lead_time_days,
    sci.stock_availability,
    sci.catalog_notes
  FROM public.supplier_catalog_items sci
  JOIN public.products p ON p.id = sci.product_id AND p.deleted_at IS NULL
  WHERE sci.organization_id = p_supplier_org_id
    AND sci.is_published = true
    AND sci.deleted_at IS NULL
    AND (
      p_query = ''
      OR p.name ILIKE '%' || p_query || '%'
      OR p.sku  ILIKE '%' || p_query || '%'
    )
  ORDER BY p.name ASC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;

-- Grants
COMMENT ON FUNCTION public.get_connected_organization_ids() IS
  'Returns org IDs with accepted CBN connections to the caller. SECURITY DEFINER — bypasses RLS on business_connections. Used in RLS policies.';
COMMENT ON FUNCTION public.search_businesses IS
  'Business Discovery: returns PUBLIC profile fields only. SECURITY DEFINER to bypass org RLS. Never exposes private data.';
COMMENT ON FUNCTION public.get_business_public_profile IS
  'Returns the public CBN profile of a single org. SECURITY DEFINER — safe to call for any org_id.';
COMMENT ON FUNCTION public.search_supplier_catalog IS
  'Returns published catalog items from a connected supplier. Validates connection + view_catalog permission before returning data.';
