# Syncrate E2E Tests (Playwright)

End-to-end specs live in `e2e/` and run with [Playwright](https://playwright.dev).
Config: [`playwright.config.ts`](../playwright.config.ts) (testDir `./e2e`,
`baseURL` from `PLAYWRIGHT_BASE_URL`, default `http://localhost:3000`).

The specs are split into **two tiers** because authenticated flows need a real
Supabase backend, while the app boots fine with placeholder env for public pages.

| File | Tier | Needs a DB? |
|---|---|---|
| `public.spec.ts` | 1 — public pages, validation, auth redirects | No |
| `smoke.spec.ts` | 1 — boot/render smoke | No |
| `auth.spec.ts` | 2 — register / login / logout | Yes |
| `customer.spec.ts` | 2 — customer lifecycle | Yes |
| `supplier.spec.ts` | 2 — supplier lifecycle | Yes |
| `purchase.spec.ts` | 2 — procurement journey (PO → submit → approve → receive → invoice → post) | Yes |
| `helpers/auth.ts` | shared `loginAs` / `logout` / credential helpers | — |

Tier 2 specs guard themselves with
`test.skip(!process.env.E2E_LIVE, ...)`, so they are **skipped automatically**
unless `E2E_LIVE` is set. This keeps CI green without a database.

---

## Tier 1 — runs today (placeholder env)

These pass against the dev server even with placeholder Supabase keys — no
database required.

```bash
# 1. Install browsers once (downloads Chromium/Firefox/WebKit)
pnpm exec playwright install

# 2. Start the dev server (or let Playwright start it via webServer config)
pnpm dev          # http://localhost:3000

# 3. Run the public tier (Chromium is enough for a quick loop)
pnpm exec playwright test e2e/public.spec.ts --project=chromium --reporter=list

# …or the whole suite (Tier 2 specs will simply report as skipped):
pnpm test:e2e
```

Notes:
- When `CI` is unset, `playwright.config.ts` runs `pnpm dev` automatically with
  `reuseExistingServer: true`, so an already-running dev server is reused.
- The config defines five browser projects (Chromium, Firefox, WebKit, Mobile
  Chrome, Mobile Safari). Run a single project with `--project=chromium` if you
  have not installed the others.

---

## Tier 2 — authenticated journeys (requires a live backend)

Tier 2 drives real login and real data mutations, so it needs a running
Supabase instance, applied migrations, and a seeded test user + organization
with `customer.*` / `supplier.*` / `purchase.*` permissions. The purchase
journey (`purchase.spec.ts`) additionally needs at least one supplier, one
warehouse and one product seeded so the order/invoice selects have options; it
walks a full procurement chain (create PO → submit → approve → receive goods →
create a supplier invoice → post), asserting the status badge advances at each
step.

```bash
# 1. Start Docker, then the local Supabase stack
supabase start

# 2. Apply migrations (and regenerate types if needed)
pnpm db:reset           # or: supabase db push
pnpm db:generate-types

# 3. Seed a test user + organization with customer/supplier permissions.
#    (Create the auth user via the Supabase dashboard / API, then insert the
#     organization + membership + role rows, or use your seed script.)

# 4. Point the app at the local stack and provide test credentials.
#    `supabase start` prints the local API URL + anon key.
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<local-anon-key-from-supabase-start>"
export E2E_LIVE=1
export E2E_EMAIL="e2e@syncrate.test"
export E2E_PASSWORD="<seeded-password>"

# 5. Restart the dev server so it picks up the new env, then run the suite
pnpm dev
pnpm test:e2e
# or a single journey:
pnpm exec playwright test e2e/customer.spec.ts --project=chromium --reporter=list
```

If `E2E_LIVE` is set but `E2E_EMAIL` / `E2E_PASSWORD` are missing, the helpers
throw a clear error (and `auth.spec.ts` has an explicit credential-sanity test).

---

## Useful commands

```bash
pnpm exec playwright test --list                 # enumerate tests (no run)
pnpm exec playwright test e2e/public.spec.ts     # run one file
pnpm test:e2e:ui                                 # interactive UI mode
pnpm exec playwright show-report                 # open the last HTML report
```
