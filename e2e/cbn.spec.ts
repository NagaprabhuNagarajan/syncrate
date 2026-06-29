import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Connected Business Network (CBN) — Sprint 7.
 *
 * Tier 1 (runs today, no DB): the CBN routes are auth-protected.
 * Tier 2 (gated on E2E_LIVE): the discover → request → accept → exchange
 * journey. The full journey needs TWO organizations with a live Supabase
 * backend (one to send a connection request, one to accept it), so it is
 * gated and documented rather than run in CI. See e2e/README.md.
 */

// ── Tier 1 — protected routes redirect when logged out (runs without a DB) ────
test.describe("CBN — route protection", () => {
  for (const path of [
    "/cbn",
    "/cbn/discover",
    "/cbn/connections",
    "/cbn/catalog",
    "/cbn/synced-invoices",
    "/cbn/synced-orders",
  ]) {
    test(`visiting ${path} while logged out redirects to /login`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?redirectTo=/);
    });
  }
});

// ── Tier 2 — authenticated CBN journey (requires a live multi-org backend) ────
test.describe("CBN — discover & connect (live)", () => {
  test.skip(
    !process.env.E2E_LIVE,
    "Requires a live Supabase backend with two organizations — set E2E_LIVE=1"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("discover a business and send a connection request", async ({
    page,
  }) => {
    // 1. Discovery
    await page.goto("/cbn/discover");
    await expect(
      page.getByRole("heading", { name: "Business Discovery", exact: true })
    ).toBeVisible();

    // 2. Search for a counterparty business (seeded in the live env).
    const search = page.getByRole("searchbox").first();
    await search.fill(process.env.E2E_CBN_PARTNER ?? "Test Supplier");
    await search.press("Enter");

    // 3. Send a connection request from the first result.
    await page.getByRole("button", { name: /connect/i }).first().click();
    // A request dialog or confirmation appears.
    await expect(
      page.getByRole("button", { name: /send (request|connection)/i })
    ).toBeVisible();
    await page
      .getByRole("button", { name: /send (request|connection)/i })
      .click();

    // 4. The request now shows under Connections as pending.
    await page.goto("/cbn/connections");
    await expect(
      page.getByText(/pending/i).first()
    ).toBeVisible();
  });
});
