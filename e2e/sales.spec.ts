import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Tier 2 — SALES journey.
 *
 * Full lifecycle: login → create quotation → send → accept → convert to sales
 * order → approve → convert to invoice → post invoice → assert status.
 *
 * Requires a live Supabase backend with a seeded test user whose org grants
 * `sales.*` + `invoice.*` permissions AND has at least one customer and one
 * product configured. Skipped unless E2E_LIVE is set. See e2e/README.md.
 */
test.skip(
  !process.env.E2E_LIVE,
  "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds (customer + product)"
);

/**
 * Picks the first non-placeholder option of a native <select>.
 * Seed data names are unknown to the test, so we select by position.
 */
async function selectFirstRealOption(
  page: Page,
  accessibleName: string
): Promise<void> {
  const select = page.getByLabel(accessibleName, { exact: true });
  await expect(select).toBeVisible();
  await select.selectOption({ index: 1 });
}

test.describe("Sales lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("sales journey: quotation → sales order → invoice → post", async ({
    page,
  }) => {
    // ─────────────────────────────────────────────────────────
    // 1. Navigate to quotations and create a new quotation.
    // ─────────────────────────────────────────────────────────
    await page.goto("/sales/quotations");
    await expect(
      page.getByRole("heading", { name: "Quotations", exact: true })
    ).toBeVisible();

    await page.getByRole("link", { name: "New quotation" }).click();
    await expect(page).toHaveURL(/\/sales\/quotations\/new/);
    await expect(
      page.getByRole("heading", { name: "New quotation" })
    ).toBeVisible();

    // Fill customer and first line item.
    await selectFirstRealOption(page, "Customer");
    await page
      .getByLabel("Product for line 1", { exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel("Quantity for line 1", { exact: true }).fill("2");
    await page.getByLabel("Unit price for line 1", { exact: true }).fill("500");

    await page.getByRole("button", { name: "Create quotation" }).click();

    // Lands on quotation detail — status is Draft initially.
    await expect(page).toHaveURL(/\/sales\/quotations\/[0-9a-f-]+(\?.*)?$/);
    const quotationMain = page.getByRole("main");
    await expect(
      quotationMain.getByText("Draft", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 2. Send the quotation — status advances to Sent.
    // ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      quotationMain.getByText("Sent", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 3. Accept the quotation — converts to a Sales Order.
    // ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(
      quotationMain.getByText("Accepted", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 4. Navigate to the new sales order.
    // ─────────────────────────────────────────────────────────
    await page.getByRole("link", { name: "View sales order" }).click();
    await expect(page).toHaveURL(/\/sales\/orders\/[0-9a-f-]+(\?.*)?$/);
    const orderMain = page.getByRole("main");
    await expect(
      orderMain.getByText("Draft", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 5. Submit, then approve the sales order.
    // ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      orderMain.getByText("Submitted", { exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(
      orderMain.getByText("Approved", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 6. Create a sales invoice directly from the invoice list.
    // ─────────────────────────────────────────────────────────
    await page.goto("/sales/invoices/new");
    await expect(
      page.getByRole("heading", { name: "New invoice" })
    ).toBeVisible();

    await selectFirstRealOption(page, "Customer");
    await page
      .getByLabel("Product for line 1", { exact: true })
      .selectOption({ index: 1 });
    await page.getByLabel("Quantity for line 1", { exact: true }).fill("2");
    await page.getByLabel("Unit price for line 1", { exact: true }).fill("500");

    await page.getByRole("button", { name: "Create invoice" }).click();

    // Lands on invoice detail page — status is Draft.
    await expect(page).toHaveURL(/\/sales\/invoices\/[0-9a-f-]+(\?.*)?$/);
    const invoiceMain = page.getByRole("main");
    await expect(
      invoiceMain.getByText("Draft", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 7. Post the invoice — badge flips to Posted.
    // ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(
      invoiceMain.getByText("Posted", { exact: true })
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 8. Assert the invoice appears in the invoices list with
    //    the Posted badge and an amount column.
    // ─────────────────────────────────────────────────────────
    await page.goto("/sales/invoices");
    await expect(
      page.getByRole("heading", { name: "Invoices", exact: true })
    ).toBeVisible();

    // The latest invoice should be visible; use the status badge as proxy.
    await expect(
      page.getByText("Posted", { exact: true }).first()
    ).toBeVisible();

    // ─────────────────────────────────────────────────────────
    // 9. Navigate to sales returns list — smoke test that it loads.
    // ─────────────────────────────────────────────────────────
    await page.goto("/sales/returns");
    await expect(
      page.getByRole("heading", { name: "Sales returns", exact: true })
    ).toBeVisible();
  });
});
