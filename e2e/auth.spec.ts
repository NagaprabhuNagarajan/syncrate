import { test, expect } from "@playwright/test";
import { getTestCredentials, loginAs, logout } from "./helpers/auth";

/**
 * Tier 2 — AUTHENTICATED auth journeys.
 *
 * Requires a live Supabase backend (local or staging) with a seeded test user.
 * Skipped automatically unless E2E_LIVE is set. See e2e/README.md.
 */
test.skip(
  !process.env.E2E_LIVE,
  "Requires a live Supabase backend — set E2E_LIVE=1 with seeded test creds"
);

test.describe("Auth — registration", () => {
  test("register shows the email-verification notice", async ({ page }) => {
    // Use a unique address so the run is repeatable against a real backend.
    const unique = `e2e+${Date.now()}@syncrate.test`;
    const password = "Str0ngPass!";

    await page.goto("/register");

    await page.getByLabel("Full name").fill("E2E Test User");
    await page.getByLabel("Work email").fill(unique);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByLabel(/I agree to the/).check();

    await page.getByRole("button", { name: "Create account" }).click();

    // On success the server action redirects to /verify-email which renders the
    // "Check your email" success state.
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Check your email" })
    ).toBeVisible();
  });
});

test.describe("Auth — login & logout", () => {
  test("login with valid credentials reaches the authenticated app", async ({
    page,
  }) => {
    await loginAs(page);

    // Landing target is the dashboard (or org selection if multiple orgs).
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid credentials surface a server error and stay on /login", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email address").fill("does-not-exist@syncrate.test");
    await page.getByLabel("Password", { exact: true }).fill("WrongPass!123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout returns the user to the login page", async ({ page }) => {
    await loginAs(page);
    await page.goto("/dashboard");

    await logout(page);
    await expect(page).toHaveURL(/\/login/);

    // Confirm the session is truly gone: protected routes redirect again.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth — credential sanity", () => {
  test("test credentials are configured", () => {
    // Fails fast with a clear message if E2E_EMAIL / E2E_PASSWORD are missing.
    const creds = getTestCredentials();
    expect(creds.email).toBeTruthy();
    expect(creds.password).toBeTruthy();
  });
});
