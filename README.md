# Syncrate

**AI-powered Connected Business Operating System for SMEs**

Syncrate helps businesses manage operations, connect with suppliers and customers, automate workflows, and make data-driven decisions — all from a single platform.

---

## What Makes Syncrate Different

Instead of exchanging PDF invoices through WhatsApp or email, connected businesses on Syncrate exchange structured digital transactions that automatically synchronize inventory, ledgers, and reports on both sides. This **Connected Business Network (CBN)** is the primary competitive advantage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| State | TanStack Query, React Hook Form, Zod |
| Backend | Supabase (PostgreSQL, Edge Functions, RLS, Realtime, Storage) |
| Auth | Supabase Auth (JWT + RBAC) |
| Infra | Vercel, Cloudflare, GitHub Actions |
| Testing | Vitest, React Testing Library, Playwright |

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker (for local Supabase)

### 1. Clone and install

```bash
git clone https://github.com/your-org/syncrate.git
cd syncrate
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase project credentials
```

### 3. Start local Supabase (optional — for local development)

```bash
# Install Supabase CLI
pnpm exec supabase start
```

Or use Docker Compose:

```bash
docker compose up -d
```

### 4. Run migrations

```bash
pnpm exec supabase db push
```

### 5. Start development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint + TypeScript check |
| `pnpm typecheck` | TypeScript type check only |
| `pnpm format` | Format all files with Prettier |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm db:generate-types` | Regenerate Supabase TypeScript types |
| `pnpm db:migration:new` | Create a new migration file |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
├── components/
│   ├── ui/                 # shadcn/ui base components
│   └── shared/             # Shared application components
├── features/               # Domain-organized feature modules
│   ├── identity/           # Auth, sessions
│   ├── organization/       # Org, branches, settings
│   ├── customer/           # Customer management
│   ├── supplier/           # Supplier management
│   ├── product/            # Product catalog
│   ├── inventory/          # Inventory + warehouses
│   ├── purchase/           # Purchase orders, GRN
│   ├── sales/              # Quotations, orders, invoices
│   ├── finance/            # Ledger, payments
│   ├── reports/            # Reports + analytics
│   ├── ai/                 # AI platform
│   ├── cbn/                # Connected Business Network
│   ├── notifications/      # Notification system
│   └── settings/           # App settings
├── hooks/                  # Shared custom hooks
├── services/               # Business logic services
├── repositories/           # Data access layer
├── schemas/                # Zod validation schemas
├── utils/                  # Shared utilities
├── types/                  # TypeScript type definitions
├── constants/              # App constants
├── lib/
│   └── supabase/           # Supabase client configuration
└── tests/                  # Test utilities and setup
supabase/
├── migrations/             # Database migration files
└── config.toml             # Supabase CLI configuration
e2e/                        # Playwright E2E tests
```

---

## Architecture

Syncrate follows **Modular Monolith** architecture with **Clean Architecture** and **Domain-Driven Design**:

```
Presentation Layer   (Next.js pages, components)
       ↓
Application Layer    (services, use cases)
       ↓
Domain Layer         (business logic, domain models)
       ↓
Infrastructure Layer (Supabase, external APIs)
```

Each feature module owns its data, business rules, and UI. Modules communicate through domain events, not direct dependencies.

---

## Security

- Every table has Row Level Security (RLS) enforced by `organization_id`
- Permission format: `module.action` (e.g. `invoice.create`, `inventory.adjust`)
- Service Role key is never exposed to the client
- All inputs validated with Zod on the server
- Zero Trust + Least Privilege Access model

---

## Documentation

All specification documents are in the `docs/` directory:

- `docs/SYSTEM_ARCHITECTURE.md` — Architecture overview
- `docs/DATABASE_SCHEMA.md` — Database design
- `docs/CODING_STANDARDS.md` — Engineering standards
- `docs/DESIGN_SYSTEM.md` — UI/UX system
- `docs/AUTHENTICATION_AND_PERMISSIONS.md` — Auth + RBAC
- `docs/CONNECTED_BUSINESS_NETWORK_SPECIFICATION.md` — CBN
- `docs/AI_PLATFORM_SPECIFICATION.md` — AI platform
- `docs/DEVELOPMENT_ROADMAP.md` — Release roadmap
- `docs/SPRINT_BACKLOG.md` — Sprint planning
- `docs/TESTING_STRATEGY.md` — Testing approach

---

## License

Proprietary. All rights reserved.
