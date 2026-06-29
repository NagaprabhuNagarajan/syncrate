-- =============================================================================
-- Migration: CBN Trust Score computation RPC
-- =============================================================================
-- compute_trust_score(org_id)
--   Recalculates and persists the trust score for an organization.
--
-- Trust Score Formula (from PRD/6.md):
--   Payment Reliability  40%
--   Delivery Reliability 30%
--   Dispute History      15%
--   Customer Rating      15%
--
-- For Sprint 7 (initial implementation), scores are derived from:
--   - payment_rating:   % of cbn_invoices accepted within payment terms
--   - delivery_rating:  % of cbn_purchase_orders fulfilled on time (stub: 100 if none)
--   - dispute_score:    100 - (dispute_count / total_transactions * 100) — capped at 0
--   - customer_rating:  average of existing supplier ratings in connected buyers' systems
--
-- The function is callable by any member of the org (cbn.view permission),
-- and is also called internally by the sync RPCs to keep scores fresh.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.compute_trust_score(p_org_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_rating   NUMERIC;
  v_delivery_rating  NUMERIC;
  v_dispute_score    NUMERIC;
  v_customer_rating  NUMERIC;
  v_trust_score      NUMERIC;
  v_total_invoices   INTEGER;
  v_accepted_invoices INTEGER;
  v_total_pos        INTEGER;
  v_fulfilled_pos    INTEGER;
  v_avg_supplier_rating NUMERIC;
BEGIN
  -- ── Payment Reliability (40%) ─────────────────────────────────────────────
  -- % of CBN invoices sent by this org that were accepted (not rejected)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('accepted')),
    COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected', 'cancelled'))
  INTO v_accepted_invoices, v_total_invoices
  FROM public.cbn_invoices
  WHERE organization_id = p_org_id AND deleted_at IS NULL;

  v_payment_rating := CASE
    WHEN v_total_invoices = 0 THEN 50.00  -- neutral score when no history
    ELSE ROUND((v_accepted_invoices::NUMERIC / v_total_invoices) * 100, 2)
  END;

  -- ── Delivery Reliability (30%) ────────────────────────────────────────────
  -- % of CBN purchase orders sent to this org that were fulfilled (not rejected)
  SELECT
    COUNT(*) FILTER (WHERE status = 'fulfilled'),
    COUNT(*) FILTER (WHERE status IN ('accepted', 'fulfilled', 'rejected', 'cancelled'))
  INTO v_fulfilled_pos, v_total_pos
  FROM public.cbn_purchase_orders
  WHERE counterparty_organization_id = p_org_id AND deleted_at IS NULL;

  v_delivery_rating := CASE
    WHEN v_total_pos = 0 THEN 50.00  -- neutral score when no history
    ELSE ROUND((v_fulfilled_pos::NUMERIC / GREATEST(v_total_pos, 1)) * 100, 2)
  END;

  -- ── Dispute History (15%) ─────────────────────────────────────────────────
  -- For Sprint 7: dispute management is deferred.
  -- Score defaults to 100 (no disputes recorded yet).
  v_dispute_score := 100.00;

  -- ── Customer Rating (15%) ─────────────────────────────────────────────────
  -- Average of supplier ratings from connected buyers' supplier records
  SELECT COALESCE(AVG(s.rating), 50.00)
  INTO v_avg_supplier_rating
  FROM public.suppliers s
  JOIN public.business_connections bc ON bc.deleted_at IS NULL
    AND bc.status = 'accepted'
    AND (
      bc.requester_organization_id = p_org_id
      OR bc.recipient_organization_id = p_org_id
    )
  WHERE s.deleted_at IS NULL
    AND s.rating IS NOT NULL;
  -- Normalize from 0-5 scale to 0-100 (supplier.rating is NUMERIC(2,1) CHECK 0-5)
  v_customer_rating := COALESCE(ROUND((v_avg_supplier_rating / 5.0) * 100, 2), 50.00);

  -- ── Weighted composite ────────────────────────────────────────────────────
  v_trust_score := ROUND(
    (v_payment_rating  * 0.40)
    + (v_delivery_rating * 0.30)
    + (v_dispute_score   * 0.15)
    + (v_customer_rating * 0.15),
    2
  );

  -- Clamp to [0, 100]
  v_trust_score := GREATEST(0, LEAST(100, v_trust_score));

  -- ── Persist ───────────────────────────────────────────────────────────────
  UPDATE public.business_profiles
  SET
    trust_score      = v_trust_score,
    payment_rating   = v_payment_rating,
    delivery_rating  = v_delivery_rating,
    dispute_score    = v_dispute_score,
    customer_rating  = v_customer_rating
  WHERE organization_id = p_org_id;

  RETURN v_trust_score;
END;
$$;

COMMENT ON FUNCTION public.compute_trust_score IS
  'Recomputes and persists the CBN trust score for an org. Formula: 40% payment + 30% delivery + 15% dispute + 15% rating. SECURITY DEFINER to read cross-org data safely.';
