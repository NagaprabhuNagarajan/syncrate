# CLAUDE.md — Syncrate Engineering Guide

## Project Overview

Syncrate is an AI-powered Connected Business Operating System (SaaS) for SMEs. The **Connected Business Network (CBN)** is the core differentiator: businesses exchange structured digital transactions instead of PDF invoices.

**Docs are the source of truth.** Always read `docs/` before implementing anything. Never invent business logic.

---

## Common Commands

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm typecheck        # TypeScript check (tsc --noEmit)
pnpm lint             # ESLint + TypeScript check
pnpm format           # Prettier format all files
pnpm test             # Vitest unit tests
pnpm test:watch       # Vitest in watch mode
pnpm test:coverage    # Coverage report
pnpm test:e2e         # Playwright E2E tests
pnpm db:generate-types # Regenerate Supabase types
```

---

## Architecture (Non-negotiable)

**Pattern:** Modular Monolith + Clean Architecture + DDD

```
src/features/{domain}/
  components/    ← UI components for this domain
  hooks/         ← React hooks (client-side logic)
  services/      ← Business logic (no UI dependencies)
  repositories/  ← Data access (Supabase calls)
  schemas/       ← Zod validation schemas
  types/         ← Domain types
```

Business logic must never live in pages, route handlers, or components directly. Always goes through: `component → service → repository → Supabase`.

---

## TypeScript Rules (Enforced by ESLint)

- `strict: true` in tsconfig — always
- **Never use `any`** — use `unknown`, proper generics, or typed interfaces
- `@typescript-eslint/consistent-type-imports` — always use `import type`
- No non-null assertions (`!`) unless you can prove safety
- `noUnusedLocals: true` and `noUnusedParameters: true` — prefix unused with `_`

---

## File Naming

| Thing | Convention |
|---|---|
| Component | `InvoiceCard.tsx` |
| Hook | `useInvoice.ts` |
| Service | `invoice.service.ts` |
| Repository | `invoice.repository.ts` |
| Schema | `invoiceSchema.ts` |
| Utility | `calculateTax.ts` |
| Constant | `INVOICE_STATUSES.ts` (upper snake) |
| Type | `InvoiceFilter` (PascalCase) |

---

## React Rules

- Functional components only — never class components
- No props drilling — use context, React Query, or composition
- No inline business logic in JSX
- No anonymous arrow functions in JSX render (performance + display names)
- Always add `displayName` to `forwardRef` components

---

## Database Rules (Every table)

All tables must have:
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
organization_id UUID NOT NULL REFERENCES organizations(id)
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at      TIMESTAMPTZ                          -- soft delete
created_by      UUID REFERENCES users(id)
updated_by      UUID REFERENCES users(id)
deleted_by      UUID REFERENCES users(id)
version         INTEGER NOT NULL DEFAULT 1           -- optimistic lock
```

- Naming: snake_case for tables and columns
- Foreign keys: `{entity}_id`
- Indexes: `idx_{table}_{column}`
- Unique constraints: `uq_{table}_{field}`
- RLS on every table: `organization_id = auth.uid()`
- Soft deletes always — never hard delete business records
- Financial records are immutable

---

## Security Rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code
- Every API route validates: auth token → user status → org membership → permissions
- Permission format: `module.action` (e.g. `invoice.create`, `inventory.adjust`)
- All inputs validated with Zod server-side — never trust client input
- Use parameterized queries (Supabase client handles this automatically)
- Cross-organization access is prohibited at both RLS and application layers
- Every mutating action must generate an audit log

---

## Supabase Clients

```typescript
// Client Component:
import { createClient } from "@/lib/supabase/client";

// Server Component / Route Handler / Server Action:
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Admin operations (NEVER in client-facing code):
import { createServiceRoleClient } from "@/lib/supabase/server";
```

---

## Component Standards

- Import order: React → Next.js → external libs → internal (@/) → relative
- Every component exported from a barrel index file per domain
- Empty state: use `<EmptyState>` from `@/components/shared/empty-state`
- Error state: use `<ErrorState>` from `@/components/shared/error-state`
- Loading: use `<LoadingSpinner>` or `<PageLoader>` from `@/components/shared/loading-spinner`
- All tables use `<SkeletonTable>` during loading
- Colors: primary `#2563EB`, success `#16A34A`, warning `#F59E0B`, error `#DC2626`
- Font: Inter via `--font-inter` CSS variable
- Animations: Framer Motion, 150–300ms duration, never over-animate

---

## Testing Standards

Every feature requires:
1. **Unit tests** — services, utilities, schemas (Vitest)
2. **Component tests** — rendering, interaction, a11y (Vitest + RTL)
3. **Integration tests** — module interactions
4. **E2E tests** — critical user journeys (Playwright)

Test utilities: `src/tests/utils.tsx` — always use `render` from there, not RTL directly.
Coverage target: 90%+ (enforced in CI).

---

## Self-QA Checklist (before marking any feature done)

- [ ] `pnpm lint` — zero errors
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all passing
- [ ] `pnpm build` — success
- [ ] UI tested on mobile, tablet, desktop
- [ ] Empty state present
- [ ] Loading state present
- [ ] Error state present
- [ ] Keyboard navigation works
- [ ] ARIA labels present on interactive elements
- [ ] No `console.error` in browser
- [ ] Audit log generated for mutating actions
- [ ] Tenant isolation enforced (org_id on all queries)

---

## Git Conventions

```
feat(module): short description
fix(module): short description
refactor(module): short description
docs: update README
test(module): add coverage for X
perf(module): optimize Y query
```

Branch: `feature/{ticket}-short-description`, `fix/{ticket}-description`
PRs: always against `develop`, never directly to `main`.

---

## Sprint 0 Completion Status

- [x] Next.js 15 + TypeScript strict scaffolded
- [x] Tailwind CSS with full design token configuration
- [x] shadcn/ui base components (Button, Card, Badge, Skeleton, Separator)
- [x] Design system: colors, typography, spacing, animations
- [x] Folder structure: Modular Monolith + Clean Architecture
- [x] Supabase client/server wiring + middleware
- [x] Environment configuration (.env.local.example)
- [x] ESLint (strict, no-any, consistent-type-imports)
- [x] Prettier with tailwindcss plugin
- [x] Vitest + React Testing Library + coverage
- [x] Playwright E2E config + smoke test
- [x] GitHub Actions CI (lint, typecheck, tests, build, E2E)
- [x] Dockerfile (production multi-stage) + docker-compose.yml
- [x] README.md + CLAUDE.md
- [x] Supabase config.toml for local development
