-- =============================================================================
-- Migration: Seed workflow permissions (Sprint 9, increment 3 — Workflow Engine)
-- =============================================================================
-- Configurable multi-step workflows. Granted to Owner/Admin (org automation is
-- an administrative capability). Follows the grant pattern in 20260629000010.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('workflow', 'view',   'workflow.view',   'View workflows and their run history'),
  ('workflow', 'manage', 'workflow.manage', 'Create, edit, activate, and run workflows')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid)   -- Admin
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN ('workflow.view', 'workflow.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
