-- =============================================================================
-- Migration: Atomic sales event functions (RPC)
-- =============================================================================
-- Two atomic operations mirror the purchase-side RPCs:
--
--   post_sales_invoice(invoice_id)
--     1. Lock invoice row; verify draft status
--     2. Mark status = 'posted', stamp posted_at / posted_by
--     3. Per invoice_item: call adjust_stock with event_type='sale' (NEGATIVE qty)
--        to deduct inventory
--     4. Append a DEBIT entry to customer_ledger_entries (A/R increases)
--
--   complete_sales_return(return_id)
--     1. Lock return row; verify draft status and warehouse
--     2. Per return_item: call adjust_stock with event_type='sales_return' (positive qty)
--        to add stock back
--     3. Mark status = 'completed'
--     4. Append a CREDIT entry to customer_ledger_entries (customer owes less)
--     5. Insert a credit_note record
--
-- SECURITY INVOKER: RLS enforces tenant isolation; the caller must belong
-- to the invoice/return's organization.
-- =============================================================================

-- ── Post a sales invoice ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_sales_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_org       UUID;
  v_customer  UUID;
  v_warehouse UUID;
  v_total     NUMERIC;
  v_status    TEXT;
  v_last      NUMERIC;
  v_inv_num   TEXT;
  v_item      RECORD;
BEGIN
  SELECT organization_id, customer_id, warehouse_id, total_amount,
         status, invoice_number
    INTO v_org, v_customer, v_warehouse, v_total, v_status, v_inv_num
    FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: sales invoice';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft invoices can be posted';
  END IF;

  -- Mark the invoice posted
  UPDATE public.invoices
     SET status     = 'posted',
         posted_at  = NOW(),
         posted_by  = v_user
   WHERE id = p_invoice_id;

  -- Deduct inventory per line (sale events are NEGATIVE quantities).
  -- Only deduct for products tracked in inventory when a warehouse is set.
  IF v_warehouse IS NOT NULL THEN
    FOR v_item IN
      SELECT ii.product_id, ii.quantity, p.track_inventory
        FROM public.invoice_items ii
        JOIN public.products p ON p.id = ii.product_id
       WHERE ii.invoice_id = p_invoice_id
    LOOP
      IF v_item.track_inventory THEN
        PERFORM public.adjust_stock(
          v_org,
          v_item.product_id,
          v_warehouse,
          -v_item.quantity,   -- negative = deduction
          'sale',
          'Sales invoice posted: ' || v_inv_num,
          'invoice',
          p_invoice_id,
          NULL::UUID          -- no batch_id on sale by default
        );
      END IF;
    END LOOP;
  END IF;

  -- Debit the customer ledger (receivable increases = debit)
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
    'Sales invoice posted: ' || v_inv_num,
    v_total, 0, v_last + v_total, v_user);
END;
$$;

-- ── Complete a sales return ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_sales_return(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_org          UUID;
  v_customer     UUID;
  v_warehouse    UUID;
  v_total        NUMERIC;
  v_status       TEXT;
  v_last         NUMERIC;
  v_ret_num      TEXT;
  v_item         RECORD;
  v_cn_number    TEXT;
BEGIN
  SELECT organization_id, customer_id, warehouse_id, total_amount,
         status, return_number
    INTO v_org, v_customer, v_warehouse, v_total, v_status, v_ret_num
    FROM public.sales_returns WHERE id = p_return_id FOR UPDATE;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found: sales return';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_status: only draft sales returns can be completed';
  END IF;
  IF v_warehouse IS NULL THEN
    RAISE EXCEPTION 'validation: sales return has no warehouse assigned';
  END IF;

  -- Add inventory back per return line
  FOR v_item IN
    SELECT sri.product_id, sri.quantity, sri.batch_id, p.track_inventory
      FROM public.sales_return_items sri
      JOIN public.products p ON p.id = sri.product_id
     WHERE sri.sales_return_id = p_return_id
  LOOP
    IF v_item.track_inventory THEN
      PERFORM public.adjust_stock(
        v_org,
        v_item.product_id,
        v_warehouse,
        v_item.quantity,        -- positive = stock addition
        'sales_return',
        'Sales return: ' || v_ret_num,
        'sales_return',
        p_return_id,
        v_item.batch_id
      );
    END IF;
  END LOOP;

  -- Mark return completed
  UPDATE public.sales_returns
     SET status = 'completed'
   WHERE id = p_return_id;

  -- Credit the customer ledger (A/R decreases = credit)
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
    'Sales return completed: ' || v_ret_num,
    0, v_total, v_last - v_total, v_user);

  -- Generate the credit note number (CN-<return_number>)
  v_cn_number := 'CN-' || v_ret_num;

  INSERT INTO public.credit_notes (
    organization_id, credit_note_number, customer_id,
    sales_return_id, issue_date, reason, amount, status, created_by)
  VALUES (
    v_org, v_cn_number, v_customer,
    p_return_id, CURRENT_DATE, 'Goods returned', v_total, 'active', v_user);
END;
$$;

COMMENT ON FUNCTION public.post_sales_invoice IS
  'Atomic invoice posting: status + inventory deduction (sale events) + customer ledger debit.';
COMMENT ON FUNCTION public.complete_sales_return IS
  'Atomic return: inventory addition (sales_return events) + customer ledger credit + credit note.';
