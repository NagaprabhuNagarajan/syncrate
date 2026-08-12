-- =============================================================================
-- Migration: Complete the CBN document chain — PO line items + end-to-end trace
-- =============================================================================
-- The intended round trip is: buyer raises a PO → connected supplier receives an
-- SO → supplier converts it to an Invoice → buyer receives it back as a Bill.
-- Only the last hop worked.
--
-- accept_cbn_purchase_order had the same three defects the invoice path had
-- before 20260721000001:
--   * it inserted a sales_orders HEADER with no items, so the resulting SO could
--     never be converted ("Sales order has no line items to convert");
--   * it resolved the customer by GST guesswork rather than the connection link
--     added in 20260720000002;
--   * it hardcoded tax_amount = 0, silently dropping the tax the buyer sent.
--
-- Separately, the chain had no END-TO-END trace. Each hop recorded its immediate
-- parent, but the buyer's bill could never point back at the buyer's own PO —
-- and the buyer cannot derive it, because the middle of the chain (the
-- supplier's SO and invoice) lives in the supplier's tenant and is invisible
-- under RLS. The originating PO reference therefore has to travel with the
-- invoice.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rename cbn_product_links.supplier_product_id → counterparty_product_id
-- ─────────────────────────────────────────────────────────────────────────────
-- The column holds "the OTHER organization's product id". On the invoice path
-- that org is the supplier; on the PO path it is the buyer. Keeping "supplier"
-- in the name would be actively wrong for half the traffic.

ALTER TABLE public.cbn_product_links
  RENAME COLUMN supplier_product_id TO counterparty_product_id;

ALTER INDEX IF EXISTS uq_cbn_product_links_supplier_product
  RENAME TO uq_cbn_product_links_counterparty_product;

COMMENT ON COLUMN public.cbn_product_links.counterparty_product_id IS
  'The connected organization''s products.id. Not a foreign key — it points into another tenant.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cbn_purchase_order_items — the transmitted PO line snapshot
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors cbn_invoice_items exactly, including its RLS shape.

CREATE TABLE IF NOT EXISTS public.cbn_purchase_order_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cbn_purchase_order_id   UUID NOT NULL REFERENCES public.cbn_purchase_orders(id) ON DELETE CASCADE,
  -- Sender's org (the BUYER on this path). Denormalized so RLS needs no join.
  organization_id         UUID NOT NULL REFERENCES public.organizations(id),
  sort_order              INTEGER NOT NULL DEFAULT 0,

  -- The sender's products.id — the mapping key. Not a foreign key: other tenant.
  counterparty_product_id UUID,

  -- Matching hints, snapshotted so they stay true if the sender edits later.
  product_name            TEXT,
  product_sku             TEXT,
  product_barcode         TEXT,
  hsn_code                TEXT,

  -- Faithful copy of the line as ordered.
  description             TEXT,
  quantity                NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
  unit_price              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  taxable_amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gst_rate                NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  tax_amount              NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total              NUMERIC(14, 2) NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  created_by              UUID REFERENCES public.users(id),
  updated_by              UUID REFERENCES public.users(id),
  deleted_by              UUID REFERENCES public.users(id),
  version                 INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cbn_po_items_po
  ON public.cbn_purchase_order_items(cbn_purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cbn_po_items_org
  ON public.cbn_purchase_order_items(organization_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER cbn_purchase_order_items_updated_at
  BEFORE UPDATE ON public.cbn_purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cbn_purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Both sides read: the supplier must see the lines to map them.
CREATE POLICY "cbn_po_items_select"
  ON public.cbn_purchase_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cbn_purchase_orders cpo
       WHERE cpo.id = cbn_purchase_order_id
         AND (
           cpo.organization_id = ANY(public.get_user_organization_ids())
           OR cpo.counterparty_organization_id = ANY(public.get_user_organization_ids())
         )
    )
  );

CREATE POLICY "cbn_po_items_insert"
  ON public.cbn_purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

COMMENT ON TABLE public.cbn_purchase_order_items IS
  'Line-level snapshot of a purchase order sent over the CBN. counterparty_product_id is the sending org''s product id, used to remember the receiver''s mapping decision.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Carry the originating PO across the network
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cbn_invoices
  ADD COLUMN IF NOT EXISTS buyer_purchase_order_id UUID;

COMMENT ON COLUMN public.cbn_invoices.buyer_purchase_order_id IS
  'The BUYER''s purchase_orders.id that ultimately led to this invoice, when it came through the PO → SO → Invoice chain. Not a foreign key (other tenant at send time). Lets the buyer link the resulting bill back to their own PO, which they cannot derive locally because the intermediate documents are in the supplier''s tenant.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. send_cbn_purchase_order — also transmit the lines
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.send_cbn_purchase_order(UUID, UUID);

CREATE FUNCTION public.send_cbn_purchase_order(
  p_po_id         UUID,
  p_connection_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          UUID := auth.uid();
  v_po            RECORD;
  v_conn          RECORD;
  v_my_org        UUID;
  v_supplier_org  UUID;
  v_caller_grants TEXT[];
  v_cbn_po_id     UUID;
BEGIN
  -- 1. Load and lock the PO
  SELECT organization_id, po_number, order_date, expected_delivery_date,
         subtotal, tax_amount, total_amount, status
    INTO v_po
    FROM public.purchase_orders
   WHERE id = p_po_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_po IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase order';
  END IF;
  IF v_po.status NOT IN ('approved', 'ordered') THEN
    RAISE EXCEPTION 'invalid_status: only approved/ordered POs can be sent via CBN (current: %)', v_po.status;
  END IF;

  -- 2. Caller must belong to the PO's org
  IF NOT public.is_org_member(v_po.organization_id) THEN
    RAISE EXCEPTION 'permission_denied: purchase order does not belong to your organization';
  END IF;
  IF NOT public.has_permission(v_po.organization_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 3. Load and validate the connection
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

  -- 4. Determine the caller's side
  IF v_po.organization_id = v_conn.requester_organization_id THEN
    v_my_org        := v_conn.requester_organization_id;
    v_supplier_org  := v_conn.recipient_organization_id;
    v_caller_grants := v_conn.requester_grants;
  ELSIF v_po.organization_id = v_conn.recipient_organization_id THEN
    v_my_org        := v_conn.recipient_organization_id;
    v_supplier_org  := v_conn.requester_organization_id;
    v_caller_grants := v_conn.recipient_grants;
  ELSE
    RAISE EXCEPTION 'permission_denied: PO org is not a participant in this connection';
  END IF;

  -- 5. Grant must allow PO exchange
  IF NOT ('receive_purchase_orders' = ANY(v_caller_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_purchase_orders permission not granted in this connection';
  END IF;

  -- 6. Prevent duplicate sends
  IF EXISTS (
    SELECT 1 FROM public.cbn_purchase_orders
     WHERE source_purchase_order_id = p_po_id
       AND connection_id = p_connection_id
       AND deleted_at IS NULL
       AND status NOT IN ('rejected', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'duplicate: this purchase order has already been sent on this connection';
  END IF;

  -- 7. Header snapshot
  INSERT INTO public.cbn_purchase_orders (
    organization_id, counterparty_organization_id, connection_id,
    source_purchase_order_id, po_number, po_date, expected_delivery_date,
    subtotal, tax_amount, total_amount, currency, status,
    created_by, updated_by
  ) VALUES (
    v_my_org, v_supplier_org, p_connection_id,
    p_po_id, v_po.po_number, v_po.order_date, v_po.expected_delivery_date,
    COALESCE(v_po.subtotal, 0), COALESCE(v_po.tax_amount, 0),
    COALESCE(v_po.total_amount, 0), 'INR', 'pending',
    v_user, v_user
  )
  RETURNING id INTO v_cbn_po_id;

  -- 7b. Line snapshot. LEFT JOIN so a line whose product was since deleted
  --     still transmits. purchase_order_items stores the rate as `tax_rate`
  --     and has no taxable_amount column, so derive it rather than assume the
  --     column names line up with the invoice side.
  INSERT INTO public.cbn_purchase_order_items (
    cbn_purchase_order_id, organization_id, sort_order,
    counterparty_product_id, product_name, product_sku, product_barcode, hsn_code,
    description, quantity, unit_price, discount_amount,
    taxable_amount, gst_rate, tax_amount, line_total,
    created_by, updated_by
  )
  SELECT
    v_cbn_po_id,
    v_my_org,
    0,
    poi.product_id,
    p.name,
    p.sku,
    p.barcode,
    p.hsn_code,
    poi.description,
    poi.quantity,
    poi.unit_price,
    0,
    COALESCE(poi.line_total, 0) - COALESCE(poi.tax_amount, 0),
    poi.tax_rate,
    poi.tax_amount,
    poi.line_total,
    v_user,
    v_user
  FROM public.purchase_order_items poi
  LEFT JOIN public.products p ON p.id = poi.product_id
  WHERE poi.purchase_order_id = p_po_id;

  -- An approved PO always has lines; zero means the source is corrupt. Better
  -- to fail than to deliver a document the receiver cannot act on.
  IF NOT EXISTS (
    SELECT 1 FROM public.cbn_purchase_order_items
     WHERE cbn_purchase_order_id = v_cbn_po_id
  ) THEN
    RAISE EXCEPTION 'validation: purchase order has no line items to send';
  END IF;

  -- 8. Shared-document record
  INSERT INTO public.cbn_shared_documents (
    organization_id, counterparty_organization_id, connection_id,
    document_type, document_reference_type, document_reference_id,
    document_number, document_date, amount, currency, status,
    created_by, updated_by
  ) VALUES (
    v_my_org, v_supplier_org, p_connection_id,
    'purchase_order', 'cbn_purchase_order', v_cbn_po_id,
    v_po.po_number, v_po.order_date, COALESCE(v_po.total_amount, 0),
    'INR', 'active', v_user, v_user
  );

  -- 9. Sender's counters
  UPDATE public.business_profiles
     SET total_pos_sent = total_pos_sent + 1, updated_by = v_user
   WHERE organization_id = v_my_org;

  -- 10. Event log
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'purchase_order.sent',
    v_user, v_my_org, v_supplier_org,
    'cbn_purchase_order', v_cbn_po_id,
    jsonb_build_object('po_number', v_po.po_number),
    'success'
  );

  RETURN v_cbn_po_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. accept_cbn_purchase_order — map lines, keep the tax, use the party link
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.accept_cbn_purchase_order(UUID, UUID, TEXT);

CREATE FUNCTION public.accept_cbn_purchase_order(
  p_cbn_po_id       UUID,
  p_supplier_org_id UUID,
  p_notes           TEXT  DEFAULT NULL,
  p_line_mappings   JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_cbn          RECORD;
  v_conn         RECORD;
  v_buyer_gst    TEXT;
  v_customer_id  UUID;
  v_so_id        UUID;
  v_so_num       TEXT;
  v_grants       TEXT[];
  v_line_count   INTEGER;
  v_mapped_count INTEGER;
  v_bad_product  UUID;
  v_line_sum     NUMERIC(14, 2);
BEGIN
  -- 1. Load and lock the CBN purchase order
  SELECT organization_id, counterparty_organization_id, connection_id,
         po_number, po_date, expected_delivery_date,
         subtotal, tax_amount, total_amount, status
    INTO v_cbn
    FROM public.cbn_purchase_orders
   WHERE id = p_cbn_po_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_cbn IS NULL THEN
    RAISE EXCEPTION 'not_found: cbn purchase order';
  END IF;
  IF v_cbn.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: cbn purchase order is not pending (current: %)', v_cbn.status;
  END IF;

  -- 2. Caller must be a member of the SUPPLIER org
  IF v_cbn.counterparty_organization_id <> p_supplier_org_id THEN
    RAISE EXCEPTION 'validation: supplier org does not match the cbn purchase order counterparty';
  END IF;
  IF NOT public.is_org_member(p_supplier_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the supplier organization';
  END IF;
  IF NOT public.has_permission(p_supplier_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

  -- 3. Connection must be live and grant PO receipt
  SELECT requester_organization_id, recipient_organization_id,
         requester_grants, recipient_grants
    INTO v_conn
    FROM public.business_connections
   WHERE id = v_cbn.connection_id AND deleted_at IS NULL;

  IF v_conn IS NULL THEN
    RAISE EXCEPTION 'not_found: connection';
  END IF;

  v_grants := CASE
    WHEN p_supplier_org_id = v_conn.requester_organization_id THEN v_conn.requester_grants
    ELSE v_conn.recipient_grants
  END;

  IF NOT ('receive_purchase_orders' = ANY(v_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_purchase_orders not in supplier grants';
  END IF;

  -- 4a. Preferred: the customer bound to this connection when it was accepted.
  SELECT c.id INTO v_customer_id
    FROM public.customers c
   WHERE c.organization_id = p_supplier_org_id
     AND c.cbn_connection_id = v_cbn.connection_id
     AND c.deleted_at IS NULL
   LIMIT 1;

  -- 4b. Fallback for connections predating party linking: match on GST.
  IF v_customer_id IS NULL THEN
    SELECT o.gst_number INTO v_buyer_gst
      FROM public.organizations o
     WHERE o.id = v_cbn.organization_id AND o.deleted_at IS NULL;

    IF v_buyer_gst IS NOT NULL THEN
      SELECT c.id INTO v_customer_id
        FROM public.customers c
       WHERE c.organization_id = p_supplier_org_id
         AND c.gst_number = v_buyer_gst
         AND c.deleted_at IS NULL
         AND c.status = 'active'
       LIMIT 1;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'prerequisite: this connection is not linked to a customer in your books. Open the connection and link a customer, then accept the order again.';
  END IF;

  -- 5. Every transmitted line must carry a mapping.
  SELECT COUNT(*) INTO v_line_count
    FROM public.cbn_purchase_order_items
   WHERE cbn_purchase_order_id = p_cbn_po_id AND deleted_at IS NULL;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'prerequisite: this purchase order was sent without line items and cannot be turned into a sales order. Ask the sender to resend it.';
  END IF;

  SELECT COUNT(*) INTO v_mapped_count
    FROM public.cbn_purchase_order_items ci
    JOIN jsonb_array_elements(p_line_mappings) AS m
      ON (m->>'line_id')::uuid = ci.id
   WHERE ci.cbn_purchase_order_id = p_cbn_po_id
     AND ci.deleted_at IS NULL
     AND (m->>'product_id') IS NOT NULL;

  IF v_mapped_count <> v_line_count THEN
    RAISE EXCEPTION 'validation: every line must be matched to one of your products (% of % mapped)', v_mapped_count, v_line_count;
  END IF;

  -- 6. Never trust the client: every mapped product must be the supplier's own.
  SELECT (m->>'product_id')::uuid INTO v_bad_product
    FROM jsonb_array_elements(p_line_mappings) AS m
   WHERE NOT EXISTS (
     SELECT 1 FROM public.products p
      WHERE p.id = (m->>'product_id')::uuid
        AND p.organization_id = p_supplier_org_id
        AND p.deleted_at IS NULL
   )
   LIMIT 1;

  IF v_bad_product IS NOT NULL THEN
    RAISE EXCEPTION 'validation: product % does not belong to your organization', v_bad_product;
  END IF;

  -- 7. Sales order number, derived from the buyer's PO number
  v_so_num := 'SYNC-SO-' || v_cbn.po_number;

  -- 8. Draft sales order. The transmitted totals stay authoritative — including
  --    tax_amount, which the previous version hardcoded to zero and so silently
  --    discarded whatever the buyer had ordered.
  INSERT INTO public.sales_orders (
    organization_id, so_number, order_date, delivery_date, customer_id,
    subtotal, tax_amount, total_amount, status, notes, created_by, updated_by
  ) VALUES (
    p_supplier_org_id, v_so_num, v_cbn.po_date, v_cbn.expected_delivery_date,
    v_customer_id,
    COALESCE(v_cbn.subtotal, 0), COALESCE(v_cbn.tax_amount, 0),
    COALESCE(v_cbn.total_amount, 0), 'draft',
    COALESCE(p_notes, 'Auto-created from CBN purchase order sync: ' || v_cbn.po_number),
    v_user, v_user
  )
  RETURNING id INTO v_so_id;

  -- 9. Sales order lines, each pointing at the supplier's own product.
  INSERT INTO public.sales_order_items (
    organization_id, sales_order_id, product_id, description, hsn_code,
    quantity, unit_price, taxable_amount, gst_rate, tax_amount,
    line_total, sort_order, created_by
  )
  SELECT
    p_supplier_org_id,
    v_so_id,
    (m->>'product_id')::uuid,
    COALESCE(ci.description, ci.product_name),
    ci.hsn_code,
    ci.quantity,
    ci.unit_price,
    ci.taxable_amount,
    ci.gst_rate,
    ci.tax_amount,
    ci.line_total,
    ci.sort_order,
    v_user
  FROM public.cbn_purchase_order_items ci
  JOIN jsonb_array_elements(p_line_mappings) AS m
    ON (m->>'line_id')::uuid = ci.id
  WHERE ci.cbn_purchase_order_id = p_cbn_po_id
    AND ci.deleted_at IS NULL;

  -- 10. Lines must reconcile with the header they arrived with.
  SELECT COALESCE(SUM(line_total), 0) INTO v_line_sum
    FROM public.sales_order_items
   WHERE sales_order_id = v_so_id;

  IF ABS(v_line_sum - COALESCE(v_cbn.total_amount, 0)) > 0.01 THEN
    RAISE EXCEPTION 'validation: line items total % does not match the purchase order total %', v_line_sum, v_cbn.total_amount;
  END IF;

  -- 11. Remember the mappings. DISTINCT ON is required: the same product can
  --     appear on two lines, and ON CONFLICT DO UPDATE cannot touch one row
  --     twice in a single statement.
  INSERT INTO public.cbn_product_links (
    organization_id, connection_id, counterparty_product_id, product_id,
    created_by, updated_by
  )
  SELECT DISTINCT ON (ci.counterparty_product_id)
    p_supplier_org_id,
    v_cbn.connection_id,
    ci.counterparty_product_id,
    (m->>'product_id')::uuid,
    v_user,
    v_user
  FROM public.cbn_purchase_order_items ci
  JOIN jsonb_array_elements(p_line_mappings) AS m
    ON (m->>'line_id')::uuid = ci.id
  WHERE ci.cbn_purchase_order_id = p_cbn_po_id
    AND ci.deleted_at IS NULL
    AND ci.counterparty_product_id IS NOT NULL
  ORDER BY ci.counterparty_product_id, ci.sort_order
  ON CONFLICT (organization_id, connection_id, counterparty_product_id)
    WHERE deleted_at IS NULL
  DO UPDATE SET product_id = EXCLUDED.product_id,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW();

  -- 12. Mark the CBN purchase order accepted
  UPDATE public.cbn_purchase_orders
     SET status                  = 'accepted',
         accepted_at             = NOW(),
         accepted_by             = v_user,
         supplier_sales_order_id = v_so_id,
         updated_by              = v_user
   WHERE id = p_cbn_po_id;

  -- 13. Supplier's counters
  UPDATE public.business_profiles
     SET total_pos_received = total_pos_received + 1, updated_by = v_user
   WHERE organization_id = p_supplier_org_id;

  -- 14. Event log
  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    p_supplier_org_id, v_cbn.connection_id, 'purchase_order.accepted',
    v_user, p_supplier_org_id, v_cbn.organization_id,
    'cbn_purchase_order', p_cbn_po_id,
    jsonb_build_object(
      'po_number',               v_cbn.po_number,
      'supplier_sales_order_id', v_so_id,
      'line_count',              v_line_count
    ),
    'success'
  );

  RETURN v_so_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. send_cbn_invoice — carry the originating PO reference
-- ─────────────────────────────────────────────────────────────────────────────
-- Identical to 20260721000001 apart from resolving buyer_purchase_order_id.

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
  v_buyer_po_id   UUID;
BEGIN
  SELECT organization_id, invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status, sales_order_id
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

  IF NOT public.is_org_member(v_invoice.organization_id) THEN
    RAISE EXCEPTION 'permission_denied: invoice does not belong to your organization';
  END IF;
  IF NOT public.has_permission(v_invoice.organization_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

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

  IF NOT ('receive_invoices' = ANY(v_caller_grants)) THEN
    RAISE EXCEPTION 'permission_denied: receive_invoices permission not granted in this connection';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cbn_invoices
     WHERE source_invoice_id = p_invoice_id
       AND connection_id = p_connection_id
       AND deleted_at IS NULL
       AND status <> 'rejected'
  ) THEN
    RAISE EXCEPTION 'duplicate: this invoice has already been sent on this connection';
  END IF;

  -- Close the chain: if this invoice came from a sales order that itself came
  -- from the buyer's purchase order, carry that PO id along. The buyer cannot
  -- work this out on their own — the sales order and this invoice both live in
  -- the seller's tenant and are invisible to them under RLS.
  IF v_invoice.sales_order_id IS NOT NULL THEN
    SELECT cpo.source_purchase_order_id INTO v_buyer_po_id
      FROM public.cbn_purchase_orders cpo
     WHERE cpo.supplier_sales_order_id = v_invoice.sales_order_id
       AND cpo.connection_id = p_connection_id
       AND cpo.deleted_at IS NULL
     LIMIT 1;
  END IF;

  INSERT INTO public.cbn_invoices (
    organization_id, counterparty_organization_id, connection_id,
    source_invoice_id, invoice_number, invoice_date, due_date,
    subtotal, tax_amount, total_amount, currency, status,
    buyer_purchase_order_id, created_by, updated_by
  ) VALUES (
    v_my_org, v_buyer_org, p_connection_id,
    p_invoice_id, v_invoice.invoice_number, v_invoice.invoice_date, v_invoice.due_date,
    COALESCE(v_invoice.subtotal, 0), COALESCE(v_invoice.tax_amount, 0),
    COALESCE(v_invoice.total_amount, 0), 'INR', 'pending',
    v_buyer_po_id, v_user, v_user
  )
  RETURNING id INTO v_cbn_inv_id;

  INSERT INTO public.cbn_invoice_items (
    cbn_invoice_id, organization_id, sort_order,
    supplier_product_id, product_name, product_sku, product_barcode, hsn_code,
    description, quantity, unit_price, discount_amount,
    taxable_amount, gst_rate, tax_amount, line_total,
    created_by, updated_by
  )
  SELECT
    v_cbn_inv_id, v_my_org, ii.sort_order, ii.product_id,
    p.name, p.sku, p.barcode, COALESCE(ii.hsn_code, p.hsn_code),
    ii.description, ii.quantity, ii.unit_price, ii.discount_amount,
    ii.taxable_amount, ii.gst_rate, ii.tax_amount, ii.line_total,
    v_user, v_user
  FROM public.invoice_items ii
  LEFT JOIN public.products p ON p.id = ii.product_id
  WHERE ii.invoice_id = p_invoice_id
  ORDER BY ii.sort_order;

  IF NOT EXISTS (
    SELECT 1 FROM public.cbn_invoice_items WHERE cbn_invoice_id = v_cbn_inv_id
  ) THEN
    RAISE EXCEPTION 'validation: invoice has no line items to send';
  END IF;

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

  UPDATE public.business_profiles
     SET total_invoices_sent = total_invoices_sent + 1, updated_by = v_user
   WHERE organization_id = v_my_org;

  INSERT INTO public.cbn_events (
    organization_id, connection_id, event_type,
    actor_user_id, source_organization_id, target_organization_id,
    reference_type, reference_id, metadata, status
  ) VALUES (
    v_my_org, p_connection_id, 'invoice.sent',
    v_user, v_my_org, v_buyer_org,
    'cbn_invoice', v_cbn_inv_id,
    jsonb_build_object(
      'invoice_number',          v_invoice.invoice_number,
      'buyer_purchase_order_id', v_buyer_po_id
    ),
    'success'
  );

  RETURN v_cbn_inv_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. accept_cbn_invoice — stamp the bill with the buyer's own PO
-- ─────────────────────────────────────────────────────────────────────────────
-- Identical to 20260721000001 apart from the purchase_order_id link and the
-- renamed cbn_product_links column.

DROP FUNCTION IF EXISTS public.accept_cbn_invoice(UUID, UUID, TEXT, JSONB);

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
  v_po_id         UUID;
BEGIN
  SELECT organization_id, counterparty_organization_id, connection_id,
         invoice_number, invoice_date, due_date,
         subtotal, tax_amount, total_amount, status, buyer_purchase_order_id
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

  IF v_cbn.counterparty_organization_id <> p_buyer_org_id THEN
    RAISE EXCEPTION 'validation: buyer org does not match the cbn invoice counterparty';
  END IF;
  IF NOT public.is_org_member(p_buyer_org_id) THEN
    RAISE EXCEPTION 'permission_denied: not a member of the buyer organization';
  END IF;
  IF NOT public.has_permission(p_buyer_org_id, 'cbn.sync') THEN
    RAISE EXCEPTION 'permission_denied: cbn.sync permission required';
  END IF;

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

  SELECT s.id INTO v_supplier_id
    FROM public.suppliers s
   WHERE s.organization_id = p_buyer_org_id
     AND s.cbn_connection_id = v_cbn.connection_id
     AND s.deleted_at IS NULL
   LIMIT 1;

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

  SELECT COUNT(*) INTO v_line_count
    FROM public.cbn_invoice_items
   WHERE cbn_invoice_id = p_cbn_invoice_id AND deleted_at IS NULL;

  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'prerequisite: this invoice was sent without line items and cannot be turned into a bill. Ask the sender to resend it.';
  END IF;

  SELECT COUNT(*) INTO v_mapped_count
    FROM public.cbn_invoice_items ci
    JOIN jsonb_array_elements(p_line_mappings) AS m
      ON (m->>'line_id')::uuid = ci.id
   WHERE ci.cbn_invoice_id = p_cbn_invoice_id
     AND ci.deleted_at IS NULL
     AND (m->>'product_id') IS NOT NULL;

  IF v_mapped_count <> v_line_count THEN
    RAISE EXCEPTION 'validation: every line must be matched to one of your products (% of % mapped)', v_mapped_count, v_line_count;
  END IF;

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

  -- The originating PO travelled with the invoice, but a transmitted id is
  -- untrusted input — only link it if it really is one of this buyer's POs.
  IF v_cbn.buyer_purchase_order_id IS NOT NULL THEN
    SELECT po.id INTO v_po_id
      FROM public.purchase_orders po
     WHERE po.id = v_cbn.buyer_purchase_order_id
       AND po.organization_id = p_buyer_org_id
       AND po.deleted_at IS NULL;
  END IF;

  v_pi_num := 'SYNC-PI-' || v_cbn.invoice_number;

  INSERT INTO public.purchase_invoices (
    organization_id, invoice_number, invoice_date, due_date, supplier_id,
    purchase_order_id, subtotal, tax_amount, total_amount, status, notes,
    created_by, updated_by
  ) VALUES (
    p_buyer_org_id, v_pi_num, v_cbn.invoice_date, v_cbn.due_date, v_supplier_id,
    v_po_id, v_cbn.subtotal, v_cbn.tax_amount, v_cbn.total_amount, 'draft',
    COALESCE(p_notes, 'Auto-created from CBN invoice sync: ' || v_cbn.invoice_number),
    v_user, v_user
  )
  RETURNING id INTO v_pi_id;

  INSERT INTO public.purchase_invoice_items (
    organization_id, purchase_invoice_id, product_id, description,
    quantity, unit_price, tax_rate, tax_amount, line_total, created_by
  )
  SELECT
    p_buyer_org_id, v_pi_id, (m->>'product_id')::uuid,
    COALESCE(ci.description, ci.product_name),
    ci.quantity, ci.unit_price, ci.gst_rate, ci.tax_amount, ci.line_total,
    v_user
  FROM public.cbn_invoice_items ci
  JOIN jsonb_array_elements(p_line_mappings) AS m
    ON (m->>'line_id')::uuid = ci.id
  WHERE ci.cbn_invoice_id = p_cbn_invoice_id
    AND ci.deleted_at IS NULL
  ORDER BY ci.sort_order;

  SELECT COALESCE(SUM(line_total), 0) INTO v_line_sum
    FROM public.purchase_invoice_items
   WHERE purchase_invoice_id = v_pi_id;

  IF ABS(v_line_sum - v_cbn.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'validation: line items total % does not match the invoice total %', v_line_sum, v_cbn.total_amount;
  END IF;

  INSERT INTO public.cbn_product_links (
    organization_id, connection_id, counterparty_product_id, product_id,
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
    ON (m->>'line_id')::uuid = ci.id
  WHERE ci.cbn_invoice_id = p_cbn_invoice_id
    AND ci.deleted_at IS NULL
    AND ci.supplier_product_id IS NOT NULL
  ORDER BY ci.supplier_product_id, ci.sort_order
  ON CONFLICT (organization_id, connection_id, counterparty_product_id)
    WHERE deleted_at IS NULL
  DO UPDATE SET product_id = EXCLUDED.product_id,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW();

  UPDATE public.cbn_invoices
     SET status                    = 'accepted',
         accepted_at               = NOW(),
         accepted_by               = v_user,
         buyer_purchase_invoice_id = v_pi_id,
         updated_by                = v_user
   WHERE id = p_cbn_invoice_id;

  UPDATE public.business_profiles
     SET total_invoices_received = total_invoices_received + 1, updated_by = v_user
   WHERE organization_id = p_buyer_org_id;

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
      'linked_purchase_order_id',  v_po_id,
      'line_count',                v_line_count
    ),
    'success'
  );

  RETURN v_pi_id;
END;
$$;
