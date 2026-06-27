---
name: sprint-5-sales-invoicing
description: Sprint 5 Sales & Invoicing implementation — GST engine, pricing engine, discount engine, atomic RPCs, PDF generation, E2E spec, known pitfalls
metadata:
  type: project
---

Sprint 5 is complete and pushed to `feature/sprint-5-sales-invoicing` (commit f35fcf2, 72 files, 18859 insertions). All QA gates green: lint, typecheck, 2042 tests, build.

**Why:** Full India GST-compliant quotation → sales order → tax invoice → sales return lifecycle needed for SME market.

**How to apply:** When extending the Sales module or adding adjacent modules (purchasing, inventory), reference these patterns as the canonical implementation.

## Domain structure delivered

`src/features/sales/` contains: types/, schemas/, utils/, repositories/, services/, actions/, components/, server/

Sub-domains: quotation, sales-order, invoice, sales-return, credit-note

## GST Engine (`src/features/sales/utils/gst-engine.ts`)

- Function: `computeGST(input: GSTInput): GSTComputation`
- Intra-state (orgState === supplyState, both non-null/non-empty) → CGST = SGST = rate/2, IGST = 0
- Inter-state (orgState !== supplyState, or either is null/empty) → IGST = rate, CGST = SGST = 0
- All amounts rounded to 2dp via `Math.round((n + Number.EPSILON) * 100) / 100`
- Valid rates: [0, 5, 12, 18, 28]. `isValidGSTRate(rate)` exported for form validation.

## Pricing Engine (`src/features/sales/utils/pricing-engine.ts`)

Priority ladder (highest wins): customer_specific > promotional > dealer > wholesale > retail. Min selling price enforced.

## Discount Engine (`src/features/sales/utils/discount-engine.ts`)

- Type: "percentage" | "fixed"
- Approval thresholds: >20% requires manager, >40% requires owner
- Result clamped to [0, lineAmount]

## Atomic Postgres RPCs

`post_sales_invoice(p_invoice_id UUID)` — status update + inventory deduction (adjust_stock()) + customer ledger debit in one transaction. Posted invoices are immutable.

`complete_sales_return(p_return_id UUID)` — status update + inventory credit back + customer ledger credit.

Migration: `supabase/migrations/20260627000019_sales_event_functions.sql`

## RLS pattern

All 9 new tables use `public.get_user_organization_ids()` helper (avoids 42P17 recursion). Pattern from `20260627000016_create_quotations.sql`.

## Discriminated union narrowing (critical)

`QuotationActionResult<T>` = `{success: true; data: T} | {success: false; error: QuotationError}`

When converting between result types in actions (e.g., converting `QuotationActionResult<never>` to `SalesOrderActionResult<never>`), the union must be explicitly narrowed before accessing `.error`:

```typescript
// CORRECT
const r = auth.result;
const message = !r.success ? r.error.message : "Forbidden";

// WRONG — TS error: Property 'error' does not exist on union type
const message = auth.result.error.message;
```

## Column name: selling_price

The `products` table uses `selling_price` (not `sale_price`). Pages that query products must use `.select("id, name, selling_price, gst_rate")`.

## PDF route

`src/app/api/sales/invoices/[id]/pdf/route.ts` — server-side HTML with print CSS. Returns `Content-Type: text/html`. `?auto=true` in query string triggers `window.print()` via inline script. No external PDF library.

## E2E spec

`e2e/sales.spec.ts` — Tier-2 gated with `test.skip(!process.env.E2E_LIVE, ...)`. Uses `selectFirstRealOption(page, accessibleName)` helper for seed-data-agnostic selects. Full lifecycle: login → quotation → SO → invoice → return smoke.

## buildItemRows guard pattern

Array-index guard replaces non-null assertion (banned by `@typescript-eslint/no-non-null-assertion`):

```typescript
const line = lines[index];
if (!line) { throw new Error(`Assertion failed: computed line missing at index ${index}`); }
```

## Permissions used

`sales.view`, `sales.create`, `sales.approve`, `sales.cancel`, `invoice.create`, `invoice.post`

## App routes (18 pages)

`/sales` → redirects to `/sales/orders`
Quotations: `/sales/quotations`, `/sales/quotations/new`, `/sales/quotations/[id]`, `/sales/quotations/[id]/edit`
Orders: `/sales/orders`, `/sales/orders/new`, `/sales/orders/[id]`, `/sales/orders/[id]/edit`
Invoices: `/sales/invoices`, `/sales/invoices/new`, `/sales/invoices/[id]`, `/sales/invoices/[id]/edit`, `/sales/invoices/[id]/share`
Returns: `/sales/returns`, `/sales/returns/new`, `/sales/returns/[id]`

## Status enumerations

QuotationStatus: draft | sent | viewed | accepted | rejected | expired | converted
SalesOrderStatus: draft | submitted | approved | processing | partially_delivered | completed | cancelled
InvoiceStatus: draft | posted | cancelled
PaymentStatus: unpaid | partial | paid | overdue
SalesReturnStatus: draft | submitted | approved | completed | cancelled
