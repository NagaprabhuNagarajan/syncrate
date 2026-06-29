-- =============================================================================
-- Migration: Marketplace orders, payments, shipments (Sprint 10 — transactions)
-- =============================================================================
-- Two-party records between a buyer org and a seller org. RLS is recursion-safe
-- two-party visibility (both sides see the row via get_user_organization_ids()
-- ANY-checks — no subquery on another table, matching cbn_events). Payments and
-- shipments are provider-abstracted at the SERVICE layer (default 'manual');
-- `provider` + `external_reference` carry whatever a real PSP/carrier returns.
-- =============================================================================

-- ── marketplace_orders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id),  -- buyer
  seller_organization_id   UUID NOT NULL REFERENCES public.organizations(id),
  listing_id               UUID REFERENCES public.marketplace_listings(id),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'confirmed', 'cancelled', 'fulfilled', 'completed')),
  quantity                 NUMERIC(15, 4) NOT NULL DEFAULT 1,
  total_amount             NUMERIC(15, 4) NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'INR',
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES public.users(id),
  updated_by               UUID REFERENCES public.users(id),
  version                  INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT chk_marketplace_order_not_self
    CHECK (organization_id <> seller_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer
  ON public.marketplace_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller
  ON public.marketplace_orders(seller_organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status
  ON public.marketplace_orders(status, created_at DESC);

-- ── marketplace_payments (escrow-capable, provider-abstracted) ───────────────
CREATE TABLE IF NOT EXISTS public.marketplace_payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id),  -- payer (buyer)
  counterparty_organization_id UUID NOT NULL REFERENCES public.organizations(id), -- payee (seller)
  order_id                    UUID NOT NULL REFERENCES public.marketplace_orders(id),
  provider                    TEXT NOT NULL DEFAULT 'manual',
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'held', 'released', 'refunded', 'failed')),
  amount                      NUMERIC(15, 4) NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'INR',
  external_reference          TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  UUID REFERENCES public.users(id),
  updated_by                  UUID REFERENCES public.users(id),
  version                     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_order
  ON public.marketplace_payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_payer
  ON public.marketplace_payments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_payee
  ON public.marketplace_payments(counterparty_organization_id, created_at DESC);

-- ── marketplace_shipments (provider-abstracted logistics) ────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_shipments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id),  -- shipper (seller)
  counterparty_organization_id UUID NOT NULL REFERENCES public.organizations(id), -- recipient (buyer)
  order_id                    UUID NOT NULL REFERENCES public.marketplace_orders(id),
  provider                    TEXT NOT NULL DEFAULT 'manual',
  carrier                     TEXT,
  tracking_number             TEXT,
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  shipped_at                  TIMESTAMPTZ,
  delivered_at                TIMESTAMPTZ,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  UUID REFERENCES public.users(id),
  updated_by                  UUID REFERENCES public.users(id),
  version                     INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_order
  ON public.marketplace_shipments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_shipper
  ON public.marketplace_shipments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_recipient
  ON public.marketplace_shipments(counterparty_organization_id, created_at DESC);

-- ── RLS — recursion-safe two-party visibility ────────────────────────────────
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_shipments ENABLE ROW LEVEL SECURITY;

-- Orders: buyer or seller can see; only the buyer creates.
CREATE POLICY "marketplace_orders_select"
  ON public.marketplace_orders FOR SELECT TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR seller_organization_id = ANY (public.get_user_organization_ids())
  );
CREATE POLICY "marketplace_orders_insert"
  ON public.marketplace_orders FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_orders_update"
  ON public.marketplace_orders FOR UPDATE TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR seller_organization_id = ANY (public.get_user_organization_ids())
  )
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
    OR seller_organization_id = ANY (public.get_user_organization_ids())
  );

-- Payments: payer or payee can see; either party may write (provider flow).
CREATE POLICY "marketplace_payments_select"
  ON public.marketplace_payments FOR SELECT TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );
CREATE POLICY "marketplace_payments_insert"
  ON public.marketplace_payments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );
CREATE POLICY "marketplace_payments_update"
  ON public.marketplace_payments FOR UPDATE TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  )
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );

-- Shipments: shipper or recipient can see; either party may write.
CREATE POLICY "marketplace_shipments_select"
  ON public.marketplace_shipments FOR SELECT TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );
CREATE POLICY "marketplace_shipments_insert"
  ON public.marketplace_shipments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );
CREATE POLICY "marketplace_shipments_update"
  ON public.marketplace_shipments FOR UPDATE TO authenticated
  USING (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  )
  WITH CHECK (
    organization_id = ANY (public.get_user_organization_ids())
    OR counterparty_organization_id = ANY (public.get_user_organization_ids())
  );

COMMENT ON TABLE public.marketplace_orders IS
  'B2B marketplace orders between a buyer and seller org. Two-party RLS visibility.';
COMMENT ON TABLE public.marketplace_payments IS
  'Provider-abstracted marketplace payments with escrow states (pending/held/released/refunded/failed).';
COMMENT ON TABLE public.marketplace_shipments IS
  'Provider-abstracted marketplace shipments with tracking + delivery status.';
