-- =============================================================================
-- Migration: Seed the payment.make permission
-- =============================================================================
-- Supplier payments are authorized by `payment.make`, which was referenced by
-- the payment actions but never seeded — leaving the permission unassigned to
-- any role, so supplier payments were always denied. This seeds it and grants
-- it to the roles that handle finance (Owner, Admin, Accountant), matching the
-- grant pattern in 20260626000010.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('payment', 'make', 'payment.make', 'Record supplier payments')
ON CONFLICT (name) DO NOTHING;

-- Grant to Owner, Admin, and Accountant roles.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid),  -- Admin
    ('00000000-0000-0000-0000-000000000004'::uuid)   -- Accountant
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name = 'payment.make'
ON CONFLICT (role_id, permission_id) DO NOTHING;
