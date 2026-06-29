-- =============================================================================
-- Migration: Seed purchase_order.* permissions (used by CBN PO synchronization)
-- =============================================================================
-- The CBN purchase-order sync actions authorize with `purchase_order.create`,
-- `purchase_order.update`, and `purchase_order.view`, which were never seeded —
-- leaving them unassigned to any role, so PO sync was always denied. Seed them
-- and grant to the roles that handle procurement (Owner, Admin, Accountant),
-- matching the grant pattern in 20260626000010.
-- =============================================================================

INSERT INTO public.permissions (module, action, name, description) VALUES
  ('purchase_order', 'create', 'purchase_order.create', 'Create / send purchase orders (incl. CBN sync)'),
  ('purchase_order', 'update', 'purchase_order.update', 'Update / accept / reject purchase orders'),
  ('purchase_order', 'view',   'purchase_order.view',   'View purchase orders')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.id
  FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::uuid),  -- Owner
    ('00000000-0000-0000-0000-000000000002'::uuid),  -- Admin
    ('00000000-0000-0000-0000-000000000004'::uuid)   -- Accountant
  ) AS r(role_id)
  CROSS JOIN public.permissions p
 WHERE p.name IN ('purchase_order.create', 'purchase_order.update', 'purchase_order.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
