-- =============================================================================
-- Migration: Atomic payment event functions (RPC)
-- =============================================================================
-- Sprint 6: Two transactional Postgres functions mirror the Sprint-4/5 RPC
-- pattern. Every multi-table write happens in ONE database transaction so a
-- failure at any point leaves no partial state.
--
--   record_customer_payment(p_org_id, p_customer_id, p_amount, p_method,
--                           p_reference, p_payment_date, p_notes,
--                           p_payment_number, p_allocations JSONB)
--     1. INSERT customer_payments header
--     2. For each allocation: INSERT customer_payment_allocations,
--        UPDATE invoices.amount_paid and payment_status
--     3. CREDIT customer_ledger_entries (A/R balance decreases)
--     RETURNS: new customer_payment UUID
--
--   record_supplier_payment(p_org_id, p_supplier_id, p_amount, p_method,
--                           p_reference, p_payment_date, p_notes,
--                           p_payment_number, p_allocations JSONB)
--     1. INSERT supplier_payments header
--     2. For each allocation: INSERT supplier_payment_allocations,
--        UPDATE purchase_invoices.amount_paid and payment_status
--     3. DEBIT supplier_ledger_entries (A/P balance decreases)
--     RETURNS: new supplier_payment UUID
--
-- p_allocations shape: [{"invoice_id": "<uuid>", "amount": <numeric>}, ...]
--   Supplier variant uses "purchase_invoice_id" instead of "invoice_id".
--
-- SECURITY INVOKER: RLS enforces tenant isolation — the caller must belong
-- to the org. Guard violations raise exceptions the service layer maps to
-- typed error codes.
-- =============================================================================

-- ── Record a customer payment ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_org_id         UUID,
  p_customer_id    UUID,
  p_amount         NUMERIC,
  p_method         TEXT,
  p_reference      TEXT,
  p_payment_date   DATE,
  p_notes          TEXT,
  p_payment_number TEXT,
  p_allocations    JSONB  -- [{"invoice_id": "<uuid>", "amount": <numeric>}]
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_payment_id   UUID;
  v_alloc        JSONB;
  v_inv_id       UUID;
  v_alloc_amt    NUMERIC;
  v_new_paid     NUMERIC;
  v_inv_total    NUMERIC;
  v_last_balance NUMERIC;
BEGIN
  -- Verify customer exists in this org
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
     WHERE id = p_customer_id AND organization_id = p_org_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_found: customer';
  END IF;

  -- 1. Insert payment header
  INSERT INTO public.customer_payments (
    organization_id, payment_number, customer_id,
    payment_date, amount, payment_method, reference_number, notes,
    status, created_by)
  VALUES (
    p_org_id, p_payment_number, p_customer_id,
    COALESCE(p_payment_date, CURRENT_DATE), p_amount,
    COALESCE(p_method, 'cash'), p_reference, p_notes,
    'completed', v_user)
  RETURNING id INTO v_payment_id;

  -- 2. Process invoice allocations
  IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_inv_id    := (v_alloc->>'invoice_id')::UUID;
      v_alloc_amt := (v_alloc->>'amount')::NUMERIC;

      IF v_inv_id IS NULL OR v_alloc_amt IS NULL OR v_alloc_amt <= 0 THEN
        CONTINUE;
      END IF;

      -- Insert allocation record
      INSERT INTO public.customer_payment_allocations (
        organization_id, customer_payment_id, invoice_id, allocated_amount, created_by)
      VALUES (p_org_id, v_payment_id, v_inv_id, v_alloc_amt, v_user);

      -- Lock the invoice row and compute new amount_paid
      SELECT amount_paid + v_alloc_amt, total_amount
        INTO v_new_paid, v_inv_total
        FROM public.invoices
       WHERE id = v_inv_id AND organization_id = p_org_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found: invoice %', v_inv_id;
      END IF;

      UPDATE public.invoices
         SET amount_paid    = v_new_paid,
             payment_status = CASE
               WHEN v_new_paid >= v_inv_total THEN 'paid'
               WHEN v_new_paid >  0           THEN 'partial'
               ELSE                                'unpaid'
             END
       WHERE id = v_inv_id;
    END LOOP;
  END IF;

  -- 3. Credit the customer ledger (A/R decreases = customer owes us less)
  SELECT running_balance INTO v_last_balance
    FROM public.customer_ledger_entries
   WHERE customer_id = p_customer_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
  v_last_balance := COALESCE(v_last_balance, 0);

  INSERT INTO public.customer_ledger_entries (
    organization_id, customer_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    p_org_id, p_customer_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    'customer_payment', v_payment_id,
    'Payment received: ' || p_payment_number,
    0, p_amount, v_last_balance - p_amount, v_user);

  RETURN v_payment_id;
END;
$$;

-- ── Record a supplier payment ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_org_id         UUID,
  p_supplier_id    UUID,
  p_amount         NUMERIC,
  p_method         TEXT,
  p_reference      TEXT,
  p_payment_date   DATE,
  p_notes          TEXT,
  p_payment_number TEXT,
  p_allocations    JSONB  -- [{"purchase_invoice_id": "<uuid>", "amount": <numeric>}]
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user         UUID := auth.uid();
  v_payment_id   UUID;
  v_alloc        JSONB;
  v_pinv_id      UUID;
  v_alloc_amt    NUMERIC;
  v_new_paid     NUMERIC;
  v_pinv_total   NUMERIC;
  v_last_balance NUMERIC;
BEGIN
  -- Verify supplier exists in this org
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers
     WHERE id = p_supplier_id AND organization_id = p_org_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_found: supplier';
  END IF;

  -- 1. Insert payment header
  INSERT INTO public.supplier_payments (
    organization_id, payment_number, supplier_id,
    payment_date, amount, payment_method, reference_number, notes,
    status, created_by)
  VALUES (
    p_org_id, p_payment_number, p_supplier_id,
    COALESCE(p_payment_date, CURRENT_DATE), p_amount,
    COALESCE(p_method, 'bank_transfer'), p_reference, p_notes,
    'completed', v_user)
  RETURNING id INTO v_payment_id;

  -- 2. Process purchase invoice allocations
  IF p_allocations IS NOT NULL AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_pinv_id   := (v_alloc->>'purchase_invoice_id')::UUID;
      v_alloc_amt := (v_alloc->>'amount')::NUMERIC;

      IF v_pinv_id IS NULL OR v_alloc_amt IS NULL OR v_alloc_amt <= 0 THEN
        CONTINUE;
      END IF;

      -- Insert allocation record
      INSERT INTO public.supplier_payment_allocations (
        organization_id, supplier_payment_id, purchase_invoice_id,
        allocated_amount, created_by)
      VALUES (p_org_id, v_payment_id, v_pinv_id, v_alloc_amt, v_user);

      -- Lock the purchase invoice and compute new amount_paid
      SELECT amount_paid + v_alloc_amt, total_amount
        INTO v_new_paid, v_pinv_total
        FROM public.purchase_invoices
       WHERE id = v_pinv_id AND organization_id = p_org_id
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found: purchase_invoice %', v_pinv_id;
      END IF;

      UPDATE public.purchase_invoices
         SET amount_paid = v_new_paid
       WHERE id = v_pinv_id;
    END LOOP;
  END IF;

  -- 3. Debit the supplier ledger (A/P decreases = we owe supplier less)
  SELECT running_balance INTO v_last_balance
    FROM public.supplier_ledger_entries
   WHERE supplier_id = p_supplier_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
  v_last_balance := COALESCE(v_last_balance, 0);

  INSERT INTO public.supplier_ledger_entries (
    organization_id, supplier_id, entry_date, reference_type, reference_id,
    description, debit, credit, running_balance, created_by)
  VALUES (
    p_org_id, p_supplier_id,
    COALESCE(p_payment_date, CURRENT_DATE),
    'supplier_payment', v_payment_id,
    'Payment made: ' || p_payment_number,
    p_amount, 0, v_last_balance - p_amount, v_user);

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public.record_customer_payment IS
  'Atomic customer payment: header + invoice allocations + invoice status update + customer ledger credit.';
COMMENT ON FUNCTION public.record_supplier_payment IS
  'Atomic supplier payment: header + purchase invoice allocations + amount_paid update + supplier ledger debit.';
