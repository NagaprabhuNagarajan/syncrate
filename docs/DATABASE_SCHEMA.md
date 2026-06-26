# 03_DATABASE_SCHEMA.md

# Syncrate

## Enterprise Database Design

**Version:** 1.0

---

# 1. Overview

This document defines the logical and physical database architecture for Syncrate.

The database is designed to support:

* Multi-tenancy
* High performance
* Horizontal scalability
* Data integrity
* Auditability
* AI capabilities
* Connected Business Network
* Enterprise reporting

PostgreSQL (Supabase) is the primary database.

---

# 2. Database Principles

Every table follows these principles:

* UUID Primary Keys
* Organization Isolation
* Soft Delete
* Audit Fields
* Created By
* Updated By
* Optimistic Locking
* Row Level Security
* Immutable Financial Records

---

# 3. Naming Standards

Tables

snake_case

Columns

snake_case

Primary Key

id

Foreign Keys

customer_id

supplier_id

organization_id

Indexes

idx_customer_mobile

Unique Constraints

uq_invoice_number

---

# 4. Common Audit Columns

Every table contains

id

organization_id

created_at

updated_at

deleted_at

created_by

updated_by

deleted_by

version

---

# 5. Domain Structure

Identity

Organization

Employee

Customer

Supplier

Products

Inventory

Warehouse

Purchase

Sales

Finance

Reports

Notifications

AI

Connected Business Network

Audit

Settings

---

# 6. Identity Tables

## users

Stores authentication users.

Columns:

* id
* email
* password_hash (managed by Auth provider)
* status
* last_login_at
* created_at

---

## roles

Stores role definitions.

Examples:

Owner

Manager

Accountant

Sales

Warehouse

---

## permissions

Stores individual permissions.

Example

customer.create

invoice.read

inventory.adjust

---

## role_permissions

Maps roles to permissions.

---

## user_roles

Maps users to organization roles.

---

# 7. Organization Domain

organizations

branches

organization_settings

financial_years

currencies

timezones

business_types

---

# 8. Customer Domain

customers

customer_addresses

customer_contacts

customer_credit_limits

customer_ledgers

customer_notes

customer_tags

customer_documents

---

# 9. Supplier Domain

suppliers

supplier_addresses

supplier_contacts

supplier_catalogs

supplier_ledgers

supplier_ratings

supplier_documents

---

# 10. Product Domain

products

categories

brands

units

product_images

product_variants

product_prices

product_tax

product_suppliers

product_documents

---

# 11. Inventory Domain

warehouses

warehouse_locations

inventory

inventory_transactions

inventory_adjustments

stock_transfers

batches

serial_numbers

barcode_labels

inventory_snapshots

---

# 12. Purchase Domain

purchase_requests

purchase_orders

purchase_order_items

goods_receipts

purchase_invoices

purchase_invoice_items

purchase_returns

purchase_payments

---

# 13. Sales Domain

quotations

quotation_items

sales_orders

sales_order_items

invoices

invoice_items

sales_returns

credit_notes

debit_notes

payments

payment_allocations

---

# 14. Finance Domain

ledger_accounts

journal_entries

journal_lines

cash_accounts

bank_accounts

expense_categories

expenses

tax_records

financial_periods

---

# 15. Reports Domain

saved_reports

report_templates

scheduled_reports

dashboard_widgets

analytics_snapshots

---

# 16. Notification Domain

notifications

notification_templates

notification_preferences

notification_logs

email_queue

whatsapp_queue

---

# 17. AI Platform Domain

ai_requests

ai_responses

ai_recommendations

ai_predictions

ai_forecasts

ai_feedback

ai_prompts

ai_audit_logs

---

# 18. Connected Business Network

business_connections

connection_requests

shared_documents

supplier_catalogs

purchase_sync_logs

invoice_sync_logs

delivery_tracking

business_reputation

business_ratings

---

# 19. Audit Domain

audit_logs

login_history

api_logs

security_events

activity_logs

error_logs

---

# 20. Settings Domain

application_settings

organization_settings

branch_settings

user_preferences

feature_flags

---

# 21. Relationships

Organization

↓

Branches

↓

Warehouses

↓

Inventory

↓

Products

↓

Invoices

↓

Payments

↓

Reports

Every relationship enforces referential integrity.

---

# 22. Index Strategy

Indexes on:

Invoice Number

Customer

Supplier

Mobile

Email

GST

SKU

Barcode

Created Date

Payment Status

Organization

Composite indexes for frequently queried combinations.

---

# 23. Security

Every table enforces:

* Row Level Security
* Tenant Isolation
* Audit Tracking
* Soft Deletes
* Immutable Financial Records

---

# 24. Future Tables

Marketplace

CRM

Payroll

Manufacturing

Service Management

Workflow Engine

POS

Loyalty

Mobile Sync

---

# Summary

Estimated Tables

≈ 90–120

Estimated Relationships

≈ 250+

Indexes

≈ 300+

Foreign Keys

≈ 250+

This schema forms the foundation for Syncrate's enterprise-grade multi-tenant Business Operating System.
