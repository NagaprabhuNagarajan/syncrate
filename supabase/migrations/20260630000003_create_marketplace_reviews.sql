-- =============================================================================
-- Migration: Create marketplace_reviews (Sprint 10 — Reputation System)
-- =============================================================================
-- A business reviews a counterparty it has transacted/connected with (CBN spec
-- §17 Business Reputation). Reputation aggregates are computed network-wide via
-- the SECURITY DEFINER functions get_organization_reputation /
-- list_organization_reviews (see 20260630000004). RLS here is own-org: a
-- reviewer manages the reviews IT authored.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The org that authored the review (the reviewer).
  organization_id          UUID NOT NULL REFERENCES public.organizations(id),
  -- The org being reviewed.
  subject_organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  rating                   INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title                    TEXT,
  comment                  TEXT,
  -- Optional context: the transaction/order this review relates to.
  reference_type           TEXT,
  reference_id             UUID,
  -- Would the reviewer recommend (drives reputation visibility).
  is_recommended           BOOLEAN NOT NULL DEFAULT true,
  -- Audit
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES public.users(id),
  updated_by               UUID REFERENCES public.users(id),
  deleted_by               UUID REFERENCES public.users(id),
  version                  INTEGER NOT NULL DEFAULT 1,
  -- A reviewer org leaves at most one (editable) review per subject org.
  CONSTRAINT uq_marketplace_review_pair
    UNIQUE (organization_id, subject_organization_id),
  -- Cannot review yourself.
  CONSTRAINT chk_marketplace_review_not_self
    CHECK (organization_id <> subject_organization_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_subject
  ON public.marketplace_reviews(subject_organization_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_author
  ON public.marketplace_reviews(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- OWN-ORG (as reviewer). Subjects read their reputation via SECURITY DEFINER fns.
CREATE POLICY "marketplace_reviews_select_own"
  ON public.marketplace_reviews FOR SELECT TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_reviews_insert_own"
  ON public.marketplace_reviews FOR INSERT TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));
CREATE POLICY "marketplace_reviews_update_own"
  ON public.marketplace_reviews FOR UPDATE TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.marketplace_reviews IS
  'Reputation reviews authored by one org about another. RLS own-org; network reputation via SECURITY DEFINER functions.';
