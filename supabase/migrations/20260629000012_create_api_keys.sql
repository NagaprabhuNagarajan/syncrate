-- =============================================================================
-- Migration: Create api_keys (Sprint 9 — programmatic access credentials)
-- =============================================================================
-- Organization-scoped API keys for programmatic access. The raw secret is shown
-- to the user exactly ONCE at creation; only a SHA-256 hash is stored (never
-- the plaintext). A short, non-secret `key_prefix` is stored to let users
-- identify a key in the UI. Keys carry coarse scopes, optional expiry, and a
-- revoked_at tombstone (revocation is a soft, immutable action — we keep the
-- row for audit rather than deleting it).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name            TEXT NOT NULL,
  -- First chars of the key (e.g. "syk_live_a1b2") — non-secret, for display.
  key_prefix      TEXT NOT NULL,
  -- SHA-256 hex digest of the full key. Never store the plaintext.
  key_hash        TEXT NOT NULL,
  -- Coarse access scopes, e.g. {'read','write'} or 'invoice.read'.
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES public.users(id),
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.users(id),
  updated_by      UUID REFERENCES public.users(id)
);

-- The hash is globally unique (lookups during verification are by hash).
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org
  ON public.api_keys(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_active
  ON public.api_keys(organization_id)
  WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Members of the owning org can see their keys (metadata only — no plaintext
-- exists to leak). Cross-org access is prohibited.
CREATE POLICY "api_keys_select"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "api_keys_insert"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

CREATE POLICY "api_keys_update"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (organization_id = ANY (public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY (public.get_user_organization_ids()));

COMMENT ON TABLE public.api_keys IS
  'Organization-scoped API keys. Only the SHA-256 hash is stored; the plaintext is shown once at creation.';
COMMENT ON COLUMN public.api_keys.key_prefix IS
  'Non-secret leading characters of the key, shown in the UI to identify it.';
