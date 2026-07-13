-- =============================================================================
-- apply_supplier_credit — settle an outstanding bill (purchase invoice) using a
-- supplier's unallocated advance / on-account credit (the unallocated portion
-- of prior supplier payments).
--
-- Mirrors apply_customer_credit: the credit already lives on the supplier ledger
-- (each supplier payment debited A/P by the full amount when recorded), so this
-- is a pure re-allocation. It draws down the unallocated balance of the
-- supplier's completed payments (oldest first) into new allocation rows against
-- the bill, and bumps the bill's amount_paid. NO new ledger entry is written.
--
-- Error codes raised (mapped in the service layer): not_found, invalid_status,
-- validation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_supplier_credit(
  p_org_id      UUID,
  p_supplier_id UUID,
  p_bill_id     UUID,
  p_amount      NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_remaining   NUMERIC := p_amount;
  v_bill_total  NUMERIC;
  v_bill_paid   NUMERIC;
  v_bill_status TEXT;
  v_outstanding NUMERIC;
  v_available   NUMERIC;
  v_pay         RECORD;
  v_alloc_sum   NUMERIC;
  v_unallocated NUMERIC;
  v_alloc       NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'validation: amount must be greater than 0';
  END IF;

  -- Lock + validate the target bill (purchase invoice).
  SELECT total_amount, amount_paid, status
    INTO v_bill_total, v_bill_paid, v_bill_status
    FROM public.purchase_invoices
   WHERE id = p_bill_id
     AND organization_id = p_org_id
     AND supplier_id = p_supplier_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF v_bill_total IS NULL THEN
    RAISE EXCEPTION 'not_found: bill';
  END IF;
  IF v_bill_status <> 'posted' THEN
    RAISE EXCEPTION 'invalid_status: only posted bills can be settled with credit';
  END IF;

  v_outstanding := v_bill_total - v_bill_paid;
  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'validation: bill has no outstanding balance';
  END IF;
  IF p_amount > v_outstanding THEN
    RAISE EXCEPTION 'validation: amount exceeds the bill outstanding balance';
  END IF;

  -- Total available credit = sum over completed payments of (amount − allocated).
  SELECT COALESCE(SUM(sp.amount - COALESCE(alloc.sum_alloc, 0)), 0)
    INTO v_available
    FROM public.supplier_payments sp
    LEFT JOIN (
      SELECT supplier_payment_id, SUM(allocated_amount) AS sum_alloc
        FROM public.supplier_payment_allocations
       GROUP BY supplier_payment_id
    ) alloc ON alloc.supplier_payment_id = sp.id
   WHERE sp.organization_id = p_org_id
     AND sp.supplier_id = p_supplier_id
     AND sp.status = 'completed';

  IF p_amount > v_available THEN
    RAISE EXCEPTION 'validation: amount exceeds the available credit';
  END IF;

  -- Draw down the oldest completed payments that still carry unallocated funds.
  FOR v_pay IN
    SELECT id, amount
      FROM public.supplier_payments
     WHERE organization_id = p_org_id
       AND supplier_id = p_supplier_id
       AND status = 'completed'
     ORDER BY payment_date ASC, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    SELECT COALESCE(SUM(allocated_amount), 0)
      INTO v_alloc_sum
      FROM public.supplier_payment_allocations
     WHERE supplier_payment_id = v_pay.id;

    v_unallocated := v_pay.amount - v_alloc_sum;
    IF v_unallocated <= 0 THEN
      CONTINUE;
    END IF;

    v_alloc := LEAST(v_remaining, v_unallocated);
    INSERT INTO public.supplier_payment_allocations (
      organization_id, supplier_payment_id, purchase_invoice_id, allocated_amount, created_by)
    VALUES (p_org_id, v_pay.id, p_bill_id, v_alloc, v_user);

    v_remaining := v_remaining - v_alloc;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'validation: could not fully allocate the requested credit';
  END IF;

  -- Bump the bill. No ledger entry — the credit already reduced the supplier
  -- balance when the underlying payment(s) were recorded.
  UPDATE public.purchase_invoices
     SET amount_paid = v_bill_paid + p_amount,
         updated_by  = v_user,
         updated_at  = NOW()
   WHERE id = p_bill_id;
END;
$$;

COMMENT ON FUNCTION public.apply_supplier_credit IS
  'Settles a bill using a supplier''s unallocated advance credit by drawing down prior payments (oldest first); no new ledger entry.';
