-- =============================================================================
-- Migration: Seed marketplace permissions (Sprint 10, increment 1)
-- =============================================================================
-- Supplier/Product Marketplace browsing + own-listing management, and the
-- Reputation system (posting reviews of counterparties). Granted to the roles
-- that manage outward-facing commerce — Owner, Admin, Sales Executive — to
-- match the cbn.catalog grant pattern (20260628000014).
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('marketplace', 'view',   'marketplace.view',   'Browse the marketplace and view listings'),
  ('marketplace', 'manage', 'marketplace.manage', 'Create and manage your own marketplace listings'),
  ('marketplace', 'review', 'marketplace.review', 'Post reputation reviews of other businesses')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid),  -- Admin
    ('00000000-0000-0000-0000-000000000005'::uuid)   -- Sales Executive
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN ('marketplace.view', 'marketplace.manage', 'marketplace.review')
ON CONFLICT (role_id, permission_id) DO NOTHING;
