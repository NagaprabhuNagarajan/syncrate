-- =============================================================================
-- Migration: Create marketplace_listings (Sprint 10 — Supplier/Product Marketplace)
-- =============================================================================
-- Businesses publish listings (a product offer, or a supplier/service profile)
-- that are discoverable network-wide. RLS is deliberately OWN-ORG ONLY:
-- network-wide browsing is served by the SECURITY DEFINER function
-- search_marketplace_listings (see 20260630000004) — mirroring the recursion-safe
-- approach used by supplier_catalog / business discovery, NOT a cross-org RLS
-- policy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  listing_type     TEXT NOT NULL CHECK (listing_type IN ('product', 'supplier')),
  -- Optional link to an internal product (for product listings).
  product_id       UUID REFERENCES public.products(id),
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT,
  -- Indicative price (nullable — many B2B listings are quote-on-request).
  price            NUMERIC(15, 4),
  currency         TEXT NOT NULL DEFAULT 'INR',
  unit             TEXT,
  -- Minimum order quantity for product listings.
  min_order_qty    INTEGER,
  -- Only published, active listings appear in network browse.
  is_published     BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused', 'archived')),
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_org
  ON public.marketplace_listings(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_browse
  ON public.marketplace_listings(listing_type, category, created_at DESC)
  WHERE deleted_at IS NULL AND is_published = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_product
  ON public.marketplace_listings(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

-- OWN-ORG ONLY. Network browse is via search_marketplace_listings (SECURITY DEFINER).
CREATE POLICY "marketplace_listings_select_own"
  ON public.marketplace_listings FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_listings_insert_own"
  ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_listings_update_own"
  ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_listings_delete_own"
  ON public.marketplace_listings FOR DELETE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.marketplace_listings IS
  'Network-discoverable business listings. RLS is own-org; network browse is via search_marketplace_listings (SECURITY DEFINER).';
