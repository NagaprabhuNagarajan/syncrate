-- =============================================================================
-- Migration: Create business_profiles
-- =============================================================================
-- CBN-specific metadata for each organization. 1:1 extension of organizations.
-- Stores trust score, verification level, discovery settings, and catalog toggle.
-- Auto-created when an organization is created (via trigger).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Verification (0=unverified, 1=email, 2=mobile, 3=gst, 4=document, 5=trusted)
  verification_level    INTEGER NOT NULL DEFAULT 0
                          CHECK (verification_level BETWEEN 0 AND 5),
  -- Trust Score: computed from payment history, delivery, disputes, ratings
  -- Range: 0.00–100.00
  trust_score           NUMERIC(5,2) NOT NULL DEFAULT 0.00
                          CHECK (trust_score BETWEEN 0 AND 100),
  -- Discovery
  is_discoverable       BOOLEAN NOT NULL DEFAULT true,
  -- Supplier catalog
  catalog_enabled       BOOLEAN NOT NULL DEFAULT false,
  -- CBN statistics (updated by RPCs after each sync event)
  total_connections     INTEGER NOT NULL DEFAULT 0,
  total_invoices_sent   INTEGER NOT NULL DEFAULT 0,
  total_invoices_received INTEGER NOT NULL DEFAULT 0,
  total_pos_sent        INTEGER NOT NULL DEFAULT 0,
  total_pos_received    INTEGER NOT NULL DEFAULT 0,
  -- Trust score components (cached for performance)
  payment_rating        NUMERIC(5,2) NOT NULL DEFAULT 0.00
                          CHECK (payment_rating BETWEEN 0 AND 100),
  delivery_rating       NUMERIC(5,2) NOT NULL DEFAULT 0.00
                          CHECK (delivery_rating BETWEEN 0 AND 100),
  dispute_score         NUMERIC(5,2) NOT NULL DEFAULT 100.00
                          CHECK (dispute_score BETWEEN 0 AND 100),
  customer_rating       NUMERIC(5,2) NOT NULL DEFAULT 0.00
                          CHECK (customer_rating BETWEEN 0 AND 100),
  -- Audit columns
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID REFERENCES public.users(id),
  updated_by            UUID REFERENCES public.users(id),
  deleted_by            UUID REFERENCES public.users(id),
  version               INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_profiles_org
  ON public.business_profiles(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_profiles_trust_score
  ON public.business_profiles(trust_score DESC) WHERE deleted_at IS NULL AND is_discoverable = true;
CREATE INDEX IF NOT EXISTS idx_business_profiles_discoverable
  ON public.business_profiles(is_discoverable) WHERE deleted_at IS NULL;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create business_profile when organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization_cbn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.business_profiles (organization_id, created_by)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orgs_create_business_profile
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_cbn();

-- RLS
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- Own org members can read and update their own profile
CREATE POLICY "business_profiles_select_own"
  ON public.business_profiles FOR SELECT
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()));

CREATE POLICY "business_profiles_update_own"
  ON public.business_profiles FOR UPDATE
  TO authenticated
  USING (organization_id = ANY(public.get_user_organization_ids()))
  WITH CHECK (organization_id = ANY(public.get_user_organization_ids()));

-- INSERT is handled exclusively by the trigger above (SECURITY DEFINER)
-- Direct inserts from clients are not needed.

COMMENT ON TABLE public.business_profiles IS
  'CBN metadata per organization: trust score, verification level, discovery settings.';
COMMENT ON COLUMN public.business_profiles.trust_score IS
  'Computed: 40% payment_rating + 30% delivery_rating + 15% dispute_score + 15% customer_rating.';
