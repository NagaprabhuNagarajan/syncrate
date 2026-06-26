---
name: tech-stack-and-architecture
description: Full tech stack, architectural pattern, and layer responsibilities for Syncrate
metadata:
  type: project
---

**Architecture Pattern:** Modular Monolith with Clean Architecture and Domain-Driven Design. Each module is independently deployable-ready for future microservice migration.

**Layers per module:**
Presentation → Application → Domain → Infrastructure

Business logic must never depend on infrastructure.

**Frontend:**
- Next.js (App Router) — server components by default
- React, TypeScript (strict mode, no `any`)
- Tailwind CSS, shadcn/ui, Framer Motion
- TanStack Query, React Hook Form, Zod
- Lucide React (icons)

**Backend:**
- Supabase: PostgreSQL, Edge Functions, Row Level Security, Realtime, Storage
- AI Provider abstraction layer: OpenAI, Anthropic, Gemini, self-hosted
- Razorpay (payments), Resend (email)

**Infrastructure:**
- Vercel (hosting), Cloudflare (CDN/DDoS), GitHub Actions (CI/CD)
- Sentry (error tracking), PostHog (analytics + feature flags)
- OpenTelemetry (logging), Better Stack (status page), k6 (load testing)

**Key architectural principles:**
- Event-driven communication between modules (Invoice Created → Inventory Updated → Ledger Updated → Dashboard Refreshed)
- Multi-tenant isolation via `organization_id` on every query
- JWT auth via Supabase Auth; RBAC with fine-grained `module.action` permissions
- Environments: Local → Development → QA → Staging → Production

**Performance targets:**
- Login < 2s, Dashboard < 3s, Search < 300ms, Invoice < 2s, AI < 5s, 99.9% availability
