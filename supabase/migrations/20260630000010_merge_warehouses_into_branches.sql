-- =============================================================================
-- Migration: Merge warehouses into branches (single "Branch" location concept)
-- =============================================================================
-- The app previously modelled two location concepts: `branches` (org locations)
-- and `warehouses` (inventory storage, each pointing at a branch). The product
-- decision is that a warehouse IS a branch, so we collapse to ONE concept:
-- `branches`. Every `warehouse_id` reference becomes `branch_id`, the stock RPCs
-- switch to p_branch_id, and the `warehouses` table is dropped.
--
-- Data is preserved: each warehouse is promoted to a branch (same id) so all
-- existing warehouse_id values remain valid as branch_id values.
-- (Assumes no warehouse code collides with an existing branch code in the same
-- org — true for the current/empty dataset.)
-- =============================================================================

-- Preserve warehouse street addresses on branches.
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address_line1 TEXT;

-- 1) Promote every warehouse to a branch (same id).
INSERT INTO public.branches
  (id, organization_id, name, code, city, state, pincode, address_line1,
   status, created_by, created_at, updated_at)
SELECT w.id, w.organization_id, w.name, w.code, w.city, w.state, w.pincode,
       w.address_line1, w.status, w.created_by, w.created_at, w.updated_at
FROM public.warehouses w
WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = w.id);

-- 2) Repoint every warehouse_id column to branch_id (-> branches). For tables
--    that already had an org-branch branch_id (sales_orders/invoices/returns),
--    the former warehouse becomes the single branch (org-branch column dropped).
DO $$
DECLARE
  r        RECORD;
  not_null BOOLEAN;
BEGIN
  FOR r IN
    SELECT table_name, is_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'warehouse_id'
  LOOP
    not_null := (r.is_nullable = 'NO');
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS branch_id', r.table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN branch_id UUID REFERENCES public.branches(id)', r.table_name);
    EXECUTE format('UPDATE public.%I SET branch_id = warehouse_id', r.table_name);
    IF not_null THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN branch_id SET NOT NULL', r.table_name);
    END IF;
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN warehouse_id', r.table_name);
  END LOOP;
END $$;

-- 3) Restore the inventory uniqueness (was product_id + warehouse_id).
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_product_branch_key UNIQUE (product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_branch
  ON public.inventory (branch_id);

-- 4) Drop the warehouses table (its policies/indexes/trigger go with it).
DROP TABLE IF EXISTS public.warehouses CASCADE;

-- =============================================================================
-- 5) Rewrite the stock RPCs to use branch_id. Internal error CODES
--    (negative_stock / insufficient_stock / same_warehouse / invalid_quantity)
--    are kept verbatim so the service-layer error mapping keeps working.
-- =============================================================================

DROP FUNCTION IF EXISTS public.adjust_stock(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID);
CREATE FUNCTION public.adjust_stock(
  p_organization_id UUID,
  p_product_id      UUID,
  p_branch_id       UUID,
  p_quantity        NUMERIC,
  p_type            TEXT,
  p_note            TEXT DEFAULT NULL,
  p_reference_type  TEXT DEFAULT NULL,
  p_reference_id    UUID DEFAULT NULL,
  p_batch_id        UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
  v_user    UUID := auth.uid();
BEGIN
  SELECT quantity INTO v_current
    FROM public.inventory
   WHERE product_id = p_product_id AND branch_id = p_branch_id
   FOR UPDATE;

  v_current := COALESCE(v_current, 0);
  v_new := v_current + p_quantity;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'negative_stock: adjustment would drive stock below zero';
  END IF;

  INSERT INTO public.inventory_transactions (
    organization_id, product_id, branch_id, batch_id, type, quantity,
    running_balance, reference_type, reference_id, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_branch_id, p_batch_id, p_type,
    p_quantity, v_new, p_reference_type, p_reference_id, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, branch_id, quantity)
  VALUES (p_organization_id, p_product_id, p_branch_id, v_new)
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET quantity = v_new, updated_at = NOW();

  RETURN v_new;
END;
$$;

DROP FUNCTION IF EXISTS public.transfer_stock(UUID, UUID, UUID, UUID, NUMERIC, TEXT, UUID);
CREATE FUNCTION public.transfer_stock(
  p_organization_id UUID,
  p_product_id      UUID,
  p_from_branch_id  UUID,
  p_to_branch_id    UUID,
  p_quantity        NUMERIC,
  p_note            TEXT DEFAULT NULL,
  p_batch_id        UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_from NUMERIC;
  v_to   NUMERIC;
  v_user UUID := auth.uid();
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: transfer quantity must be positive';
  END IF;
  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'same_warehouse: source and destination must differ';
  END IF;

  SELECT quantity INTO v_from
    FROM public.inventory
   WHERE product_id = p_product_id AND branch_id = p_from_branch_id
   FOR UPDATE;
  v_from := COALESCE(v_from, 0);

  IF v_from < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock: source branch has % but % requested', v_from, p_quantity;
  END IF;

  SELECT quantity INTO v_to
    FROM public.inventory
   WHERE product_id = p_product_id AND branch_id = p_to_branch_id
   FOR UPDATE;
  v_to := COALESCE(v_to, 0);

  INSERT INTO public.inventory_transactions (
    organization_id, product_id, branch_id, batch_id, type, quantity,
    running_balance, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_from_branch_id, p_batch_id, 'transfer_out',
    -p_quantity, v_from - p_quantity, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, branch_id, quantity)
  VALUES (p_organization_id, p_product_id, p_from_branch_id, v_from - p_quantity)
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET quantity = v_from - p_quantity, updated_at = NOW();

  INSERT INTO public.inventory_transactions (
    organization_id, product_id, branch_id, batch_id, type, quantity,
    running_balance, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_to_branch_id, p_batch_id, 'transfer_in',
    p_quantity, v_to + p_quantity, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, branch_id, quantity)
  VALUES (p_organization_id, p_product_id, p_to_branch_id, v_to + p_quantity)
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET quantity = v_to + p_quantity, updated_at = NOW();
END;
$$;

-- ── receive_goods: p_warehouse_id -> p_branch_id ─────────────────────────────
DROP FUNCTION IF EXISTS public.receive_goods(UUID, UUID, UUID, TEXT, DATE, TEXT, JSONB);
CREATE FUNCTION public.receive_goods(
  p_organization_id   UUID,
  p_purchase_order_id UUID,
  p_branch_id         UUID,
  p_grn_number        TEXT,
  p_received_date     DATE,
  p_notes             TEXT,
  p_items             JSONB
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_grn_id    UUID;
  v_item      JSONB;
  v_po_status TEXT;
  v_received  NUMERIC;
  v_remaining INTEGER;
  v_po_item   TEXT;
BEGIN
  SELECT status INTO v_po_status FROM public.purchase_orders
   WHERE id = p_purchase_order_id AND organization_id = p_organization_id;
  IF v_po_status IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase order';
  END IF;
  IF v_po_status NOT IN ('approved', 'ordered', 'partially_received') THEN
    RAISE EXCEPTION 'invalid_status: purchase order must be approved before receiving';
  END IF;

  INSERT INTO public.goods_receipts (
    organization_id, grn_number, purchase_order_id, branch_id,
    received_date, status, notes, created_by)
  VALUES (
    p_organization_id, p_grn_number, p_purchase_order_id, p_branch_id,
    COALESCE(p_received_date, CURRENT_DATE), 'completed', p_notes, v_user)
  RETURNING id INTO v_grn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_received := COALESCE((v_item->>'received_quantity')::NUMERIC, 0);
    v_po_item  := NULLIF(v_item->>'purchase_order_item_id', '');

    INSERT INTO public.goods_receipt_items (
      organization_id, goods_receipt_id, purchase_order_item_id, product_id,
      ordered_quantity, received_quantity, rejected_quantity, batch_id, created_by)
    VALUES (
      p_organization_id, v_grn_id, v_po_item::UUID, (v_item->>'product_id')::UUID,
      COALESCE((v_item->>'ordered_quantity')::NUMERIC, 0),
      v_received, COALESCE((v_item->>'rejected_quantity')::NUMERIC, 0),
      NULLIF(v_item->>'batch_id', '')::UUID, v_user);

    IF v_received > 0 THEN
      PERFORM public.adjust_stock(
        p_organization_id, (v_item->>'product_id')::UUID, p_branch_id,
        v_received, 'purchase', p_notes, 'goods_receipt', v_grn_id,
        NULLIF(v_item->>'batch_id', '')::UUID);

      IF v_po_item IS NOT NULL THEN
        UPDATE public.purchase_order_items
           SET received_quantity = received_quantity + v_received
         WHERE id = v_po_item::UUID;
      END IF;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_remaining FROM public.purchase_order_items
   WHERE purchase_order_id = p_purchase_order_id AND received_quantity < quantity;

  UPDATE public.purchase_orders
     SET status = CASE WHEN v_remaining = 0 THEN 'completed' ELSE 'partially_received' END
   WHERE id = p_purchase_order_id;

  RETURN v_grn_id;
END;
$$;

-- ── post_sales_invoice: read branch_id instead of warehouse_id ───────────────
CREATE OR REPLACE FUNCTION public.post_sales_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_org       UUID;
  v_customer  UUID;
  v_branch    UUID;
  v_total     NUMERIC;
  v_status    TEXT;
  v_last      NUMERIC;
  v_inv_num   TEXT;
  v_item      RECORD;
BEGIN
  SELECT organization_id, customer_id, branch_id, total_amount,
         status, invoice_number
    INTO v_org, v_customer, v_branch, v_total, v_status, v_inv_num
    FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: sales invoice';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft invoices can be posted';
  END IF;

  UPDATE public.invoices
     SET status = 'posted', posted_at = NOW(), posted_by = v_user
   WHERE id = p_invoice_id;

  IF v_branch IS NOT NULL THEN
    FOR v_item IN
      SELECT ii.product_id, ii.quantity, p.track_inventory
        FROM public.invoice_items ii
        JOIN public.products p ON p.id = ii.product_id
       WHERE ii.invoice_id = p_invoice_id
    LOOP
      IF v_item.track_inventory THEN
        PERFORM public.adjust_stock(
          v_org, v_item.product_id, v_branch, -v_item.quantity, 'sale',
          'Sales invoice posted: ' || v_inv_num, 'invoice', p_invoice_id, NULL::UUID);
      END IF;
    END LOOP;
  END IF;

  SELECT running_balance INTO v_last
    FROM public.customer_ledger_entries
   WHERE customer_id = v_customer
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
  v_last := COALESCE(v_last, 0);

  INSERT INTO public.customer_ledger_entries (
    organization_id, customer_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    v_org, v_customer, CURRENT_DATE, 'sales_invoice', p_invoice_id,
    'Sales invoice posted: ' || v_inv_num, v_total, 0, v_last + v_total, v_user);
END;
$$;

-- ── complete_sales_return: read branch_id instead of warehouse_id ────────────
CREATE OR REPLACE FUNCTION public.complete_sales_return(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_org       UUID;
  v_customer  UUID;
  v_branch    UUID;
  v_total     NUMERIC;
  v_status    TEXT;
  v_last      NUMERIC;
  v_ret_num   TEXT;
  v_item      RECORD;
  v_cn_number TEXT;
BEGIN
  SELECT organization_id, customer_id, branch_id, total_amount,
         status, return_number
    INTO v_org, v_customer, v_branch, v_total, v_status, v_ret_num
    FROM public.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: sales return';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft sales returns can be completed';
  END IF;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'validation: sales return has no branch assigned';
  END IF;

  FOR v_item IN
    SELECT sri.product_id, sri.quantity, sri.batch_id, p.track_inventory
      FROM public.sales_return_items sri
      JOIN public.products p ON p.id = sri.product_id
     WHERE sri.sales_return_id = p_return_id
  LOOP
    IF v_item.track_inventory THEN
      PERFORM public.adjust_stock(
        v_org, v_item.product_id, v_branch, v_item.quantity, 'sales_return',
        'Sales return: ' || v_ret_num, 'sales_return', p_return_id, v_item.batch_id);
    END IF;
  END LOOP;

  UPDATE public.sales_returns SET status = 'completed' WHERE id = p_return_id;

  SELECT running_balance INTO v_last
    FROM public.customer_ledger_entries
   WHERE customer_id = v_customer
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
  v_last := COALESCE(v_last, 0);

  INSERT INTO public.customer_ledger_entries (
    organization_id, customer_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    v_org, v_customer, CURRENT_DATE, 'sales_return', p_return_id,
    'Sales return completed: ' || v_ret_num, 0, v_total, v_last - v_total, v_user);

  v_cn_number := 'CN-' || v_ret_num;

  INSERT INTO public.credit_notes (
    organization_id, credit_note_number, customer_id,
    sales_return_id, issue_date, reason, amount, status, created_by)
  VALUES (
    v_org, v_cn_number, v_customer,
    p_return_id, CURRENT_DATE, 'Goods returned', v_total, 'active', v_user);
END;
$$;

-- ── complete_purchase_return: read branch_id instead of warehouse_id ─────────
CREATE OR REPLACE FUNCTION public.complete_purchase_return(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_org      UUID;
  v_supplier UUID;
  v_branch   UUID;
  v_total    NUMERIC;
  v_status   TEXT;
  v_last     NUMERIC;
  v_item     RECORD;
BEGIN
  SELECT organization_id, supplier_id, branch_id, total_amount, status
    INTO v_org, v_supplier, v_branch, v_total, v_status
    FROM public.purchase_returns WHERE id = p_return_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase return';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft returns can be completed';
  END IF;
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'validation: purchase return has no branch';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity, batch_id
      FROM public.purchase_return_items WHERE purchase_return_id = p_return_id
  LOOP
    PERFORM public.adjust_stock(
      v_org, v_item.product_id, v_branch, -v_item.quantity, 'purchase_return',
      'Purchase return', 'purchase_return', p_return_id, v_item.batch_id);
  END LOOP;

  UPDATE public.purchase_returns SET status = 'completed' WHERE id = p_return_id;

  SELECT running_balance INTO v_last FROM public.supplier_ledger_entries
   WHERE supplier_id = v_supplier ORDER BY created_at DESC, id DESC LIMIT 1;
  v_last := COALESCE(v_last, 0);

  INSERT INTO public.supplier_ledger_entries (
    organization_id, supplier_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    v_org, v_supplier, CURRENT_DATE, 'purchase_return', p_return_id,
    'Purchase return completed', v_total, 0, v_last - v_total, v_user);
END;
$$;
