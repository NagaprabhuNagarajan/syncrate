-- =============================================================================
-- Migration: get_marketplace_listing (Sprint 10 — authoritative listing fetch)
-- =============================================================================
-- Order placement must derive the seller and price from the LISTING, not from
-- client input (a buyer cannot read a seller's listing row directly — RLS is
-- own-org). This SECURITY DEFINER function returns a single active, published
-- listing network-wide so placeOrder can validate seller/price authoritatively
-- and reject spoofed orders. Mirrors search_marketplace_listings.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_marketplace_listing(p_id UUID)
RETURNS TABLE (
  id              UUID,
  organization_id UUID,
  title           TEXT,
  listing_type    TEXT,
  price           NUMERIC,
  currency        TEXT,
  min_order_qty   INT,
  is_published    BOOLEAN,
  status          TEXT
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
    ml.title,
    ml.listing_type,
    ml.price,
    ml.currency,
    ml.min_order_qty,
    ml.is_published,
    ml.status
  FROM public.marketplace_listings ml
  WHERE ml.id = p_id
    AND ml.deleted_at IS NULL
    AND ml.is_published = true
    AND ml.status = 'active';
END;
$$;

COMMENT ON FUNCTION public.get_marketplace_listing IS
  'Authoritative fetch of a single active, published listing for order placement (SECURITY DEFINER).';
