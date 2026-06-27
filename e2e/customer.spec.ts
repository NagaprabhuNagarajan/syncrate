import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Tier 2 — CUSTOMER journey.
 *
 * Full lifecycle: login → list → create → find via search → open profile →
 * edit → archive → confirm it leaves the active list.
 *
 * Requires a live Supabase backend with a seeded test user whose org grants
 * `customer.*` permissions. Skipped unless E2E_LIVE is set. See e2e/README.md.
 */
test.skip(
  !process.env.E2E_LIVE,
  "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds"
);

test.describe("Customer lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("create, search, edit, then archive a customer", async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Customer ${stamp}`;
    const code = `E2E-${stamp}`;
    const company = `E2E Holdings ${stamp}`;

    // 1. Land on the customers list.
    await page.goto("/customers");
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true })
    ).toBeVisible();

    // 2. Open the create form.
    await page.getByRole("link", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/new/);
    await expect(
      page.getByRole("heading", { name: "Add customer" })
    ).toBeVisible();

    // 3. Fill the required fields and submit.
    await page.getByLabel("Customer name").fill(name);
    await page.getByLabel("Customer code").fill(code);
    await page.getByLabel("Mobile").fill("+91 98765 43210");
    await page.getByRole("button", { name: "Create customer" }).click();

    // 4. Back on the list.
    await expect(page).toHaveURL(/\/customers(\?.*)?$/);

    // 5. Search narrows the list to our new record. (Search is robust against
    // pagination/ordering, unlike asserting on the unfiltered first page.)
    const search = page.getByLabel("Search customers");
    await search.fill(name);
    await search.press("Enter");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // 6. Open the profile.
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name })).toBeVisible();

    // 7. Edit — change the company name and save. Saving returns to the LIST.
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\/edit/);
    const companyField = page.getByLabel("Company");
    await companyField.fill(company);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/customers(\?.*)?$/);

    // Re-open the profile and confirm the updated company is reflected.
    const searchAfterEdit = page.getByLabel("Search customers");
    await searchAfterEdit.fill(name);
    await searchAfterEdit.press("Enter");
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText(company)).toBeVisible();

    // 8. Archive from the profile via the confirmation dialog. The trigger
    // button is "Archive"; the dialog confirm is "Archive customer".
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Archive customer" }).click();

    // 9. Confirm it leaves the ACTIVE list.
    await expect(page).toHaveURL(/\/customers(\?.*)?$/);
    await page.getByLabel("Filter by status").selectOption("active");
    const activeSearch = page.getByLabel("Search customers");
    await activeSearch.fill(name);
    await activeSearch.press("Enter");
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);

    // Sanity: archiving is a soft-delete in this app (it sets deleted_at), so the
    // record is excluded from every listing — including the "Archived" filter.
    await page.getByLabel("Filter by status").selectOption("archived");
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });
});
