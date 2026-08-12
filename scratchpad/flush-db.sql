-- ============================================================================
-- FLUSH DATABASE — wipes ALL business data + ALL auth users, keeps schema,
-- then RE-SEEDS the RBAC reference data (system roles, permissions,
-- role_permissions) that org-creation depends on. Run in Supabase SQL editor.
-- IRREVERSIBLE.
-- ============================================================================

-- Truncate EVERY table in the public schema, discovered at runtime.
--
-- The previous version hard-coded a table list, which broke the moment a table
-- was dropped (`public.warehouses` was merged into branches by migration
-- 20260630000010, so the whole statement failed with 42P01). Building the list
-- from pg_tables keeps this correct as the schema evolves — nothing to maintain.
--
-- Supabase's migration history lives in the `supabase_migrations` schema, so it
-- is untouched: the schema stays migrated, only the data goes.
DO $$
DECLARE
  v_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO v_tables
    FROM pg_tables
   WHERE schemaname = 'public';

  IF v_tables IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || v_tables || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Wipe all auth users (cascades to auth.identities / auth.sessions).
truncate table auth.users cascade;

-- ============================================================================
-- RE-SEED RBAC reference data (REQUIRED — org creation fails without it).
-- ============================================================================

-- ===== 20260626000010_seed_roles_and_permissions.sql =====

-- =============================================================================
-- Migration: Seed system roles and all permissions
-- =============================================================================
-- System roles (organization_id = NULL) are platform-level defaults.
-- All module.action permissions defined in AUTHENTICATION_AND_PERMISSIONS.md.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- System Roles
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.roles (id, name, description, is_system, organization_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Owner',            'Organization owner with full access', true, NULL),
  ('00000000-0000-0000-0000-000000000002', 'Admin',            'Administrator with full org management', true, NULL),
  ('00000000-0000-0000-0000-000000000003', 'Branch Manager',   'Manages a specific branch', true, NULL),
  ('00000000-0000-0000-0000-000000000004', 'Accountant',       'Finance and accounting access', true, NULL),
  ('00000000-0000-0000-0000-000000000005', 'Sales Executive',  'Sales and customer management', true, NULL),
  ('00000000-0000-0000-0000-000000000006', 'Warehouse Manager','Inventory and warehouse management', true, NULL),
  ('00000000-0000-0000-0000-000000000007', 'Cashier',          'Payment collection access', true, NULL),
  ('00000000-0000-0000-0000-000000000008', 'Employee',         'Basic access to assigned tasks', true, NULL),
  ('00000000-0000-0000-0000-000000000009', 'Viewer',           'Read-only access', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- All Permissions (module.action format)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.permissions (module, action, name, description) VALUES
  -- Customer
  ('customer', 'create',  'customer.create',  'Create new customers'),
  ('customer', 'view',    'customer.view',    'View customer details'),
  ('customer', 'update',  'customer.update',  'Edit customer information'),
  ('customer', 'archive', 'customer.archive', 'Archive (soft-delete) customers'),
  ('customer', 'export',  'customer.export',  'Export customer data'),
  -- Supplier
  ('supplier', 'create',  'supplier.create',  'Create new suppliers'),
  ('supplier', 'view',    'supplier.view',    'View supplier details'),
  ('supplier', 'update',  'supplier.update',  'Edit supplier information'),
  ('supplier', 'archive', 'supplier.archive', 'Archive suppliers'),
  -- Product
  ('product', 'create',   'product.create',   'Create products'),
  ('product', 'view',     'product.view',     'View product catalog'),
  ('product', 'update',   'product.update',   'Edit products'),
  ('product', 'delete',   'product.delete',   'Delete products'),
  ('product', 'import',   'product.import',   'Bulk import products'),
  ('product', 'export',   'product.export',   'Export product data'),
  -- Inventory
  ('inventory', 'view',     'inventory.view',     'View inventory levels'),
  ('inventory', 'adjust',   'inventory.adjust',   'Make inventory adjustments'),
  ('inventory', 'transfer', 'inventory.transfer', 'Transfer stock between warehouses'),
  ('inventory', 'audit',    'inventory.audit',    'Conduct inventory audits'),
  -- Purchase
  ('purchase', 'create',   'purchase.create',   'Create purchase requests/orders'),
  ('purchase', 'view',     'purchase.view',     'View purchase documents'),
  ('purchase', 'approve',  'purchase.approve',  'Approve purchase orders'),
  ('purchase', 'cancel',   'purchase.cancel',   'Cancel purchase orders'),
  ('purchase', 'receive',  'purchase.receive',  'Record goods received'),
  -- Sales
  ('sales', 'create',   'sales.create',   'Create quotations and sales orders'),
  ('sales', 'view',     'sales.view',     'View sales documents'),
  ('sales', 'approve',  'sales.approve',  'Approve sales orders'),
  ('sales', 'cancel',   'sales.cancel',   'Cancel sales orders'),
  -- Invoice
  ('invoice', 'create',     'invoice.create',     'Create invoices'),
  ('invoice', 'view',       'invoice.view',       'View invoices'),
  ('invoice', 'edit_draft', 'invoice.edit_draft', 'Edit draft invoices'),
  ('invoice', 'post',       'invoice.post',       'Post/finalize invoices'),
  ('invoice', 'print',      'invoice.print',      'Print invoices'),
  ('invoice', 'share',      'invoice.share',      'Share invoices with customers'),
  ('invoice', 'cancel',     'invoice.cancel',     'Cancel posted invoices'),
  -- Payments
  ('payment', 'receive',  'payment.receive',  'Record customer payments'),
  ('payment', 'refund',   'payment.refund',   'Process refunds'),
  ('payment', 'reverse',  'payment.reverse',  'Reverse posted payments'),
  -- Finance
  ('finance', 'view',    'finance.view',    'View financial data'),
  ('finance', 'manage',  'finance.manage',  'Manage journal entries'),
  ('finance', 'close',   'finance.close',   'Close financial periods'),
  -- Reports
  ('report', 'view',     'report.view',     'View reports'),
  ('report', 'export',   'report.export',   'Export reports'),
  ('report', 'schedule', 'report.schedule', 'Schedule automated reports'),
  -- AI
  ('ai', 'view',      'ai.view',      'View AI insights'),
  ('ai', 'generate',  'ai.generate',  'Generate AI content'),
  ('ai', 'configure', 'ai.configure', 'Configure AI settings'),
  -- Connected Business Network
  ('cbn', 'connect',  'cbn.connect',  'Connect with other businesses'),
  ('cbn', 'view',     'cbn.view',     'View connected businesses'),
  ('cbn', 'sync',     'cbn.sync',     'Sync transactions with connected businesses'),
  -- Settings / Administration
  ('settings', 'manage',         'settings.manage',         'Manage organization settings'),
  ('settings', 'users',          'settings.users',          'Manage users and invitations'),
  ('settings', 'roles',          'settings.roles',          'Manage roles and permissions'),
  ('settings', 'branches',       'settings.branches',       'Manage branches'),
  ('settings', 'audit_logs',     'settings.audit_logs',     'View audit logs'),
  ('settings', 'billing',        'settings.billing',        'Manage billing and subscription')
ON CONFLICT (module, action) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant all permissions to Owner role
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant all permissions to Admin role (same as owner minus billing)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', p.id
  FROM public.permissions p
 WHERE p.name != 'settings.billing'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant Accountant role: finance + reports + view access
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', p.id
  FROM public.permissions p
 WHERE p.module IN ('finance', 'report', 'customer', 'supplier', 'invoice', 'payment')
   AND p.action IN ('view', 'manage', 'receive', 'export', 'close', 'schedule', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant Sales Executive: sales + customer + invoice + payment receive
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', p.id
  FROM public.permissions p
 WHERE (p.module = 'customer' AND p.action IN ('create', 'view', 'update'))
    OR (p.module = 'sales')
    OR (p.module = 'invoice' AND p.action IN ('create', 'view', 'edit_draft', 'post', 'print', 'share'))
    OR (p.module = 'payment' AND p.action = 'receive')
    OR (p.module = 'product' AND p.action = 'view')
    OR (p.module = 'inventory' AND p.action = 'view')
    OR (p.module = 'report' AND p.action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant Warehouse Manager: inventory + product + purchase receive
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', p.id
  FROM public.permissions p
 WHERE (p.module = 'inventory')
    OR (p.module = 'product' AND p.action IN ('view', 'update'))
    OR (p.module = 'purchase' AND p.action IN ('view', 'receive'))
    OR (p.module = 'report' AND p.action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Grant Cashier: payment receive + invoice view
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000007', p.id
  FROM public.permissions p
 WHERE (p.module = 'payment' AND p.action IN ('receive'))
    OR (p.module = 'invoice' AND p.action IN ('view', 'print'))
    OR (p.module = 'customer' AND p.action = 'view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Viewer role: view-only access across all modules
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000009', p.id
  FROM public.permissions p
 WHERE p.action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ===== 20260627000022_seed_payment_make_permission.sql =====

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

-- ===== 20260628000014_seed_cbn_catalog_permission.sql =====

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

-- ===== 20260628000015_seed_purchase_order_permissions.sql =====

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

-- ===== 20260629000010_seed_enterprise_governance_permissions.sql =====

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

-- ===== 20260629000013_seed_enterprise_integration_permissions.sql =====

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

-- ===== 20260629000016_seed_workflow_permissions.sql =====

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

-- ===== 20260630000001_seed_marketplace_permissions.sql =====

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

-- ===== 20260630000005_seed_marketplace_transaction_permissions.sql =====

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
