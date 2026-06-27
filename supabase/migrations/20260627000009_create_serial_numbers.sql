-- =============================================================================
-- Migration: Create serial_numbers
-- =============================================================================
-- Serial number tracking for unique, individually-identifiable products
-- (docs/PRD/4.md Module 12: laptops, mobiles, printers, vehicle parts).
-- Rule: every serial number must be unique within an organization.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.serial_numbers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  product_id       UUID NOT NULL REFERENCES public.products(id),
  warehouse_id     UUID REFERENCES public.warehouses(id),
  batch_id         UUID REFERENCES public.batches(id),
  serial_number    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'in_stock'
                     CHECK (status IN ('in_stock', 'reserved', 'sold', 'returned', 'damaged')),
  -- Source document (e.g. the purchase/sale that moved this unit)
  reference_type   TEXT,
  reference_id     UUID,
  notes            TEXT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);

-- Serial number unique per organization (only among live rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_serial_numbers_org_serial
  ON public.serial_numbers (organization_id, serial_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_serial_numbers_product
  ON public.serial_numbers (product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status
  ON public.serial_numbers (organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER serial_numbers_updated_at
  BEFORE UPDATE ON public.serial_numbers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "serial_numbers_select_org_members"
  ON public.serial_numbers FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

CREATE POLICY "serial_numbers_insert_org_members"
  ON public.serial_numbers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

CREATE POLICY "serial_numbers_update_org_members"
  ON public.serial_numbers FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

COMMENT ON TABLE public.serial_numbers IS
  'Per-unit serial number tracking. serial_number unique per organization.';
