-- =============================================================================
-- Migration: Seed marketplace transaction permissions (Sprint 10, increment 2)
-- =============================================================================
-- Order placement/fulfilment, payments (escrow), and shipments. Granted to the
-- commerce + finance roles: Owner, Admin, Sales Executive, Accountant.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('marketplace', 'order', 'marketplace.order', 'Place and manage marketplace orders, payments, and shipments')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid),  -- Admin
    ('00000000-0000-0000-0000-000000000005'::uuid),  -- Sales Executive
    ('00000000-0000-0000-0000-000000000004'::uuid)   -- Accountant
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name = 'marketplace.order'
ON CONFLICT (role_id, permission_id) DO NOTHING;
