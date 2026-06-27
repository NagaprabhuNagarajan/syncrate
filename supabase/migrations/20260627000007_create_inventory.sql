-- =============================================================================
-- Migration: Create inventory — warehouses, inventory, transactions, batches
-- =============================================================================
-- docs/PRD/4.md Modules 9–11, docs/PRD/10.md Inventory Rules.
-- Rules: stock changes ONLY through inventory events (each writes an immutable
-- ledger row); manual stock editing prohibited; inventory history immutable;
-- transfers create two ledger entries (transfer_out + transfer_in).
-- =============================================================================

-- ── Warehouses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  branch_id        UUID REFERENCES public.branches(id),
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  address_line1    TEXT,
  city             TEXT,
  state            TEXT,
  pincode          TEXT,
  capacity         NUMERIC(14, 2),
  is_default       BOOLEAN NOT NULL DEFAULT false,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_warehouses_org
  ON public.warehouses (organization_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Batches ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  product_id          UUID NOT NULL REFERENCES public.products(id),
  batch_number        TEXT NOT NULL,
  manufacturing_date  DATE,
  expiry_date         DATE,
  supplier_batch      TEXT,
  received_quantity   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  remaining_quantity  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'expired', 'depleted')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, product_id, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_batches_product
  ON public.batches (product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_expiry
  ON public.batches (organization_id, expiry_date) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Inventory (current stock level per product + warehouse) ──────────────────
-- A materialized snapshot maintained by inventory events. Never edited directly
-- by users (the service updates it alongside writing a ledger row).
CREATE TABLE IF NOT EXISTS public.inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  product_id          UUID NOT NULL REFERENCES public.products(id),
  warehouse_id        UUID NOT NULL REFERENCES public.warehouses(id),
  quantity            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reserved_quantity   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_org
  ON public.inventory (organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product
  ON public.inventory (product_id);

CREATE OR REPLACE TRIGGER inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Inventory transactions (immutable ledger) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  product_id       UUID NOT NULL REFERENCES public.products(id),
  warehouse_id     UUID NOT NULL REFERENCES public.warehouses(id),
  batch_id         UUID REFERENCES public.batches(id),
  type             TEXT NOT NULL CHECK (type IN (
                     'opening', 'purchase', 'sale', 'sales_return',
                     'purchase_return', 'transfer_in', 'transfer_out',
                     'adjustment', 'damage', 'expiry', 'production', 'consumption')),
  -- Signed quantity: positive increases stock, negative decreases it
  quantity         NUMERIC(14, 2) NOT NULL,
  running_balance  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reference_type   TEXT,
  reference_id     UUID,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_inv_txn_product
  ON public.inventory_transactions (product_id, warehouse_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inv_txn_org
  ON public.inventory_transactions (organization_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses', 'batches', 'inventory']
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

-- Ledger is append-only: SELECT + INSERT for org members, no UPDATE/DELETE.
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_txn_select_org_members"
  ON public.inventory_transactions FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));
CREATE POLICY "inv_txn_insert_org_members"
  ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
     WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'));

COMMENT ON TABLE public.warehouses IS 'Stock-holding locations.';
COMMENT ON TABLE public.inventory IS 'Current stock snapshot per product+warehouse (event-maintained).';
COMMENT ON TABLE public.inventory_transactions IS 'Immutable, append-only inventory ledger.';
COMMENT ON TABLE public.batches IS 'Manufacturing/expiry batch tracking per product.';
