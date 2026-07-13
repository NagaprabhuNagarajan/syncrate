-- =============================================================================
-- apply_customer_credit — settle an invoice using a customer's existing
-- advance / on-account credit (the unallocated portion of prior payments).
--
-- Credit already lives on the customer ledger (each payment credited the full
-- amount when recorded), so applying it to an invoice is a pure re-allocation:
-- it draws down the unallocated balance of the customer's completed payments
-- (oldest first) into new allocation rows against the invoice, and bumps the
-- invoice's amount_paid / payment_status. NO new ledger entry is written — the
-- credit was already reflected in the balance when the payment was recorded.
--
-- Error codes raised (mapped to typed errors in the service layer):
--   not_found, invalid_status, validation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_customer_credit(
  p_org_id      UUID,
  p_customer_id UUID,
  p_invoice_id  UUID,
  p_amount      NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user        UUID := auth.uid();
  v_remaining   NUMERIC := p_amount;
  v_inv_total   NUMERIC;
  v_inv_paid    NUMERIC;
  v_inv_status  TEXT;
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

  -- Lock + validate the target invoice.
  SELECT total_amount, amount_paid, status
    INTO v_inv_total, v_inv_paid, v_inv_status
    FROM public.invoices
   WHERE id = p_invoice_id
     AND organization_id = p_org_id
     AND customer_id = p_customer_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF v_inv_total IS NULL THEN
    RAISE EXCEPTION 'not_found: invoice';
  END IF;
  IF v_inv_status <> 'posted' THEN
    RAISE EXCEPTION 'invalid_status: only posted invoices can be settled with credit';
  END IF;

  v_outstanding := v_inv_total - v_inv_paid;
  IF v_outstanding <= 0 THEN
    RAISE EXCEPTION 'validation: invoice has no outstanding balance';
  END IF;
  IF p_amount > v_outstanding THEN
    RAISE EXCEPTION 'validation: amount exceeds the invoice outstanding balance';
  END IF;

  -- Total available credit = sum over completed payments of (amount − allocated).
  SELECT COALESCE(SUM(cp.amount - COALESCE(alloc.sum_alloc, 0)), 0)
    INTO v_available
    FROM public.customer_payments cp
    LEFT JOIN (
      SELECT customer_payment_id, SUM(allocated_amount) AS sum_alloc
        FROM public.customer_payment_allocations
       GROUP BY customer_payment_id
    ) alloc ON alloc.customer_payment_id = cp.id
   WHERE cp.organization_id = p_org_id
     AND cp.customer_id = p_customer_id
     AND cp.status = 'completed';

  IF p_amount > v_available THEN
    RAISE EXCEPTION 'validation: amount exceeds the available credit';
  END IF;

  -- Draw down the oldest completed payments that still carry unallocated funds.
  FOR v_pay IN
    SELECT id, amount
      FROM public.customer_payments
     WHERE organization_id = p_org_id
       AND customer_id = p_customer_id
       AND status = 'completed'
     ORDER BY payment_date ASC, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    SELECT COALESCE(SUM(allocated_amount), 0)
      INTO v_alloc_sum
      FROM public.customer_payment_allocations
     WHERE customer_payment_id = v_pay.id;

    v_unallocated := v_pay.amount - v_alloc_sum;
    IF v_unallocated <= 0 THEN
      CONTINUE;
    END IF;

    v_alloc := LEAST(v_remaining, v_unallocated);
    INSERT INTO public.customer_payment_allocations (
      organization_id, customer_payment_id, invoice_id, allocated_amount, created_by)
    VALUES (p_org_id, v_pay.id, p_invoice_id, v_alloc, v_user);

    v_remaining := v_remaining - v_alloc;
  END LOOP;

  IF v_remaining > 0 THEN
    -- Should not happen (available credit was verified above), but guard anyway.
    RAISE EXCEPTION 'validation: could not fully allocate the requested credit';
  END IF;

  -- Bump the invoice. No ledger entry — the credit already reduced the balance
  -- when the underlying payment(s) were recorded.
  UPDATE public.invoices
     SET amount_paid    = v_inv_paid + p_amount,
         payment_status = CASE
           WHEN v_inv_paid + p_amount >= v_inv_total THEN 'paid'
           WHEN v_inv_paid + p_amount >  0           THEN 'partial'
           ELSE                                           'unpaid'
         END,
         updated_by = v_user,
         updated_at = NOW()
   WHERE id = p_invoice_id;
END;
$$;

COMMENT ON FUNCTION public.apply_customer_credit IS
  'Settles an invoice using a customer''s unallocated advance credit by drawing down prior payments (oldest first); no new ledger entry.';
