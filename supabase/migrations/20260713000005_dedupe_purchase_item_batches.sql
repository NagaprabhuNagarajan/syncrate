-- ─────────────────────────────────────────────────────────────────────────────
-- One-off cleanup: remove duplicate purchase line-item rows left behind by the
-- missing-DELETE-policy bug (fixed in 20260713000004).
--
-- Before the fix, editing a draft bill / purchase order / purchase request ran a
-- delete-all-then-insert that silently deleted nothing, so each edit APPENDED a
-- fresh copy of the full item list. Items are only ever written in whole batches
-- (create-once, or delete-replace) and never appended incrementally, so for any
-- parent the rows all share one `created_at` per batch, and the batch with the
-- greatest `created_at` is the last edit's complete, correct item set.
--
-- This deletes every item row that is NOT part of its parent's latest batch,
-- but only for parents that actually have more than one batch (i.e. were
-- affected). Parents with a single batch are left untouched.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t         TEXT;
  fk        TEXT;
  del_count BIGINT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_invoice_items',
    'purchase_order_items',
    'purchase_request_items'
  ]
  LOOP
    fk := CASE t
      WHEN 'purchase_invoice_items' THEN 'purchase_invoice_id'
      WHEN 'purchase_order_items'   THEN 'purchase_order_id'
      WHEN 'purchase_request_items' THEN 'purchase_request_id'
    END;

    EXECUTE format($f$
      WITH latest AS (
        SELECT %1$I AS parent_id, MAX(created_at) AS max_created
        FROM public.%2$I
        GROUP BY %1$I
        HAVING COUNT(DISTINCT created_at) > 1
      )
      DELETE FROM public.%2$I AS i
      USING latest AS l
      WHERE i.%1$I = l.parent_id
        AND i.created_at < l.max_created
    $f$, fk, t);

    GET DIAGNOSTICS del_count = ROW_COUNT;
    RAISE NOTICE 'Deduped %: removed % stale item row(s)', t, del_count;
  END LOOP;
END $$;
