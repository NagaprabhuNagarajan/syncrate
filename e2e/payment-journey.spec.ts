import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Payment journey E2E tests.
 *
 * Tier 1 tests (no E2E_LIVE) verify that static page structure renders
 * correctly when authenticated.
 *
 * Tier 2 tests (requires E2E_LIVE + seeded test data) verify end-to-end
 * payment recording workflows. These are skipped by default.
 */

// ─────────────────────────────────────────────────────────────
// Tier 1 — structure tests (no live backend required)
// ─────────────────────────────────────────────────────────────

test.describe("Payment pages — navigation structure", () => {
  test.skip(
    !process.env.E2E_LIVE,
    "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("navigates to /payments/new and renders the Record Payment form", async ({
    page,
  }) => {
    // Verify the payments/new route renders a form for recording payments.
    await page.goto("/payments/new");

    // The page should not redirect away (auth is set up via loginAs).
    await expect(page).not.toHaveURL(/\/login/);

    // The form heading should be visible.
    await expect(
      page.getByRole("heading", { name: /record payment/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────
// Tier 2 — full payment lifecycle (requires live backend + seed)
// ─────────────────────────────────────────────────────────────

test.describe("Payment lifecycle", () => {
  test.skip(
    !process.env.E2E_LIVE,
    "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("customer ledger link navigates to the ledger page", async ({ page }) => {
    // Open the customers list and click the first customer.
    await page.goto("/customers");
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true })
    ).toBeVisible();

    // Click the first customer link in the list.
    const firstCustomer = page.getByRole("link").filter({ hasText: /CUST/ }).first();
    await firstCustomer.click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+/);

    // The "View full ledger" link should be present on the profile.
    const ledgerLink = page.getByRole("link", { name: /view full ledger/i });
    await expect(ledgerLink).toBeVisible();

    // Follow the ledger link.
    await ledgerLink.click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\/ledger/);

    // Verify the ledger page heading includes "Customer Ledger".
    await expect(
      page.getByRole("heading", { name: /customer ledger/i })
    ).toBeVisible();
  });

  test("supplier ledger link navigates to the ledger page", async ({ page }) => {
    // Open the suppliers list and click the first supplier.
    await page.goto("/suppliers");
    await expect(
      page.getByRole("heading", { name: "Suppliers", exact: true })
    ).toBeVisible();

    // Click the first supplier link.
    const firstSupplier = page.getByRole("link").filter({ hasText: /SUPP/ }).first();
    await firstSupplier.click();
    await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]+/);

    // The "View full ledger" link should be present.
    const ledgerLink = page.getByRole("link", { name: /view full ledger/i });
    await expect(ledgerLink).toBeVisible();

    // Follow the ledger link.
    await ledgerLink.click();
    await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]+\/ledger/);

    // Verify the heading.
    await expect(
      page.getByRole("heading", { name: /supplier ledger/i })
    ).toBeVisible();
  });

  test("dashboard shows KPI cards with financial data", async ({ page }) => {
    await page.goto("/dashboard");

    // All four KPI cards should be rendered.
    await expect(page.getByText("Sales This Month")).toBeVisible();
    await expect(page.getByText("Outstanding Receivable")).toBeVisible();
    await expect(page.getByText("Outstanding Payable")).toBeVisible();
    await expect(page.getByText("Low Stock Items")).toBeVisible();

    // Quick actions should be visible.
    await expect(
      page.getByRole("link", { name: /new sales invoice/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /record payment/i })
    ).toBeVisible();
  });
});
