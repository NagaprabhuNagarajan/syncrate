# Syncrate Principal Engineer — Memory Index

- [Project Overview](project-syncrate-overview.md) — Syncrate purpose, CBN differentiator, module priority order, current state (no code yet)
- [Tech Stack & Architecture](tech-stack-and-architecture.md) — Next.js/Supabase/Vercel stack, Modular Monolith + DDD + Clean Architecture, performance targets
- [Database Conventions](database-conventions.md) — Mandatory audit columns, naming standards, RLS rules, table domain groups
- [Coding Standards](coding-standards.md) — TypeScript rules, folder structure, file naming, anti-patterns, git conventions
- [Design System](design-system.md) — Color tokens, typography, spacing, animation rules, accessibility bar, table/form requirements
- [Auth & Permissions](auth-and-permissions.md) — Supabase Auth, RBAC, permission format (module.action), multi-tenant isolation rules
- [Sprint 5 Sales & Invoicing](sprint-5-sales-invoicing.md) — GST engine, pricing/discount engines, atomic RPCs, PDF route, E2E spec, status enums, column pitfalls
- [ESLint Pitfalls](feedback-eslint-pitfalls.md) — curly rule, no-non-null-assertion, consistent-type-imports — all frequently trip generated code
- [Sprint 6 Payments & Reports](sprint-6-payments-reports.md) — payment RPC design, accounting directions, new DB tables, module boundaries
- [Entity List/Detail/Form Revamp Template](feature-list-detail-revamp-template.md) — the customer→supplier premium CRUD pattern to mirror for any future entity revamp
