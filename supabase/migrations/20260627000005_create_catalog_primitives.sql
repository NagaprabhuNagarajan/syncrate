-- =============================================================================
-- Migration: Create catalog primitives — categories, brands, units
-- =============================================================================
-- Reference data for the Product catalog (docs/PRD/4.md Modules 7, 8).
-- Business rules: categories cannot be deleted while products exist (app layer);
-- archive + merge supported; nested categories via parent_id.
-- =============================================================================

-- ── Categories (nested) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  parent_id        UUID REFERENCES public.categories(id),
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);

-- Name unique per parent (root and nested handled separately because NULLs
-- are never equal in a multi-column unique constraint).
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_root_name
  ON public.categories (organization_id, name)
  WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_child_name
  ON public.categories (organization_id, parent_id, name)
  WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_org
  ON public.categories (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON public.categories (parent_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Brands ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brands (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_org_name
  ON public.brands (organization_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brands_org
  ON public.brands (organization_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Units of measure ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.units (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  name             TEXT NOT NULL,    -- e.g. 'Kilogram'
  symbol           TEXT NOT NULL,    -- e.g. 'kg'
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_org_name
  ON public.units (organization_id, name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_org_symbol
  ON public.units (organization_id, symbol) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_org
  ON public.units (organization_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS (tenant isolation; fine-grained perms enforced in app layer) ─────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories', 'brands', 'units']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_select_org_members" ON public.%1$I FOR SELECT TO authenticated
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
         WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert_org_members" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (organization_id IN (
        SELECT organization_id FROM public.organization_members
         WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update_org_members" ON public.%1$I FOR UPDATE TO authenticated
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
         WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));
    $f$, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.categories IS 'Nested product categories.';
COMMENT ON TABLE public.brands IS 'Product brands / manufacturers.';
COMMENT ON TABLE public.units IS 'Units of measure for products.';
