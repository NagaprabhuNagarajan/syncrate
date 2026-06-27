---
name: sprint-6-payments-reports
description: Sprint 6 Payment Collection, Reports, Dashboard KPIs — schema, RPC directions, accounting rules, module boundaries
metadata:
  type: project
---

Sprint 6 adds Payments, Reports, and Dashboard KPIs to Syncrate. Feature branch: `feature/sprint-6-payments-reports`.

## Migrations added (after 20260627000019)
- `20260627000020_create_payments.sql` — customer_payments, customer_payment_allocations, supplier_payments, supplier_payment_allocations tables; also adds missing INSERT policies to customer_ledger_entries and supplier_ledger_entries (needed by ALL RPCs in Security Invoker mode)
- `20260627000021_payment_event_functions.sql` — `record_customer_payment(...)` and `record_supplier_payment(...)` RPCs

## Accounting directions (critical)
- Customer ledger DEBIT = A/R increases (invoice posted) — `running_balance + total`
- Customer ledger CREDIT = A/R decreases (payment received) — `running_balance - amount`
- Supplier ledger CREDIT = A/P increases (purchase invoice) — `running_balance + total`
- Supplier ledger DEBIT = A/P decreases (payment made) — `running_balance - amount`

## RPC pattern for payments
- `record_customer_payment` → atomic: payment header INSERT + allocation INSERTs + invoice.amount_paid UPDATE + payment_status UPDATE + customer_ledger_entries CREDIT entry
- `record_supplier_payment` → atomic: payment header INSERT + allocation INSERTs + purchase_invoice.amount_paid UPDATE + supplier_ledger_entries DEBIT entry
- p_allocations shape (customer): `[{"invoice_id": "<uuid>", "amount": <number>}]`
- p_allocations shape (supplier): `[{"purchase_invoice_id": "<uuid>", "amount": <number>}]`

## Module structure
- `src/features/payment/` — customer/supplier payment types, schemas, repos, services, actions, components
- `src/features/reports/` — report types, services (pure aggregation queries, no repos), components
- Dashboard: `src/features/dashboard/services/dashboard.service.ts` + replaced `dashboard-view.tsx` with real KPI widgets

## New types in database.types.ts
- `CustomerPaymentsRow`, `CustomerPaymentAllocationsRow`, `SupplierPaymentsRow`, `SupplierPaymentAllocationsRow`, `PaymentMethod`
- Functions: `record_customer_payment`, `record_supplier_payment`

## Key business rules
- Payments deleted_at must be soft delete; voiding creates voided status, never hard delete
- Payment number format: `PAY-{year}-{sequence}` (count existing + 1)
- Outstanding = invoices where status='posted' AND payment_status IN ('unpaid', 'partial')

**Why:** Sprint 6 from docs/SPRINT_BACKLOG.md. Acceptance criteria: outstanding updated, reports generated, dashboard refreshed.
**How to apply:** When touching payment or report code, check these conventions first.
