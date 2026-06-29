-- =============================================================================
-- Migration: Make CBN cross-org RPCs SECURITY DEFINER (they were SECURITY INVOKER)
-- =============================================================================
-- All eleven CBN connection + document-sync RPCs were declared plain
-- `LANGUAGE plpgsql` (i.e. SECURITY INVOKER) despite being designed to bypass
-- RLS — their bodies even comment "SECURITY DEFINER bypass via subquery" and
-- each performs its OWN caller authorization (is_org_member + has_permission)
-- precisely because RLS is meant to be bypassed.
--
-- Running as INVOKER, their cross-org reads/writes hit RLS as the caller, which
-- is own-org only. Result: request_business_connection always failed with
-- "target business not found or not discoverable" (it couldn't see the
-- recipient's business_profiles row), and the invoice/PO sync RPCs likewise
-- could not touch the counterparty's records. The entire Connected Business
-- Network was non-functional against real RLS. Unit tests mock the DB, so this
-- only surfaced in live end-to-end testing.
--
-- Fix: flip all eleven to SECURITY DEFINER + SET search_path = public (matching
-- the working CBN read RPCs like search_businesses). This is safe because each
-- function authorizes the caller against the relevant org before acting; the
-- auth helpers (is_org_member / has_permission) are themselves SECURITY DEFINER
-- and key off auth.uid(). Done via pg_proc so every overload/signature is
-- covered without restating bodies.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'request_business_connection',
         'accept_connection_request',
         'reject_connection_request',
         'disconnect_business',
         'update_connection_permissions',
         'send_cbn_invoice',
         'accept_cbn_invoice',
         'reject_cbn_invoice',
         'send_cbn_purchase_order',
         'accept_cbn_purchase_order',
         'reject_cbn_purchase_order'
       )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', r.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;
