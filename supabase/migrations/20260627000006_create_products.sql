-- =============================================================================
-- Migration: Create products
-- =============================================================================
-- Central product catalog — the single source of truth for every sellable /
-- stockable item (docs/PRD/4.md Module 6, docs/PRD/10.md Product Rules).
-- Rules: code/SKU/barcode unique per org; soft delete only; archived products
-- cannot be modified/sold (app layer); products referenced by transactions
-- cannot be deleted.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id),
  -- Basic
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  type                 TEXT NOT NULL DEFAULT 'inventory'
                         CHECK (type IN ('inventory', 'service', 'digital', 'bundle')),
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'active', 'discontinued', 'archived')),
  -- Classification
  category_id          UUID REFERENCES public.categories(id),
  brand_id             UUID REFERENCES public.brands(id),
  unit_id              UUID REFERENCES public.units(id),
  manufacturer         TEXT,
  -- Taxation
  hsn_code             TEXT,
  gst_rate             NUMERIC(5, 2) NOT NULL DEFAULT 0
                         CHECK (gst_rate IN (0, 5, 12, 18, 28)),
  tax_inclusive        BOOLEAN NOT NULL DEFAULT false,
  -- Pricing
  purchase_price       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  selling_price        NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  dealer_price         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (dealer_price >= 0),
  wholesale_price      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  retail_price         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  min_selling_price    NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (min_selling_price >= 0),
  -- Inventory attributes
  sku                  TEXT,
  barcode              TEXT,
  qr_code              TEXT,
  track_inventory      BOOLEAN NOT NULL DEFAULT true,
  reorder_level        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  max_stock            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  opening_stock        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  preferred_supplier_id UUID REFERENCES public.suppliers(id),
  -- AI / classification flags
  is_seasonal          BOOLEAN NOT NULL DEFAULT false,
  is_fast_moving       BOOLEAN NOT NULL DEFAULT false,
  is_slow_moving       BOOLEAN NOT NULL DEFAULT false,
  ai_tags              TEXT[] NOT NULL DEFAULT '{}',
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  -- Audit
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  created_by           UUID REFERENCES public.users(id),
  updated_by           UUID REFERENCES public.users(id),
  deleted_by           UUID REFERENCES public.users(id),
  version              INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, code)
);

-- SKU / barcode unique per org (only live rows that actually carry one)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_org_sku
  ON public.products (organization_id, sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_org_barcode
  ON public.products (organization_id, barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_org      ON public.products (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_status   ON public.products (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand    ON public.products (brand_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_name_search
  ON public.products USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(code, '') || ' ' || coalesce(sku, '')))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_org_members"
  ON public.products FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

CREATE POLICY "products_insert_org_members"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

CREATE POLICY "products_update_org_members"
  ON public.products FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

COMMENT ON TABLE public.products IS
  'Central product catalog. code/SKU/barcode unique per org; soft-delete only.';
