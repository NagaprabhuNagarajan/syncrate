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

Related: [[coding-standards]], [[feedback-eslint-pitfalls]], [[design-system]]
