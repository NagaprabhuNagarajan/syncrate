---
name: feature-list-detail-revamp-template
description: The canonical list/detail/form/ledger UI pattern (established by customer, ported to supplier) used to revamp basic-CRUD entity features to premium SaaS UI
metadata:
  type: project
---

Syncrate is mid-migration of its "master data" entity features (customer, supplier,
and apparently product — seen mid-revamp by a concurrent process during the
supplier work on 2026-07-01) from basic card-grid CRUD screens to a shared premium
pattern. `src/features/customer/` is the reference implementation; `src/features/supplier/`
was ported to match it on 2026-07-01.

**Why:** Product wants every entity list/detail/form to feel like one product
(Linear/Stripe-grade), not one-off card grids. [[design-system]]

**How to apply:** When asked to revamp another entity feature (e.g. product, if
not already done — check first), mirror this template exactly rather than
inventing new UI:

## Backend shape
- Add a `{Entity}Stats` type: aggregate counts for 4 header tiles (e.g. total,
  active, newThisMonth, + one more status-specific count). `total` counts
  **every** row including archived/soft-deleted, to match the list's "All" view.
- Repository `getStats(orgId)`: parallel `count: "exact", head: true` queries via
  a shared `base()` closure, `Promise.all`'d, counts default to `0` via `?? 0`.
- Repository `list()`: drop any blanket `.is("deleted_at", null)`. Only
  `.eq("status", status)` when a specific status filter is given; the "All" view
  (no status) intentionally returns archived rows too, since archiving is the
  only soft-delete path (always sets both `status="archived"` and `deleted_at`
  together) — so the status column alone fully describes a record.
- `findById()` and `update()`: drop `.is("deleted_at", null)` so archived records
  stay viewable/editable (needed to restore them via the edit form).
  `findByCode()`/`findByGst()`/`softDelete()`/`findAllForExport()` keep their
  `.is("deleted_at", null)` constraints unchanged.
- Service `update{Entity}`: when `input.status` is provided, sync the soft-delete
  flag — `status === "archived"` → stamp `deleted_at`/`deleted_by`; any other
  status → null them out (this is how editing restores an archived record).
- Page (list route): parse `search`/`status`/`page` from `searchParams`,
  `Promise.all([service.list(...), service.getStats(...)])`, pass
  `{organizationId, result, stats, filters, canManage}` to the view component.

## Frontend shape (see [[design-system]] for tokens)
- List view: gradient icon header + count chip, 4-tile `StatTile` row
  (`AnimatedNumber` + gradient tint blob), status filter **pills**
  (`role="tablist"`/`role="tab"`, not a button group), `ui/table` primitive
  (`<Table wrapperClassName="shadow-card">`), per-row `DropdownMenu`
  (Open/Edit/Copy code/Copy email), server-side pagination ("Showing X–Y of N"),
  URL-param filtering via a local `pushWith(patch)` helper + `useSearchParams`,
  `?org=` threading through every link via a `withOrg(path)` helper. No avatar —
  name link + mono code stacked in the first column.
- Detail view: back link, sticky header (name + status badge + code, Edit +
  Archive buttons; Archive hidden once already archived), a 4-tile `KpiTile`
  strip (emphasis tile first, tinted red/green by sign), two-column body — main
  = Notes card + inline ledger preview (`ui/table`, "View full ledger →"),
  sidebar = `SectionCard`s built from `InfoRow` (icon + label + value, renders
  nothing when value is null).
- Form: `Section` (Card-wrapped) blocks + sticky bottom save bar; status is a
  **segmented radio-style control** on edit only (`role="radiogroup"`,
  `id="status"`, `aria-label="Status"`, buttons with `role="radio"` +
  `aria-checked` + a `STATUS_DOT` color chip) — never a plain `<select>` for
  status once revamped.
- Ledger view: `ui/table` primitive, global formatters, unchanged from the
  original one-off implementation otherwise.
- Always reuse `formatCurrency`/`formatDate`/`getInitials` from `@/utils/format`
  — delete any local `Intl.NumberFormat` / date-formatting duplicates found in
  the pre-revamp file.
- New `loading.tsx` for the list route: skeleton header + 4 skeleton stat tiles
  + `SkeletonTable`.

## Testing shape
- List test: swap the flat `items` prop for `{result, stats, filters, canManage}`;
  add a `makeStats()` fixture builder; assert status pills via
  `screen.getByRole("tab", {name})`; assert em-dash cells for missing optional
  fields; assert pagination via "Previous"/"Next" buttons and the `?page=`
  query param.
- Form test: assert segmented status via `screen.getByRole("radio", {name})`
  with `aria-checked`, not `.toHaveValue()` on a select.
- Repository test: add `getStats` describe block (two tests: real counts;
  defaults to 0 when count is undefined/null) and extend the chainable mock
  builder with a `gte` method. Add/update assertions that `findById`/`list`/
  `update` do **not** call `.is("deleted_at", null)` anymore.
- Service test: add one delegation test for `get{Entity}Stats` → repo `getStats`.

## Event-driven / no-detail-page entities (e.g. inventory, 2026-07-09)

Some domains (`src/features/inventory/`) have no create/edit form and no
detail page by design — stock is a snapshot + immutable ledger + batches,
mutated only via RPC-backed dialogs (adjust/transfer/add-batch). When
revamping these, the template still applies to the **list** shape but adapts:
- Stats: when there's no natural boolean status split, a single-scan
  aggregation works well — one repo method (e.g. `getStatsRows`) returns
  minimal joined rows, and both the legacy single-metric getter (e.g.
  `getStockValue`) and the new `getStats` delegate to it, so nothing that
  already depended on the old getter breaks.
- Binary toggle filters (e.g. "low stock only") become a 2-option pill group
  ("All X" / "Low X") using the same `role="tablist"`/`role="tab"` markup as
  status pills, not a checkbox — even though there's no status enum.
- Multi-value filters that aren't a small enum (e.g. branch, product) stay a
  styled native `<select>`, not pills.
- Test collisions: stat-tile labels (e.g. "Active", "Out of stock") and
  per-row status badges often render identical text on the same page —
  assert with `getAllByText(...).length` instead of `getByText` once both a
  tile and a badge can show the same word. Same for a filter `<select>`'s
  `<option>` text colliding with a table cell showing the same string.

## Document-editor forms with complex logic (e.g. purchase order, 2026-07-09)

Some forms aren't simple field-editors — they're line-item document editors
(`useFieldArray`, product-select pre-fill, live client-side totals math,
optimistic-lock `version`, items serialized as JSON in FormData). When
revamping these, **restyle chrome only**, never touch behavior:
- Replace ad-hoc `SectionTitle` divider components with the same Card-wrapped
  `Section` component used elsewhere (title/description/action prop, motion
  fade-in) — purely a wrapper swap around the exact same fields/registers.
- The line-item grid may be re-skinned with the `ui/table` primitives
  (`Table`/`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`)
  instead of raw `<table>` — but every `register(\`items.${index}.field\`)`,
  `useFieldArray` add/remove, pre-fill handler, and totals calculation must
  carry over verbatim, just inside `<TableCell>` instead of `<td>`.
- Add the sticky bottom save bar (mirrors customer-form) but put the *live
  grand total* on the left instead of a static hint string, since these forms
  already compute one client-side — keep the full totals breakdown dl visible
  above the bar too, don't remove it.
- No status segmented-control here (draft/submitted/etc. are workflow
  transitions via server actions on the detail page, not a form field).
- Detail pages for these documents get a KPI strip themed around the
  document's own money fields (e.g. Total/Subtotal/Tax/Order date) rather
  than an entity-level ledger metric like "Outstanding".
- List page count chip (in the `<h1>`) and the pagination "of N" summary can
  show the same total number simultaneously — assert with
  `getAllByText(...).length` in that test, not `getByText`.
- Repository `getStats` sum-type tiles (e.g. total order value): PostgREST
  head-count queries can't do `SUM()`; fetch just the needed numeric column
  for the relevant row set and reduce in JS. Mock builders need whatever
  extra filter method is used to scope that fetch (e.g. `neq` to exclude
  cancelled orders) added to the test's chainable builder interface.

## Multi-agent concurrent revamp of sibling sub-entities (e.g. purchase invoice, 2026-07-10)

When several agents revamp sibling sub-entities in the same feature tree at
once (e.g. purchase-order, goods-receipt, purchase-invoice, purchase-return,
purchase-request all under `src/features/purchase/`), each is scoped to
files whose name contains its own entity slug, plus any brand-new shared
util it creates (e.g. `purchase-invoice-display.ts`) — never edit a sibling's
files even to fix something adjacent; only import from them. `git status`
mid-session will show many concurrently-modified sibling files that are not
yours — that's expected, not a conflict. Run only the scoped test command
given (e.g. `pnpm test purchase-invoice`), not the whole suite/typecheck/lint,
since siblings are mid-edit and would produce false failures.

- A 3-status document enum (e.g. purchase invoice's `draft | posted |
  cancelled`, no intermediate approval states like PO's `submitted/approved/
  ordered`) doesn't have enough natural buckets for 4 meaningful stat tiles.
  Derive an honest 4th metric from existing columns instead of inventing a
  status: e.g. "Overdue" = posted rows where `due_date < today AND
  amount_paid < total_amount`. PostgREST can't compare two columns
  server-side, so fetch minimal columns (`total_amount, amount_paid`) for
  `status=posted AND due_date < today` and filter/count in JS — same
  JS-reduce pattern as the sum-type tiles above.
- Before adding any action button (e.g. Edit) to a revamped detail page,
  verify the target route actually exists under `src/app/.../[id]/...` —
  don't assume a sibling CRUD route (create/detail) implies an edit route
  exists too. Purchase invoice has full edit logic in its service/action
  layer but no `/purchases/invoices/[id]/edit` page route yet, so the
  revamped detail page correctly has no Edit button (matches pre-revamp
  behavior) even though the form component supports edit mode.

### Purchase request / requisition (2026-07-10)

Purchase requests genuinely have **no monetary total on the header** —
`estimatedPrice` is optional per line and non-authoritative (a real price is
only set later, on the PO). So unlike purchase order's `totalValue` sum tile,
`PurchaseRequestStats` is 4 pure status counts (draft, awaitingApproval,
approved, converted) — no `getStats` value-row fetch/JS-reduce needed here,
just parallel head-counts. Other deviations from the PO template:
- Status enum has two *extra* terminal-ish branches PO doesn't: `rejected`
  and `converted` (POs only have `cancelled`/`completed`). The detail page
  therefore keeps three action dialogs, not one — Cancel (same shape as PO),
  plus PR-only Reject (textarea reason, `role="dialog"` id
  `reject-pr-title`) and Convert (supplier `<select>`, id
  `convert-pr-title`) — both carried over verbatim from the pre-revamp file,
  only re-skinned to match the Cancel dialog's visual chrome.
  `canBeCancelled` excludes `converted` in addition to `cancelled`.
- Detail KPI strip is themed around counts/dates, not currency: line-item
  count (emphasis), estimated total (still shown, just not authoritative),
  branch name, required-by date — no Subtotal/Tax tiles since there's no tax
  math on a requisition line.
- `requiredDate` is nullable (`Date | null`, unlike PO's non-null
  `orderDate`) — every render site needs a null guard before calling the
  shared `formatDate` from `@/utils/format` (that helper takes a non-null
  `Date`); mirrors how PO detail already guarded
  `expectedDeliveryDate`/`approvedAt`.
- List stat-tile labels ("Approved", "Converted") collide with same-text
  status filter pills on the same page — assert with
  `getAllByText(...).length`, not `getByText`, same collision class as the
  inventory and PO precedents above.

### Sales order (GST-bearing document editor, 2026-07-10)

Sales order mirrors purchase order's document-editor pattern almost exactly
(header+items, `useFieldArray`, optimistic-lock `version`, FormData/JSON
submission) but adds India GST logic that must survive the restyle
byte-for-byte: `computeLineGST(item, orgState, supplyState)` decides
CGST+SGST (intra-state, `orgState === supplyState` case-insensitive) vs IGST
(inter-state) per line, and the line-item table's CGST/SGST vs IGST columns
switch live off `isIntra`. When restyling this class of form, only touch
JSX/className — never the calculation functions, `handleProductChange`
pre-fill, or the `SALES_GST_RATES`/tax-slab fallback-to-0 behavior.
- Detail KPI "Tax" tile = `cgstAmount + sgstAmount + igstAmount` summed in
  the component (not a stored column) — same pattern for any future
  GST-bearing document detail page (quotation, invoice, sales/purchase
  return).
- Stats shape is identical to PO's (`totalValue` sum over non-cancelled +
  3 status-group counts) even though the status enum differs
  (`processing`/`partially_delivered` instead of `ordered`/
  `partially_received`) — the repo `getStats` head-count-parallel +
  JS-reduce-sum pattern ports over unchanged.
- Test collision expanded beyond stat-tile-vs-pill: a KPI tile label
  ("Total", "Subtotal", "Order date") can collide with an identically
  worded sidebar `InfoRow`/summary `dt` on the *same* detail page, and a
  line-item table's GST column header ("CGST"/"SGST") can collide with the
  form's totals-`dl` term of the same name — both need
  `getAllByText(...).length`, not `getByText`.
- Pre-existing bug fixed in this pass: the sales order detail's Branch
  `InfoRow` had `label="Building2"` (a copy-paste of the icon import name
  instead of the display label) — watch for this exact typo class
  (icon-name-as-label) when porting other pre-revamp detail pages that
  used inline `InfoRow` lists instead of the shared component.
- `/sales-orders/new/page.tsx` never passes `orgState` to the form (unlike
  `/sales-orders/[id]/edit/page.tsx`, which does) — so a brand-new SO's
  live GST preview always treats the order as inter-state until a value is
  typed that happens to equal an empty org state (never, in practice).
  Out of scope to fix during a pure restyle; flag it if asked to touch
  sales-order create-flow logic again.

Related: [[coding-standards]], [[feedback-eslint-pitfalls]], [[design-system]]
