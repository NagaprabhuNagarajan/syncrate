---
name: database-conventions
description: Mandatory database schema patterns, naming standards, and audit field requirements for all Syncrate tables
metadata:
  type: project
---

**Every table must include these columns (non-negotiable):**

- `id` — UUID primary key
- `organization_id` — tenant isolation foreign key
- `created_at`, `updated_at`, `deleted_at` — timestamps
- `created_by`, `updated_by`, `deleted_by` — user references
- `version` — optimistic locking

**Naming standards:**

- Tables: `snake_case` (e.g., `invoice_items`)
- Columns: `snake_case`
- Primary key: `id`
- Foreign keys: `{entity}_id` (e.g., `customer_id`, `organization_id`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_customer_mobile`)
- Unique constraints: `uq_{table}_{field}` (e.g., `uq_invoice_number`)

**Security rules:**

- Row Level Security (RLS) on every table: `organization_id = current_user.organization_id`
- Soft deletes only (never hard delete business records)
- Immutable financial records
- Audit logs are immutable

**Domain table groups (≈90–120 tables total):**
Identity, Organization, Customer, Supplier, Product, Inventory, Warehouse, Purchase, Sales, Finance, Reports, Notifications, AI, Connected Business Network (CBN), Audit, Settings

**Key business rule:** Every transaction belongs to one organization and one branch. Cross-org access is strictly prohibited at both app and RLS layers.
