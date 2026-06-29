-- =============================================================================
-- Migration: Make handle_updated_at() safe for tables without a `version` column
-- =============================================================================
-- handle_updated_at() unconditionally ran `NEW.version = OLD.version + 1`, but
-- it is also attached to tables that have NO `version` column — notably
-- `inventory` (a stock-level table). Any UPDATE to such a row raised
--   ERROR: record "new" has no field "version" (SQLSTATE 42703)
-- which broke transfer_stock and adjust_stock whenever the inventory row already
-- existed (i.e. any real stock movement after the first). Unit tests mock the
-- DB, so this only surfaced against live Postgres.
--
-- Fix: bump `version` only when the row actually has that field. to_jsonb(NEW)
-- exposes the row's columns, so `? 'version'` detects presence; the assignment
-- line is then skipped at runtime for version-less tables (plpgsql resolves NEW
-- field access at execution time, so guarding it avoids the error). Tables that
-- do have `version` keep optimistic-lock bumping unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  IF to_jsonb(NEW) ? 'version' THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
