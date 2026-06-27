---
name: coding-standards
description: Mandatory coding conventions, file naming, folder structure, and anti-patterns for Syncrate
metadata:
  type: project
---

**TypeScript rules (enforced):**

- `strict: true` always
- Never use `any` — use `unknown` instead
- Use `Readonly` types
- `type` for unions, `interface` for object contracts

**React rules:**

- Functional components only (no class components)
- Hooks over everything
- Composition over inheritance
- No props drilling, no inline business logic in JSX
- No anonymous functions in JSX

**File naming conventions:**

- Component: `InvoiceCard.tsx`
- Hook: `useInvoice.ts`
- Utility: `calculateTax.ts`
- Service: `invoice.service.ts`
- Repository: `invoice.repository.ts`
- Constant: `MAX_RETRY_COUNT`
- Enum: `InvoiceStatus`
- Interface: `Invoice`
- Type: `InvoiceFilter`
- Zod schema: `invoiceSchema`

**Folder structure:**

```
src/
  app/
  components/
  features/
  shared/
  hooks/
  services/
  repositories/
  stores/
  schemas/
  utils/
  types/
  constants/
  styles/
  tests/
```

**Separation of concerns (non-negotiable):**

- UI, business logic, API access, validation, and state in distinct layers
- Backend: services and repositories, never business logic in pages/routes
- Validate every input with Zod; never trust client input
- Use DB transactions where atomicity is required

**Git commit convention:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `perf:`, `build:`, `ci:`, `style:`, `chore:`
Branch strategy: `main` → `develop` → `feature/{name}` → PR → Review → Merge

**Anti-patterns to avoid:** any type, class components, props drilling, inline business logic, duplicated code, anonymous JSX functions, ignoring TS errors, disabling ESLint.
