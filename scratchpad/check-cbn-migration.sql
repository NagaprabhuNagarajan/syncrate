-- Is migration 20260721000001 actually applied?
-- 1. Does the line-items table exist at all?
SELECT to_regclass('public.cbn_invoice_items') AS cbn_invoice_items_table,
       to_regclass('public.cbn_product_links') AS cbn_product_links_table;

-- 2. Does accept_cbn_invoice take the new p_line_mappings argument?
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('send_cbn_invoice', 'accept_cbn_invoice');

-- 3. Which sent invoices carry lines, and which do not?
SELECT ci.invoice_number,
       ci.status,
       ci.total_amount,
       ci.created_at,
       COUNT(cii.id) AS line_count
  FROM public.cbn_invoices ci
  LEFT JOIN public.cbn_invoice_items cii
    ON cii.cbn_invoice_id = ci.id AND cii.deleted_at IS NULL
 WHERE ci.deleted_at IS NULL
 GROUP BY ci.id, ci.invoice_number, ci.status, ci.total_amount, ci.created_at
 ORDER BY ci.created_at DESC;
