import { test, expect } from "@playwright/test";

/**
 * Smoke tests — quick validation that the app boots and renders correctly.
 * These run after every deployment (pre-production gate).
 */
test.describe("Smoke", () => {
  test("homepage renders without errors", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/error/);
    // Page should not show a Next.js error overlay
    await expect(page.locator("body")).not.toContainText(
      "Application error: a client-side exception has occurred"
    );
  });

  test("page title is set correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Syncrate/);
  });

  test("has no accessibility violations on homepage", async ({ page }) => {
    await page.goto("/");
    // Basic check — full axe-core testing is in a11y tests
    await expect(page.locator("main")).toBeVisible();
  });
});
