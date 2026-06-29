-- =============================================================================
-- Migration: Create supplier_catalog_items
-- =============================================================================
-- Suppliers may publish a product catalog visible to connected customers.
-- Catalog items are read-only for connected orgs (supplier controls them).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_catalog_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  product_id          UUID NOT NULL REFERENCES public.products(id),
  -- Catalog-specific pricing (may differ from internal price)
  catalog_price       NUMERIC(15,4) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'INR',
  -- Terms
  moq                 INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
  lead_time_days      INTEGER CHECK (lead_time_days >= 0),
  -- Availability
  stock_availability  TEXT NOT NULL DEFAULT 'available'
                        CHECK (stock_availability IN ('available', 'limited', 'out_of_stock', 'pre_order')),
  -- Visibility
  is_published        BOOLEAN NOT NULL DEFAULT false,
  -- Notes for the buyer
  catalog_notes       TEXT,
  -- Audit columns
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1,
  -- One catalog entry per product per org
  CONSTRAINT uq_catalog_org_product UNIQUE (organization_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_items_org
  ON public.supplier_catalog_items(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_items_published
  ON public.supplier_catalog_items(organization_id, is_published) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_items_product
  ON public.supplier_catalog_items(product_id) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER supplier_catalog_updated_at
  BEFORE UPDATE ON public.supplier_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.supplier_catalog_items ENABLE ROW LEVEL SECURITY;

-- Own org members can read/write their catalog
CREATE POLICY "catalog_select_own"
  ON public.supplier_catalog_items FOR SELECT
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()));

-- NOTE: Connected orgs read published catalog via a SECURITY DEFINER function
-- (search_supplier_catalog), NOT via an RLS policy that references
-- business_connections. This avoids any recursion risk and keeps the RLS simple.
-- Connected org read access is enforced at the service/function layer.

CREATE POLICY "catalog_insert_own"
  ON public.supplier_catalog_items FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "catalog_update_own"
  ON public.supplier_catalog_items FOR UPDATE
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "catalog_delete_own"
  ON public.supplier_catalog_items FOR DELETE
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()));

COMMENT ON TABLE public.supplier_catalog_items IS
  'Supplier-published product catalog visible to connected customer organizations.';
