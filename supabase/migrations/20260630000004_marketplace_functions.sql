-- =============================================================================
-- Migration: Marketplace network-read functions (Sprint 10)
-- =============================================================================
-- Network-wide reads run through SECURITY DEFINER functions instead of cross-org
-- RLS policies (the recursion-safe pattern used across CBN). Browse is public
-- within the authenticated network; the application authorizes marketplace.view
-- at the service layer.
-- =============================================================================

-- 1. search_marketplace_listings — browse active, published listings network-wide.
CREATE OR REPLACE FUNCTION public.search_marketplace_listings(
  p_query        TEXT DEFAULT '',
  p_listing_type TEXT DEFAULT '',
  p_category     TEXT DEFAULT '',
  p_limit        INT  DEFAULT 20,
  p_offset       INT  DEFAULT 0
)
RETURNS TABLE (
  id                      UUID,
  organization_id         UUID,
  seller_name             TEXT,
  listing_type            TEXT,
  product_id              UUID,
  title                   TEXT,
  description             TEXT,
  category                TEXT,
  price                   NUMERIC,
  currency                TEXT,
  unit                    TEXT,
  min_order_qty           INT,
  created_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.organization_id,
    COALESCE(o.display_name, o.name) AS seller_name,
    ml.listing_type,
    ml.product_id,
    ml.title,
    ml.description,
    ml.category,
    ml.price,
    ml.currency,
    ml.unit,
    ml.min_order_qty,
    ml.created_at
  FROM public.marketplace_listings ml
  JOIN public.organizations o ON o.id = ml.organization_id AND o.deleted_at IS NULL
  WHERE ml.deleted_at IS NULL
    AND ml.is_published = true
    AND ml.status = 'active'
    AND (p_listing_type = '' OR ml.listing_type = p_listing_type)
    AND (p_category = '' OR ml.category = p_category)
    AND (
      p_query = ''
      OR ml.title ILIKE '%' || p_query || '%'
      OR ml.description ILIKE '%' || p_query || '%'
    )
  ORDER BY ml.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;

-- 2. get_organization_reputation — aggregate reputation for one org.
CREATE OR REPLACE FUNCTION public.get_organization_reputation(p_org_id UUID)
RETURNS TABLE (
  review_count       INT,
  average_rating     NUMERIC,
  recommended_count  INT,
  recommend_percent  NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT AS review_count,
    COALESCE(ROUND(AVG(mr.rating)::NUMERIC, 2), 0) AS average_rating,
    COUNT(*) FILTER (WHERE mr.is_recommended)::INT AS recommended_count,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE mr.is_recommended)::NUMERIC / COUNT(*)) * 100,
        1
      )
    END AS recommend_percent
  FROM public.marketplace_reviews mr
  WHERE mr.subject_organization_id = p_org_id
    AND mr.deleted_at IS NULL;
END;
$$;

-- 3. list_organization_reviews — public reviews for one org, with reviewer name.
CREATE OR REPLACE FUNCTION public.list_organization_reviews(
  p_org_id UUID,
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  reviewer_name   TEXT,
  rating          INT,
  title           TEXT,
  comment         TEXT,
  is_recommended  BOOLEAN,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.id,
    COALESCE(o.display_name, o.name) AS reviewer_name,
    mr.rating,
    mr.title,
    mr.comment,
    mr.is_recommended,
    mr.created_at
  FROM public.marketplace_reviews mr
  JOIN public.organizations o ON o.id = mr.organization_id
  WHERE mr.subject_organization_id = p_org_id
    AND mr.deleted_at IS NULL
  ORDER BY mr.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.search_marketplace_listings IS
  'Network-wide browse of active published marketplace listings (SECURITY DEFINER).';
COMMENT ON FUNCTION public.get_organization_reputation IS
  'Aggregate reputation (review count, avg rating, recommend %) for an organization.';
COMMENT ON FUNCTION public.list_organization_reviews IS
  'Public reputation reviews for an organization, newest first.';
