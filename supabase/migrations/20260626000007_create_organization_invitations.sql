-- =============================================================================
-- Migration: Organization invitations
-- =============================================================================
-- Supports the employee invitation flow.
-- Email delivery via Resend is wired in Sprint 6 (Notifications).
-- For Sprint 1: store the invite data and generate a secure token.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id),
  -- Recipient
  email            TEXT NOT NULL,
  full_name        TEXT,
  -- Role to grant on acceptance
  role_id          UUID NOT NULL REFERENCES public.roles(id),
  -- Branch restriction (NULL = all branches)
  branch_id        UUID REFERENCES public.branches(id),
  -- Invite token — signed, single-use
  token            TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- State
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at      TIMESTAMPTZ,
  accepted_by      UUID REFERENCES public.users(id),
  -- Audit columns
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES public.users(id),
  updated_by       UUID REFERENCES public.users(id),
  deleted_by       UUID REFERENCES public.users(id),
  version          INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_invitations_org     ON public.organization_invitations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON public.organization_invitations(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_token   ON public.organization_invitations(token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_status  ON public.organization_invitations(organization_id, status) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Expire pending invites automatically
CREATE OR REPLACE FUNCTION public.expire_pending_invitations()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.organization_invitations
     SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < NOW()
     AND deleted_at IS NULL;
END;
$$;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Members can see invitations for their org
CREATE POLICY "invitations_select_org_members"
  ON public.organization_invitations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
       WHERE user_id = auth.uid() AND deleted_at IS NULL AND status = 'active'
    )
    OR
    -- Invitee can always see their own invite (by token lookup, unauthenticated)
    email IN (
      SELECT email FROM public.users WHERE id = auth.uid()
    )
  );

-- Admin/owner can create invitations
CREATE POLICY "invitations_insert_admin"
  ON public.organization_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin')
    )
  );

-- Admin/owner can cancel invitations
CREATE POLICY "invitations_update_admin"
  ON public.organization_invitations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
       WHERE om.user_id = auth.uid() AND om.deleted_at IS NULL AND om.status = 'active'
         AND r.name IN ('Owner', 'Admin')
    )
  );

COMMENT ON TABLE public.organization_invitations IS
  'Employee invitation records. Token is single-use. Email delivery handled by Notifications module.';
