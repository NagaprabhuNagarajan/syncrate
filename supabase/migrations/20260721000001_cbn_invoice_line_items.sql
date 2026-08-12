-- =============================================================================
-- Migration: Carry invoice LINE ITEMS across the network, and resolve them to
--            the receiving organization's own products
-- =============================================================================
-- A CBN-synced bill arrived with a header and no lines. Two separate causes:
--
--   1. Nothing was transmitted. cbn_invoices is a header-only snapshot and
--      send_cbn_invoice never read invoice_items, so the detail never left the
--      seller.
--   2. Nothing could be inserted anyway. purchase_invoice_items.product_id is
--      NOT NULL REFERENCES products(id) — the BUYER's catalog. The seller's
--      product UUID is meaningless in the buyer's org, and referencing it would
--      breach tenant isolation.
--
-- (2) is the real problem: product identity does not cross organizational
-- boundaries. There is no shared product identifier. Only `barcode` carries
-- genuine cross-org meaning; `sku` is seller-specific and `hsn_code` is a tax
-- class, not a product. So every incoming line has to be RESOLVED to a product
-- that already exists in the buyer's books.
--
-- The approach: transmit a faithful line snapshot plus matching hints, resolve
-- automatically where the evidence is strong, make the buyer decide otherwise,
-- and remember that decision so the next invoice from the same supplier needs
-- no input at all.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. cbn_invoice_items — the transmitted line snapshot
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors cbn_invoices' RLS exactly: both parties read, only the sender writes,
-- and in practice all writes go through the SECURITY DEFINER RPC.

CREATE TABLE IF NOT EXISTS public.cbn_invoice_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cbn_invoice_id      UUID NOT NULL REFERENCES public.cbn_invoices(id) ON DELETE CASCADE,
  -- Sender's org. Denormalized from the parent so RLS needs no join.
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  sort_order          INTEGER NOT NULL DEFAULT 0,

  -- The seller's products.id. This is the MAPPING KEY: stable and unique within
  -- the seller's org, so a confirmed match can be replayed on later invoices.
  -- It is deliberately NOT a foreign key — it points into another tenant.
  supplier_product_id UUID,

  -- Matching hints, used only the first time a product is seen. Snapshotted so
  -- they stay true even if the seller later edits their catalog.
  product_name        TEXT,
  product_sku         TEXT,
  product_barcode     TEXT,
  hsn_code            TEXT,

  -- Faithful copy of the line as invoiced.
  description         TEXT,
  quantity            NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  taxable_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gst_rate            NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total          NUMERIC(14, 2) NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cbn_invoice_items_invoice
  ON public.cbn_invoice_items(cbn_invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_invoice_items_org
  ON public.cbn_invoice_items(organization_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER cbn_invoice_items_updated_at
  BEFORE UPDATE ON public.cbn_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cbn_invoice_items ENABLE ROW LEVEL SECURITY;

-- Both sides read: the buyer must see the lines to map them. Membership is
-- resolved through the parent invoice, which already encodes both participants.
CREATE POLICY "cbn_invoice_items_select"
  ON public.cbn_invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cbn_invoices ci
       WHERE ci.id = cbn_invoice_id
         AND (
           ci.organization_id = ANY(public.get_user_organization_ids())
           OR ci.counterparty_organization_id = ANY(public.get_user_organization_ids())
         )
    )
  );

CREATE POLICY "cbn_invoice_items_insert"
  ON public.cbn_invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = ANY(public.get_user_organization_ids())
  );

COMMENT ON TABLE public.cbn_invoice_items IS
  'Line-level snapshot of an invoice sent over the CBN. supplier_product_id is the sender''s product id, used to remember a buyer''s mapping decision; it is intentionally not a foreign key because it points into another tenant.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cbn_product_links — remembered product mappings
-- ─────────────────────────────────────────────────────────────────────────────
-- "This supplier's product X is my product Y." Recorded when the buyer accepts,
-- so repeat invoices resolve with no user input.

CREATE TABLE IF NOT EXISTS public.cbn_product_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The BUYER's org: this mapping is the buyer's private interpretation.
  organization_id     UUID NOT NULL REFERENCES public.organizations(id),
  connection_id       UUID NOT NULL REFERENCES public.business_connections(id) ON DELETE CASCADE,
  -- The counterparty's products.id — not a foreign key (other tenant).
  supplier_product_id UUID NOT NULL,
  -- The buyer's own product this maps to.
  product_id          UUID NOT NULL REFERENCES public.products(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES public.users(id),
  updated_by          UUID REFERENCES public.users(id),
  deleted_by          UUID REFERENCES public.users(id),
  version             INTEGER NOT NULL DEFAULT 1
);

-- One mapping per supplier product per connection.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbn_product_links_supplier_product
  ON public.cbn_product_links(organization_id, connection_id, supplier_product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cbn_product_links_product
  ON public.cbn_product_links(product_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER cbn_product_links_updated_at
  BEFORE UPDATE ON public.cbn_product_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cbn_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cbn_product_links_select"
  ON public.cbn_product_links FOR SELECT
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "cbn_product_links_insert"
  ON public.cbn_product_links FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "cbn_product_links_update"
  ON public.cbn_product_links FOR UPDATE
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()));

COMMENT ON TABLE public.cbn_product_links IS
  'Remembered "their product = my product" mappings, per connection. Lets repeat invoices from a connected business resolve to local products without asking again.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. send_cbn_invoice — also transmit the lines
-- ─────────────────────────────────────────────────────────────────────────────
-- Dropped and recreated rather than replaced so the SECURITY DEFINER +
-- search_path settings are restated explicitly. 20260630000009 exists precisely
-- because these RPCs were once SECURITY INVOKER and the whole CBN silently
-- failed against real RLS.

DROP FUNCTION IF EXISTS public.send_cbn_invoice(UUID, UUID);

CREATE FUNCTION public.send_cbn_invoice(
  p_invoice_id    UUID,
  p_connection_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_invoice       RECORD;
  v_conn          RECORD;
  v_my_org        UUID;
  v_buyer_org     UUID;
  v_caller_grants TEXT[];
  v_cbn_inv_id    UUID;
BEGIN
  -- 1. Load and lock the source invoice
  SELECT organization_id, invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status
    INTO v_invoice
    FROM public.invoices
   WHERE id = p_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'not_found: invoice';
  END IF;
  IF v_invoice.status <> 'posted' THEN
    RAISE EXCEPTION 'invalid_status: only posted invoices can be sent via CBN (current: %)', v_invoice.status;
  END IF;

  -- 2. Caller must belong to the invoice's org
  IF NOT public.is_org_member(v_invoice.organization_id) THEN
    RAISE EXCEPTION 'permission_denied: invoice does not belong to your organization';
  END IF;

  -- 3. cbn.sync permission
  IF NOT public.has_permission(v_invoice.organization_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 4. Load and validate the connection
  SELECT requester_organization_id, recipient_organization_id,
         status, requester_grants, recipient_grants
    INTO v_conn
    FROM public.business_connections
   WHERE id = p_connection_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;
  IF v_conn.status <> 'accepted' THEN
    RAISE EXCEPTION 'invalid_status: connection is not accepted (current: %)', v_conn.status;
  END IF;

  -- 5. Determine the caller's side of the connection
  IF v_invoice.organization_id = v_conn.requester_organization_id THEN
    v_my_org        := v_conn.requester_organization_id;
    v_buyer_org     := v_conn.recipient_organization_id;
    v_caller_grants := v_conn.requester_grants;
  ELSIF v_invoice.organization_id = v_conn.recipient_organization_id THEN
    v_my_org        := v_conn.recipient_organization_id;
    v_buyer_org     := v_conn.requester_organization_id;
    v_caller_grants := v_conn.recipient_grants;
  ELSE
    RAISE EXCEPTION 'permission_denied: invoice org is not a participant in this connection';
  END IF;

  -- 6. The grant must allow invoice exchange
  IF NOT ('receive_invoices' = ANY(v_caller_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_invoices permission not granted in this connection';
  END IF;

  -- 7. Prevent duplicate sends
  IF EXISTS (
    SELECT 1 FROM public.cbn_invoices
     WHERE source_invoice_id = p_invoice_id
       AND connection_id = p_connection_id
       AND deleted_at IS NULL
       AND status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'duplicate: this invoice has already been sent on this connection';
  END IF;

  -- 8. Header snapshot
  INSERT INTO public.cbn_invoices (
    organization_id, counterparty_organization_id, connection_id,
    source_invoice_id, invoice_number, invoice_date, due_date,
    subtotal, tax_amount, total_amount, currency, status,
    created_by, updated_by
  ) VALUES (
    v_my_org, v_buyer_org, p_connection_id,
    p_invoice_id, v_invoice.invoice_number, v_invoice.invoice_date, v_invoice.due_date,
    COALESCE(v_invoice.subtotal, 0), COALESCE(v_invoice.tax_amount, 0),
    COALESCE(v_invoice.total_amount, 0), 'INR', 'pending',
    v_user, v_user
  )
  RETURNING id INTO v_cbn_inv_id;

  -- 8b. Line snapshot. Joined to products for the matching hints; LEFT JOIN so a
  --     line whose product was since deleted still transmits.
  INSERT INTO public.cbn_invoice_items (
    cbn_invoice_id, organization_id, sort_order,
    supplier_product_id, product_name, product_sku, product_barcode, hsn_code,
    description, quantity, unit_price, discount_amount,
    taxable_amount, gst_rate, tax_amount, line_total,
    created_by, updated_by
  )
  SELECT
    v_cbn_inv_id,
    v_my_org,
    ii.sort_order,
    ii.product_id,
    p.name,
    p.sku,
    p.barcode,
    COALESCE(ii.hsn_code, p.hsn_code),
    ii.description,
    ii.quantity,
    ii.unit_price,
    ii.discount_amount,
    ii.taxable_amount,
    ii.gst_rate,
    ii.tax_amount,
    ii.line_total,
    v_user,
    v_user
  FROM public.invoice_items ii
  LEFT JOIN public.products p ON p.id = ii.product_id
  WHERE ii.invoice_id = p_invoice_id
  ORDER BY ii.sort_order;

  -- A posted invoice always has lines; zero here means the read was blocked or
  -- the source is corrupt. Better to fail than to deliver an empty document.
  IF NOT EXISTS (
    SELECT 1 FROM public.cbn_invoice_items WHERE cbn_invoice_id = v_cbn_inv_id
  ) THEN
    RAISE EXCEPTION 'validation: invoice has no line items to send';
  END IF;

  -- 9. Shared-document record (the human-facing audit trail)
  INSERT INTO public.cbn_shared_documents (
    organization_id, counterparty_organization_id, connection_id,
    document_type, document_reference_type, document_reference_id,
    document_number, document_date, amount, currency, status,
    created_by, updated_by
  ) VALUES (
    v_my_org, v_buyer_org, p_connection_id,
    'tax_invoice', 'invoice', p_invoice_id,
    v_invoice.invoice_number, v_invoice.invoice_date,
    COALESCE(v_invoice.total_amount, 0), 'INR', 'active',
    v_user, v_user
  );

  -- 10. Sender's counters
  UPDATE public.business_profiles
     SET total_invoices_sent = total_invoices_sent + 1, updated_by = v_user
   WHERE organization_id = v_my_org;

  -- 11. Event log
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'invoice.sent',
    v_user, v_my_org, v_buyer_org,
    'cbn_invoice', v_cbn_inv_id,
    jsonb_build_object('invoice_number', v_invoice.invoice_number),
    'success'
  );

  RETURN v_cbn_inv_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. accept_cbn_invoice — require a product mapping for every line
-- ─────────────────────────────────────────────────────────────────────────────
-- p_line_mappings is [{"cbn_invoice_item_id": uuid, "product_id": uuid}, ...].
-- Every line must be mapped: a bill missing lines is worse than one not created,
-- because it silently understates a payable and cannot be edited afterwards
-- (the bill form requires at least one item).

DROP FUNCTION IF EXISTS public.accept_cbn_invoice(UUID, UUID, TEXT);

CREATE FUNCTION public.accept_cbn_invoice(
  p_cbn_invoice_id UUID,
  p_buyer_org_id   UUID,
  p_notes          TEXT  DEFAULT NULL,
  p_line_mappings  JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_cbn           RECORD;
  v_conn          RECORD;
  v_supplier_gst  TEXT;
  v_supplier_id   UUID;
  v_pi_id         UUID;
  v_pi_num        TEXT;
  v_grants        TEXT[];
  v_line_count    INTEGER;
  v_mapped_count  INTEGER;
  v_bad_product   UUID;
  v_line_sum      NUMERIC(14, 2);
BEGIN
  -- 1. Load and lock the CBN invoice
  SELECT organization_id, counterparty_organization_id, connection_id,
         invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status
    INTO v_cbn
    FROM public.cbn_invoices
   WHERE id = p_cbn_invoice_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn invoice';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn invoice is not pending (current: %)', v_cbn.status;
  END IF;

  -- 2. Caller must be a member of the BUYER org
  IF v_cbn.counterparty_organization_id <> p_buyer_org_id THEN
    RAISE EXCEPTION 'validation: buyer org does not match the cbn invoice counterparty';
  END IF;
  IF NOT public.is_org_member(p_buyer_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the buyer organization';
  END IF;
  IF NOT public.has_permission(p_buyer_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 3. Connection must still be live and grant invoice receipt
  SELECT requester_organization_id, recipient_organization_id,
         requester_grants, recipient_grants
    INTO v_conn
    FROM public.business_connections
   WHERE id = v_cbn.connection_id AND deleted_at IS NULL;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;

  v_grants := CASE
    WHEN p_buyer_org_id = v_conn.requester_organization_id THEN v_conn.requester_grants
    ELSE v_conn.recipient_grants
  END;

  IF NOT ('receive_invoices' = ANY(v_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_invoices not in buyer grants';
  END IF;

  -- 4a. Preferred: the supplier bound to this connection when it was accepted.
  SELECT s.id INTO v_supplier_id
    FROM public.suppliers s
   WHERE s.organization_id = p_buyer_org_id
     AND s.cbn_connection_id = v_cbn.connection_id
     AND s.deleted_at IS NULL
   LIMIT 1;

  -- 4b. Fallback for connections predating party linking: match on GST number.
  IF v_supplier_id IS NULL THEN
    SELECT o.gst_number INTO v_supplier_gst
      FROM public.organizations o
     WHERE o.id = v_cbn.organization_id AND o.deleted_at IS NULL;

    IF v_supplier_gst IS NOT NULL THEN
      SELECT s.id INTO v_supplier_id
        FROM public.suppliers s
       WHERE s.organization_id = p_buyer_org_id
         AND s.gst_number = v_supplier_gst
         AND s.deleted_at IS NULL
         AND s.status = 'active'
       LIMIT 1;
    END IF;
  END IF;

  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'prerequisite: this connection is not linked to a supplier in your books. Open the connection and link a supplier, then accept the invoice again.';
  END IF;

  -- 5. Every transmitted line must carry a mapping.
  SELECT COUNT(*) INTO v_line_count
    FROM public.cbn_invoice_items
   WHERE cbn_invoice_id = p_cbn_invoice_id AND deleted_at IS NULL;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'prerequisite: this invoice was sent without line items and cannot be turned into a bill. Ask the sender to resend it.';
  END IF;

  SELECT COUNT(*) INTO v_mapped_count
    FROM public.cbn_invoice_items ci
    JOIN jsonb_array_elements(p_line_mappings) AS m
      ON (m->>'cbn_invoice_item_id')::uuid = ci.id
   WHERE ci.cbn_invoice_id = p_cbn_invoice_id
     AND ci.deleted_at IS NULL
     AND (m->>'product_id') IS NOT NULL;

  IF v_mapped_count <> v_line_count THEN
    RAISE EXCEPTION 'validation: every line must be matched to one of your products (% of % mapped)', v_mapped_count, v_line_count;
  END IF;

  -- 6. Never trust the client: every mapped product must be the buyer's own.
  SELECT (m->>'product_id')::uuid INTO v_bad_product
    FROM jsonb_array_elements(p_line_mappings) AS m
   WHERE NOT EXISTS (
     SELECT 1 FROM public.products p
      WHERE p.id = (m->>'product_id')::uuid
        AND p.organization_id = p_buyer_org_id
        AND p.deleted_at IS NULL
   )
   LIMIT 1;

  IF v_bad_product IS NOT NULL THEN
    RAISE EXCEPTION 'validation: product % does not belong to your organization', v_bad_product;
  END IF;

  -- 7. Bill number, derived from the sender's invoice number
  v_pi_num := 'SYNC-PI-' || v_cbn.invoice_number;

  -- 8. Draft bill header. The transmitted totals stay authoritative — they are
  --    the figures on the document the seller actually issued.
  INSERT INTO public.purchase_invoices (
    organization_id, invoice_number, invoice_date, due_date, supplier_id,
    subtotal, tax_amount, total_amount, status, notes, created_by, updated_by
  ) VALUES (
    p_buyer_org_id, v_pi_num, v_cbn.invoice_date, v_cbn.due_date, v_supplier_id,
    v_cbn.subtotal, v_cbn.tax_amount, v_cbn.total_amount, 'draft',
    COALESCE(p_notes, 'Auto-created from CBN invoice sync: ' || v_cbn.invoice_number),
    v_user, v_user
  )
  RETURNING id INTO v_pi_id;

  -- 9. Bill lines, each pointing at the buyer's own product.
  INSERT INTO public.purchase_invoice_items (
    organization_id, purchase_invoice_id, product_id, description,
    quantity, unit_price, tax_rate, tax_amount, line_total, created_by
  )
  SELECT
    p_buyer_org_id,
    v_pi_id,
    (m->>'product_id')::uuid,
    COALESCE(ci.description, ci.product_name),
    ci.quantity,
    ci.unit_price,
    ci.gst_rate,
    ci.tax_amount,
    ci.line_total,
    v_user
  FROM public.cbn_invoice_items ci
  JOIN jsonb_array_elements(p_line_mappings) AS m
    ON (m->>'cbn_invoice_item_id')::uuid = ci.id
  WHERE ci.cbn_invoice_id = p_cbn_invoice_id
    AND ci.deleted_at IS NULL
  ORDER BY ci.sort_order;

  -- 10. The lines must reconcile with the header they were sent alongside.
  --     A divergence means transport is buggy, not that the user did anything
  --     wrong — fail loudly rather than book a bill that does not add up.
  SELECT COALESCE(SUM(line_total), 0) INTO v_line_sum
    FROM public.purchase_invoice_items
   WHERE purchase_invoice_id = v_pi_id;

  IF ABS(v_line_sum - v_cbn.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'validation: line items total % does not match the invoice total %', v_line_sum, v_cbn.total_amount;
  END IF;

  -- 11. Remember the mappings so the next invoice needs no input.
  --     DISTINCT ON is required, not cosmetic: the same product can appear on
  --     two lines of one invoice, and ON CONFLICT DO UPDATE cannot touch the
  --     same row twice within a single statement.
  INSERT INTO public.cbn_product_links (
    organization_id, connection_id, supplier_product_id, product_id,
    created_by, updated_by
  )
  SELECT DISTINCT ON (ci.supplier_product_id)
    p_buyer_org_id,
    v_cbn.connection_id,
    ci.supplier_product_id,
    (m->>'product_id')::uuid,
    v_user,
    v_user
  FROM public.cbn_invoice_items ci
  JOIN jsonb_array_elements(p_line_mappings) AS m
    ON (m->>'cbn_invoice_item_id')::uuid = ci.id
  WHERE ci.cbn_invoice_id = p_cbn_invoice_id
    AND ci.deleted_at IS NULL
    AND ci.supplier_product_id IS NOT NULL
  ORDER BY ci.supplier_product_id, ci.sort_order
  ON CONFLICT (organization_id, connection_id, supplier_product_id)
    WHERE deleted_at IS NULL
  DO UPDATE SET product_id = EXCLUDED.product_id,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW();

  -- 12. Mark the CBN invoice accepted
  UPDATE public.cbn_invoices
     SET status                    = 'accepted',
         accepted_at               = NOW(),
         accepted_by               = v_user,
         buyer_purchase_invoice_id = v_pi_id,
         updated_by                = v_user
   WHERE id = p_cbn_invoice_id;

  -- 13. Buyer's counters
  UPDATE public.business_profiles
     SET total_invoices_received = total_invoices_received + 1, updated_by = v_user
   WHERE organization_id = p_buyer_org_id;

  -- 14. Event log
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_buyer_org_id, v_cbn.connection_id, 'invoice.accepted',
    v_user, p_buyer_org_id, v_cbn.organization_id,
    'cbn_invoice', p_cbn_invoice_id,
    jsonb_build_object(
      'invoice_number',            v_cbn.invoice_number,
      'buyer_purchase_invoice_id', v_pi_id,
      'line_count',                v_line_count
    ),
    'success'
  );

  RETURN v_pi_id;
END;
$$;
