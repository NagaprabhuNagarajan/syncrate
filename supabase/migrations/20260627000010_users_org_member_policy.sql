-- =============================================================================
-- Migration: users_select_org_members RLS policy
-- =============================================================================
-- Lets organization members read each other's user profiles. Defined here
-- (not in 20260626000001) because it references public.organization_members,
-- which is created in 20260626000005 — a forward reference would fail.
-- =============================================================================

CREATE POLICY "users_select_org_members"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT om.user_id
        FROM public.organization_members om
       WHERE om.organization_id IN (
         SELECT om2.organization_id
           FROM public.organization_members om2
          WHERE om2.user_id = auth.uid()
            AND om2.deleted_at IS NULL
       )
         AND om.deleted_at IS NULL
    )
  );
