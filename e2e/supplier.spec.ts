import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Tier 2 — SUPPLIER journey.
 *
 * Full lifecycle: login → list → create (incl. bank/UPI + rating) → find via
 * search → open profile → edit → archive → confirm it leaves the active list.
 *
 * Requires a live Supabase backend with a seeded test user whose org grants
 * `supplier.*` permissions. Skipped unless E2E_LIVE is set. See e2e/README.md.
 */
test.skip(
  !process.env.E2E_LIVE,
  "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds"
);

test.describe("Supplier lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("create with bank/UPI + rating, search, edit, then archive", async ({
    page,
  }) => {
    const stamp = Date.now();
    const name = `E2E Supplier ${stamp}`;
    const code = `SUP-${stamp}`;
    const upi = `e2e${stamp}@okhdfc`;
    const newContact = `Contact ${stamp}`;

    // 1. Land on the suppliers list.
    await page.goto("/suppliers");
    await expect(
      page.getByRole("heading", { name: "Suppliers", exact: true })
    ).toBeVisible();

    // 2. Open the create form.
    await page.getByRole("link", { name: "Add supplier" }).click();
    await expect(page).toHaveURL(/\/suppliers\/new/);
    await expect(
      page.getByRole("heading", { name: "Add supplier" })
    ).toBeVisible();

    // 3. Fill identity, bank/UPI and rating, then submit.
    await page.getByLabel("Supplier name").fill(name);
    await page.getByLabel("Supplier code").fill(code);
    await page.getByLabel("Contact person").fill("Initial Contact");
    await page.getByLabel("Mobile").fill("+91 91234 56789");
    await page.getByLabel("Account holder name").fill(name);
    await page.getByLabel("Account number").fill("123456789012");
    await page.getByLabel("IFSC code").fill("HDFC0001234");
    await page.getByLabel("UPI ID").fill(upi);
    await page.getByLabel("Rating").fill("4.5");
    await page.getByRole("button", { name: "Create supplier" }).click();

    // 4. Back on the list — the new supplier card appears. Use exact matching:
    // each card exposes both a title link and an "Edit {name}" aria-label link.
    await expect(page).toHaveURL(/\/suppliers(\?.*)?$/);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // 5. Search (client-side) narrows the grid to our record.
    await page.getByLabel("Search suppliers").fill(name);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    // 6. Open the profile and confirm the rating rendered.
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("4.5 / 5")).toBeVisible();

    // 7. Edit — change the contact person and save.
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/suppliers\/[0-9a-f-]+\/edit/);
    await page.getByLabel("Contact person").fill(newContact);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/suppliers(\?.*)?$/);

    // 8. Archive from the supplier card via the confirmation dialog.
    await page.getByLabel("Search suppliers").fill(name);
    await page.getByRole("button", { name: `Archive ${name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Archive supplier" }).click();

    // 9. Confirm it leaves the ACTIVE list. Filter labels need exact matching:
    // "Active" is a substring of "Inactive".
    const statusGroup = page.getByRole("group", { name: "Filter by status" });
    await statusGroup.getByRole("button", { name: "Active", exact: true }).click();
    await page.getByLabel("Search suppliers").fill(name);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);

    // Sanity: archiving is a soft-delete in this app (it sets deleted_at), so the
    // record is excluded from every listing — including the "Archived" filter.
    await statusGroup
      .getByRole("button", { name: "Archived", exact: true })
      .click();
    await page.getByLabel("Search suppliers").fill(name);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });
});
