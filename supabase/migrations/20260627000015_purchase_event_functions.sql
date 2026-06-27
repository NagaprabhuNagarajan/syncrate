-- =============================================================================
-- Migration: Atomic purchase event functions (RPC)
-- =============================================================================
-- Goods receipt, invoice posting, and return completion each touch several
-- tables (ledger / inventory / status). Doing that from the app layer is not
-- atomic — a mid-sequence failure leaves inconsistent financial/stock state.
-- These PL/pgSQL functions perform each operation in ONE transaction, reusing
-- the existing atomic adjust_stock() for inventory movements.
--
-- SECURITY INVOKER (default): RLS still enforces tenant isolation — the caller
-- can only write rows for organizations they belong to (WITH CHECK policies).
-- Guard violations surface as exceptions the service layer maps to error codes.
-- =============================================================================

-- ── Goods receipt: header + items + per-line purchase stock + PO status ───────
CREATE OR REPLACE FUNCTION public.receive_goods(
  p_organization_id   UUID,
  p_purchase_order_id UUID,
  p_warehouse_id      UUID,
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
    organization_id, grn_number, purchase_order_id, warehouse_id,
    received_date, status, notes, created_by)
  VALUES (
    p_organization_id, p_grn_number, p_purchase_order_id, p_warehouse_id,
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
        p_organization_id, (v_item->>'product_id')::UUID, p_warehouse_id,
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

-- ── Post a purchase invoice: mark posted + credit the supplier ledger ─────────
CREATE OR REPLACE FUNCTION public.post_purchase_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_org      UUID;
  v_supplier UUID;
  v_total    NUMERIC;
  v_status   TEXT;
  v_last     NUMERIC;
BEGIN
  SELECT organization_id, supplier_id, total_amount, status
    INTO v_org, v_supplier, v_total, v_status
    FROM public.purchase_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase invoice';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft invoices can be posted';
  END IF;

  UPDATE public.purchase_invoices
     SET status = 'posted', posted_at = NOW(), posted_by = v_user
   WHERE id = p_invoice_id;

  SELECT running_balance INTO v_last FROM public.supplier_ledger_entries
   WHERE supplier_id = v_supplier ORDER BY created_at DESC, id DESC LIMIT 1;
  v_last := COALESCE(v_last, 0);

  INSERT INTO public.supplier_ledger_entries (
    organization_id, supplier_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    v_org, v_supplier, CURRENT_DATE, 'purchase_invoice', p_invoice_id,
    'Purchase invoice posted', 0, v_total, v_last + v_total, v_user);
END;
$$;

-- ── Complete a purchase return: reverse stock + debit the supplier ledger ─────
CREATE OR REPLACE FUNCTION public.complete_purchase_return(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_org       UUID;
  v_supplier  UUID;
  v_warehouse UUID;
  v_total     NUMERIC;
  v_status    TEXT;
  v_last      NUMERIC;
  v_item      RECORD;
BEGIN
  SELECT organization_id, supplier_id, warehouse_id, total_amount, status
    INTO v_org, v_supplier, v_warehouse, v_total, v_status
    FROM public.purchase_returns WHERE id = p_return_id FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: purchase return';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft returns can be completed';
  END IF;
  IF v_warehouse IS NULL THEN
    RAISE EXCEPTION 'validation: purchase return has no warehouse';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity, batch_id
      FROM public.purchase_return_items WHERE purchase_return_id = p_return_id
  LOOP
    PERFORM public.adjust_stock(
      v_org, v_item.product_id, v_warehouse, -v_item.quantity, 'purchase_return',
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

COMMENT ON FUNCTION public.receive_goods IS 'Atomic goods receipt: header+items+purchase stock events+PO status.';
COMMENT ON FUNCTION public.post_purchase_invoice IS 'Atomic invoice posting: status + supplier ledger credit.';
COMMENT ON FUNCTION public.complete_purchase_return IS 'Atomic return: purchase_return stock events + supplier ledger debit.';
