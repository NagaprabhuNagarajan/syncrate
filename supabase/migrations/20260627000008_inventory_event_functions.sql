-- =============================================================================
-- Migration: Atomic inventory event functions (RPC)
-- =============================================================================
-- Inventory events write multiple rows (a ledger transaction + the stock
-- snapshot; transfers touch two of each). Doing this from the app layer is not
-- atomic. These PL/pgSQL functions perform each event in a single transaction
-- with row locking, so a partial write can never persist.
--
-- SECURITY INVOKER (default): the functions run as the calling user, so the
-- existing RLS policies on inventory / inventory_transactions still enforce
-- tenant isolation. Guard violations are raised as exceptions whose message the
-- service layer maps to typed error codes (negative_stock, insufficient_stock,
-- same_warehouse, invalid_quantity).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_organization_id UUID,
  p_product_id      UUID,
  p_warehouse_id    UUID,
  p_quantity        NUMERIC,   -- signed delta (+ increases, - decreases)
  p_type            TEXT,      -- 'adjustment' | 'damage' | 'opening' | ...
  p_note            TEXT DEFAULT NULL,
  p_reference_type  TEXT DEFAULT NULL,
  p_reference_id    UUID DEFAULT NULL,
  p_batch_id        UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
  v_user    UUID := auth.uid();
BEGIN
  SELECT quantity INTO v_current
    FROM public.inventory
   WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
   FOR UPDATE;

  v_current := COALESCE(v_current, 0);
  v_new := v_current + p_quantity;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'negative_stock: adjustment would drive stock below zero';
  END IF;

  INSERT INTO public.inventory_transactions (
    organization_id, product_id, warehouse_id, batch_id, type, quantity,
    running_balance, reference_type, reference_id, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_warehouse_id, p_batch_id, p_type,
    p_quantity, v_new, p_reference_type, p_reference_id, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity)
  VALUES (p_organization_id, p_product_id, p_warehouse_id, v_new)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = v_new, updated_at = NOW();

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_organization_id   UUID,
  p_product_id        UUID,
  p_from_warehouse_id UUID,
  p_to_warehouse_id   UUID,
  p_quantity          NUMERIC,   -- positive
  p_note              TEXT DEFAULT NULL,
  p_batch_id          UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_from NUMERIC;
  v_to   NUMERIC;
  v_user UUID := auth.uid();
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: transfer quantity must be positive';
  END IF;
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'same_warehouse: source and destination must differ';
  END IF;

  -- Lock source then destination (consistent order avoids deadlocks)
  SELECT quantity INTO v_from
    FROM public.inventory
   WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id
   FOR UPDATE;
  v_from := COALESCE(v_from, 0);

  IF v_from < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock: source warehouse has % but % requested', v_from, p_quantity;
  END IF;

  SELECT quantity INTO v_to
    FROM public.inventory
   WHERE product_id = p_product_id AND warehouse_id = p_to_warehouse_id
   FOR UPDATE;
  v_to := COALESCE(v_to, 0);

  -- Outbound leg
  INSERT INTO public.inventory_transactions (
    organization_id, product_id, warehouse_id, batch_id, type, quantity,
    running_balance, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_from_warehouse_id, p_batch_id, 'transfer_out',
    -p_quantity, v_from - p_quantity, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity)
  VALUES (p_organization_id, p_product_id, p_from_warehouse_id, v_from - p_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = v_from - p_quantity, updated_at = NOW();

  -- Inbound leg
  INSERT INTO public.inventory_transactions (
    organization_id, product_id, warehouse_id, batch_id, type, quantity,
    running_balance, note, created_by)
  VALUES (
    p_organization_id, p_product_id, p_to_warehouse_id, p_batch_id, 'transfer_in',
    p_quantity, v_to + p_quantity, p_note, v_user);

  INSERT INTO public.inventory (organization_id, product_id, warehouse_id, quantity)
  VALUES (p_organization_id, p_product_id, p_to_warehouse_id, v_to + p_quantity)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = v_to + p_quantity, updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.adjust_stock IS
  'Atomic stock adjustment: writes one ledger row + updates the snapshot.';
COMMENT ON FUNCTION public.transfer_stock IS
  'Atomic inter-warehouse transfer: writes transfer_out + transfer_in and updates both snapshots.';
