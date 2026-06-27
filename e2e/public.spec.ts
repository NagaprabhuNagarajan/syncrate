import { test, expect } from "@playwright/test";

/**
 * Tier 1 — PUBLIC specs.
 *
 * These cover everything that genuinely works WITHOUT a database, i.e. against
 * `pnpm dev` running with placeholder Supabase env. No authentication, no data
 * mutations — only public pages, client-side form validation, and the
 * middleware redirects that protect the authenticated app.
 *
 * They are intended to pass today and in CI.
 */

test.describe("Public — landing", () => {
  test("renders the marketing landing page", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Syncrate", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText("AI-powered Connected Business Operating System")
    ).toBeVisible();
  });
});

test.describe("Public — login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders the login form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("shows client-side validation on empty submit", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();

    // react-hook-form + zod renders field errors as role="alert" paragraphs.
    await expect(page.getByRole("alert").first()).toBeVisible();
    // Validation must keep us on the login page (no server round-trip success).
    await expect(page).toHaveURL(/\/login/);
  });

  test('"Forgot password?" link navigates to the reset request page', async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('"Create one free" link navigates to register', async ({ page }) => {
    await page.getByRole("link", { name: "Create one free" }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("Public — register page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("renders the register form", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create account" })
    ).toBeVisible();
  });

  test("shows client-side validation errors on empty submit", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('"Sign in" link navigates back to login', async ({ page }) => {
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Public — protected route redirects", () => {
  const protectedRoutes = [
    "/dashboard",
    "/customers",
    "/suppliers",
    "/settings/team",
    "/settings/branches",
  ] as const;

  for (const route of protectedRoutes) {
    test(`visiting ${route} while logged out redirects to /login with redirectTo`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login/);
      // The middleware preserves the original destination as ?redirectTo=...
      const url = new URL(page.url());
      expect(url.searchParams.get("redirectTo")).toBe(route);
    });
  }

  test("accept-invitation redirect preserves the invitation token", async ({
    page,
  }) => {
    await page.goto("/accept-invitation?token=abc");

    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("redirectTo")).toBe("/accept-invitation");
  });
});
