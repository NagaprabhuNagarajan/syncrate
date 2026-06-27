-- =============================================================================
-- Migration: Quotations + Quotation Items
-- =============================================================================
-- Quotation lifecycle: draft → sent → viewed → accepted → rejected | expired
-- Expired or rejected quotations cannot convert to sales orders or invoices.
-- GST columns (CGST/SGST/IGST) stored per-line; intra-state vs inter-state is
-- determined at invoice time by comparing org state with customer supply_state.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quotations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id),
  quotation_number  TEXT NOT NULL,
  customer_id       UUID NOT NULL REFERENCES public.customers(id),
  branch_id         UUID REFERENCES public.branches(id),
  salesperson_id    UUID REFERENCES public.users(id),
  reference_number  TEXT,
  quotation_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date       DATE,
  supply_state      TEXT,                -- customer delivery state (for GST)
  is_interstate     BOOLEAN NOT NULL DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'sent', 'viewed', 'accepted',
                                        'rejected', 'expired', 'converted')),
  subtotal          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cgst_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  round_off         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes             TEXT,
  terms             TEXT,
  -- Conversion tracking
  converted_so_id   UUID,               -- filled when converted to sales order
  converted_inv_id  UUID,               -- filled when converted directly to invoice
  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES public.users(id),
  updated_by        UUID REFERENCES public.users(id),
  deleted_by        UUID REFERENCES public.users(id),
  version           INTEGER NOT NULL DEFAULT 1,
  UNIQUE (organization_id, quotation_number)
);

CREATE INDEX IF NOT EXISTS idx_quotations_org      ON public.quotations (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON public.quotations (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_status   ON public.quotations (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_date     ON public.quotations (organization_id, quotation_date DESC) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  quotation_id     UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES public.products(id),
  description      TEXT,
  hsn_code         TEXT,
  quantity         NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_percent NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  taxable_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gst_rate         NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  cgst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  sgst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  igst_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  cgst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sgst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  igst_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sort_order       INTEGER        NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items (quotation_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['quotations', 'quotation_items']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated
      USING (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated
      USING (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.quotations IS 'Customer quotations; converted to sales orders or invoices. Expired/rejected cannot convert.';
COMMENT ON TABLE public.quotation_items IS 'Line items for quotations with per-line GST breakdown (CGST/SGST/IGST).';
