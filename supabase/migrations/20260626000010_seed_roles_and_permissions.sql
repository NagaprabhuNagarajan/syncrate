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
