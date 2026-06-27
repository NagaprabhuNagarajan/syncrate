---
name: auth-and-permissions
description: Authentication architecture, RBAC model, permission format, and multi-tenant security rules for Syncrate
metadata:
  type: project
---

**Auth provider:** Supabase Auth with JWT. Session timeout: 8h (configurable). Refresh tokens rotate.

**Current auth methods:** Email + Password, Magic Link, Invitation-based Registration.
Future: Google, Microsoft Entra, GitHub, Apple, SAML SSO, OAuth 2.0, LDAP.

**User types:**

- Platform: Super Admin, Platform Support
- Organization: Owner, Admin, Branch Manager, Accountant, Sales Executive, Warehouse Manager, Cashier, Employee
- External: Connected Supplier, Auditor (read-only)

**Multi-org support:** One user can belong to multiple organizations. Each org maintains independent roles, permissions, settings, and data.

**Permission format:** `module.action` e.g. `customer.create`, `invoice.post`, `inventory.adjust`, `ai.generate`

**Default roles:** Super Admin, Owner, Admin, Branch Manager, Accountant, Sales Executive, Warehouse Manager, Cashier, Employee, Viewer. Custom roles are org-configurable.

**Multi-tenant rules (every request must validate):**

- User ID
- Organization ID
- Branch ID (where applicable)
- Every DB query filtered by `organization_id`
- Cross-organization access is PROHIBITED at RLS and application layer

**Branch-level permissions:** Users can be restricted to specific branches.

**Approval-required actions:** High-value invoices, purchase orders, inventory adjustments, payment reversals, credit limit overrides.

**CBN permissions (organization-controlled):** Receive POs, receive invoices, receive quotations, share product catalog, share stock availability, share delivery status, receive payment updates, exchange documents.

**Audit logging:** Every auth event is recorded (login, logout, password change, MFA, role/permission changes, failed logins). Immutable records.

**Performance:** Login <2s, permission validation <100ms, JWT verification <50ms, session refresh <500ms.

**Security must-haves:** HTTPS only, secure cookies, CSRF protection, XSS prevention, parameterized queries, rate limiting, account lockout, brute force protection.
