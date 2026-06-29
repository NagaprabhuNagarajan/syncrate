-- =============================================================================
-- Migration: Seed approval + webhook permissions (Sprint 9, increment 2)
-- =============================================================================
-- Approval Engine (configurable approval rules + approve/reject) and Webhooks
-- (outbound event delivery). Granted to Owner/Admin; approval.decide also to
-- Branch Manager + Accountant so they can action requests routed to them.
-- Follows the grant pattern in 20260626000010 / 20260629000010.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('approval', 'view',    'approval.view',    'View approval rules and requests'),
  ('approval', 'manage',  'approval.manage',  'Create and edit approval rules'),
  ('approval', 'decide',  'approval.decide',  'Approve or reject pending approval requests'),
  ('webhook',  'view',    'webhook.view',     'View webhook endpoints and deliveries'),
  ('webhook',  'manage',  'webhook.manage',   'Create, edit, and delete webhook endpoints')
ON CONFLICT (name) DO NOTHING;

-- Owner + Admin get everything.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid)   -- Admin
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN (
   'approval.view', 'approval.manage', 'approval.decide',
   'webhook.view', 'webhook.manage'
 )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Branch Manager + Accountant can view + decide approvals routed to them.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000003'::uuid),  -- Branch Manager
    ('00000000-0000-0000-0000-000000000004'::uuid)   -- Accountant
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN ('approval.view', 'approval.decide')
ON CONFLICT (role_id, permission_id) DO NOTHING;
