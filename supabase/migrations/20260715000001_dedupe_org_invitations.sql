-- ─────────────────────────────────────────────────────────────────────────────
-- Enforce one invitation record per (organization, email).
--
-- The invite flow previously only checked for a *pending* duplicate, so an
-- email with a declined/expired/cancelled invitation could get a second row —
-- leaving the same address in, e.g., both "Pending" and "Declined" lists.
-- Invitations should be a single mutable record per (org, email), re-activated
-- on re-invite. This migration collapses existing duplicates and adds a unique
-- index as a hard backstop.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Soft-delete all but the most-recently-updated invitation for each
--    (organization_id, lower(email)).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(email)
      ORDER BY updated_at DESC, created_at DESC
    ) AS rn
  FROM public.organization_invitations
  WHERE deleted_at IS NULL
)
UPDATE public.organization_invitations AS i
SET deleted_at = NOW()
FROM ranked AS r
WHERE i.id = r.id
  AND r.rn > 1;

-- 2. Prevent any future duplicates at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invitations_org_email
  ON public.organization_invitations (organization_id, lower(email))
  WHERE deleted_at IS NULL;
