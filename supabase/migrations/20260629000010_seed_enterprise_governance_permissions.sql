-- =============================================================================
-- Migration: Seed enterprise governance permissions (Sprint 9, increment 1)
-- =============================================================================
-- Advanced Permissions (custom role management), Audit Center (read the
-- immutable trails), and API Keys management. Granted to the roles that own
-- organization administration (Owner, Admin); audit visibility also to
-- Accountant for compliance review. Follows the grant pattern in
-- 20260626000010 and 20260628000015.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('role',     'view',   'role.view',     'View roles and their permissions'),
  ('role',     'manage', 'role.manage',   'Create, edit, and delete custom roles'),
  ('audit',    'view',   'audit.view',    'View the organization audit trail (Audit Center)'),
  ('api_key',  'view',   'api_key.view',  'View API keys'),
  ('api_key',  'manage', 'api_key.manage','Create, rotate, and revoke API keys')
ON CONFLICT (name) DO NOTHING;

-- Owner + Admin get everything; Accountant additionally gets audit.view.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid)   -- Admin
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN (
   'role.view', 'role.manage', 'audit.view', 'api_key.view', 'api_key.manage'
 )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004'::uuid, p.id  -- Accountant
  FROM public.permissions p
 WHERE p.name = 'audit.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
