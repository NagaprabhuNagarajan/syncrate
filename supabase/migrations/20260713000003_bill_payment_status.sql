-- =============================================================================
-- bill (purchase_invoices) payment_status — a STORED generated column so the
-- bill list can FILTER by payment status server-side (paid / partial / unpaid).
--
-- Bills have no payment_status of their own (unlike sales invoices); it was
-- derived in the UI from amount_paid vs total_amount. PostgREST can't compare
-- two columns in a filter, so a generated column is required to filter/paginate
-- by it. It recomputes automatically whenever amount_paid changes (e.g. when a
-- payment is recorded or credit applied).
--
-- "overdue" is time-dependent (due_date vs today) so it is NOT part of this
-- stored value; the list applies the overdue lens with an explicit due_date
-- condition on top of this column.
-- =============================================================================

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS payment_status TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN total_amount > 0 AND amount_paid >= total_amount THEN 'paid'
      WHEN amount_paid > 0                                   THEN 'partial'
      ELSE                                                       'unpaid'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_pinv_payment_status
  ON public.purchase_invoices (organization_id, payment_status)
  WHERE deleted_at IS NULL;
