import { expect, type Page } from "@playwright/test";

/**
 * Shared E2E auth helpers.
 *
 * These helpers drive the real login form and therefore only work against a
 * live Supabase backend with a seeded test user. Tier-2 specs gate themselves
 * with `test.skip(!process.env.E2E_LIVE, ...)` before calling `loginAs`.
 */

/** Reads required test credentials from the environment. */
export function getTestCredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD must be set to run authenticated (Tier 2) specs."
    );
  }

  return { email, password };
}

/**
 * Logs in via the real `/login` form and waits until the app shell is reached.
 *
 * @param page  Playwright page.
 * @param creds Optional overrides; defaults to E2E_EMAIL / E2E_PASSWORD.
 */
export async function loginAs(
  page: Page,
  creds: { email: string; password: string } = getTestCredentials()
): Promise<void> {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Welcome back" })
  ).toBeVisible();

  await page.getByLabel("Email address").fill(creds.email);
  await page.getByLabel("Password", { exact: true }).fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Successful auth lands somewhere inside the authenticated app (dashboard,
  // org selection, or a redirectTo target) — never back on /login.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Signs out via the sidebar "Sign out" control and asserts we land on /login. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
