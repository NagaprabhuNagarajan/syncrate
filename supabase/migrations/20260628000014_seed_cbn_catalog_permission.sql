-- =============================================================================
-- Migration: Seed CBN catalog permission
-- =============================================================================
-- Adds the 'cbn.catalog' permission for suppliers managing their public catalog.
-- The three existing CBN permissions (cbn.connect, cbn.view, cbn.sync) were
-- seeded in 20260626000010 and cover discovery, connections, and sync.
-- This adds the catalog management permission and grants it to appropriate roles.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('cbn', 'catalog', 'cbn.catalog', 'Manage supplier product catalog for CBN')
ON CONFLICT (module, action) DO NOTHING;

-- Grant cbn.catalog to: Owner, Admin, Sales Executive (they manage the catalog)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
  ('00000000-0000-0000-0000-000000000002'::uuid),  -- Admin
  ('00000000-0000-0000-0000-000000000005'::uuid)   -- Sales Executive
) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.name = 'cbn.catalog'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also ensure all existing CBN permissions are granted to Owner+Admin
-- (they might have been added before this role existed — idempotent)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-000000000002'::uuid)
) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.module = 'cbn'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant cbn.view to: Branch Manager, Sales Executive, Accountant, Viewer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES
  ('00000000-0000-0000-0000-000000000003'::uuid),  -- Branch Manager
  ('00000000-0000-0000-0000-000000000004'::uuid),  -- Accountant
  ('00000000-0000-0000-0000-000000000005'::uuid),  -- Sales Executive
  ('00000000-0000-0000-0000-000000000009'::uuid)   -- Viewer
) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.name = 'cbn.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant cbn.sync to: Owner, Admin, Accountant, Sales Executive
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-000000000002'::uuid),
  ('00000000-0000-0000-0000-000000000004'::uuid),
  ('00000000-0000-0000-0000-000000000005'::uuid)
) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.name = 'cbn.sync'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant cbn.connect to: Owner, Admin (connection decisions are management-level)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid),
  ('00000000-0000-0000-0000-000000000002'::uuid)
) AS r(role_id)
CROSS JOIN public.permissions p
WHERE p.name = 'cbn.connect'
ON CONFLICT (role_id, permission_id) DO NOTHING;
