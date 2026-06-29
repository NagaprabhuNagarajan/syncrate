-- =============================================================================
-- Migration: Add business_id to organizations
-- =============================================================================
-- Every organization in the CBN receives a globally unique Business ID.
-- Format: SYN-{COUNTRY}-{6-digit-sequence}, e.g. SYN-IN-000001
-- IDs are permanent and never change once assigned.
-- =============================================================================

-- Sequence for the numeric part of the Business ID
CREATE SEQUENCE IF NOT EXISTS public.business_id_seq START 1;

-- Generator function
CREATE OR REPLACE FUNCTION public.generate_business_id(p_country TEXT DEFAULT 'IN')
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'SYN-' || UPPER(COALESCE(p_country, 'IN')) || '-'
    || LPAD(nextval('public.business_id_seq')::TEXT, 6, '0');
END;
$$;

-- Add the column (nullable initially so existing rows don't break)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS business_id TEXT UNIQUE;

-- Index for fast discovery lookups
CREATE INDEX IF NOT EXISTS idx_organizations_business_id
  ON public.organizations(business_id)
  WHERE business_id IS NOT NULL AND deleted_at IS NULL;

-- Auto-assign on INSERT (trigger runs after insert so we can use NEW.country)
CREATE OR REPLACE FUNCTION public.handle_org_business_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    NEW.business_id := public.generate_business_id(NEW.country);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orgs_assign_business_id
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_org_business_id();

COMMENT ON COLUMN public.organizations.business_id IS
  'Globally unique CBN identifier in format SYN-{COUNTRY}-{SEQ}. Permanent once assigned.';
COMMENT ON FUNCTION public.generate_business_id IS
  'Generates the next unique Business ID for CBN registration.';
