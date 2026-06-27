import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Tier 2 — PURCHASE (procurement) journey.
 *
 * Full chain: login → create a purchase order (supplier + warehouse + a line
 * item) → submit → approve → receive goods → create a supplier purchase invoice
 * and post it. Each stage asserts the status badge advances.
 *
 * Requires a live Supabase backend with a seeded test user whose org grants
 * `purchase.*` permissions AND has at least one supplier, one warehouse and one
 * product to choose from. Skipped unless E2E_LIVE is set. See e2e/README.md.
 */
test.skip(
  !process.env.E2E_LIVE,
  "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds (supplier + warehouse + product)"
);

/**
 * Picks the first non-placeholder option of a native <select>. Seed data names
 * are unknown to the test, so we select by position (index 0 is the
 * "— Select —" placeholder) rather than by an exact label.
 */
async function selectFirstRealOption(
  page: Page,
  accessibleName: string
): Promise<void> {
  const select = page.getByLabel(accessibleName, { exact: true });
  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
}

test.describe("Purchase lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("create PO → submit → approve → receive → invoice → post", async ({
    page,
  }) => {
    // ───────────────────────────────────────────────────────────
    // 1. Create a purchase order.
    // ───────────────────────────────────────────────────────────
    await page.goto("/purchases");
    await expect(
      page.getByRole("heading", { name: "Purchase orders", exact: true })
    ).toBeVisible();

    await page.getByRole("link", { name: "New purchase order" }).click();
    await expect(page).toHaveURL(/\/purchases\/new/);
    await expect(
      page.getByRole("heading", { name: "New purchase order" })
    ).toBeVisible();

    // Header selects (supplier required, warehouse optional but we set it).
    await selectFirstRealOption(page, "Supplier");
    await selectFirstRealOption(page, "Warehouse");

    // First line item: product, quantity and unit price.
    await page
      .getByLabel("Product for line 1", { exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel("Quantity for line 1", { exact: true }).fill("2");
    await page.getByLabel("Unit price for line 1", { exact: true }).fill("100");

    await page
      .getByRole("button", { name: "Create purchase order" })
      .click();

    // Lands on the PO detail page (poNumber is dynamic — assert via URL + badge).
    await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]+(\?.*)?$/);
    const main = page.getByRole("main");
    await expect(main.getByText("Draft", { exact: true })).toBeVisible();

    // ───────────────────────────────────────────────────────────
    // 2. Submit, then approve — the status badge advances each time.
    // ───────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(main.getByText("Submitted", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(main.getByText("Approved", { exact: true })).toBeVisible();

    // ───────────────────────────────────────────────────────────
    // 3. Receive goods — accept the outstanding quantity.
    // ───────────────────────────────────────────────────────────
    await page.getByRole("link", { name: "Receive goods" }).click();
    await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]+\/receive/);
    await expect(
      page.getByRole("heading", { name: "Receive goods" })
    ).toBeVisible();

    // The "Receive now" inputs default to the outstanding quantity, so simply
    // recording the receipt accepts everything outstanding.
    await page.getByRole("button", { name: "Record receipt" }).click();

    // Back on the PO — fully receiving completes it; a partial receipt leaves it
    // partially received. Accept either terminal-of-receipt state.
    await expect(page).toHaveURL(/\/purchases\/[0-9a-f-]+(\?.*)?$/);
    await expect(
      main.getByText(/^(Completed|Partially received)$/)
    ).toBeVisible();

    // ───────────────────────────────────────────────────────────
    // 4. Create a supplier purchase invoice and post it.
    // ───────────────────────────────────────────────────────────
    await page.goto("/purchases/invoices/new");
    await expect(
      page.getByRole("heading", { name: "New purchase invoice" })
    ).toBeVisible();

    await selectFirstRealOption(page, "Supplier");
    await page
      .getByLabel("Product for line 1", { exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel("Quantity for line 1", { exact: true }).fill("1");
    await page.getByLabel("Unit price for line 1", { exact: true }).fill("100");

    // Saving creates the invoice in draft state and opens its detail page.
    await page
      .getByRole("button", { name: "Create purchase invoice" })
      .click();
    await expect(page).toHaveURL(/\/purchases\/invoices\/[0-9a-f-]+(\?.*)?$/);
    const invoiceMain = page.getByRole("main");
    await expect(invoiceMain.getByText("Draft", { exact: true })).toBeVisible();

    // Post the draft — the badge flips to "Posted".
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(
      invoiceMain.getByText("Posted", { exact: true })
    ).toBeVisible();
  });
});
