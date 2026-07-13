-- ─────────────────────────────────────────────────────────────────────────────
-- Add DELETE RLS policies for purchase line-item tables.
--
-- These tables had SELECT / INSERT / UPDATE policies but NO DELETE policy. With
-- RLS enabled, a DELETE therefore matches zero rows *silently* (no error), so
-- the repositories' "replace items" flow (delete-all-then-insert) left the old
-- rows in place and appended the new ones — duplicating every line item on each
-- edit of a draft bill / purchase order / purchase request.
--
-- The policy mirrors the existing per-table `*_update` policy: a member may
-- delete item rows belonging to one of their organizations.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_invoice_items',
    'purchase_order_items',
    'purchase_request_items'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$I;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated
      USING (organization_id = ANY (public.get_user_organization_ids()));
    $f$, t);
  END LOOP;
END $$;
