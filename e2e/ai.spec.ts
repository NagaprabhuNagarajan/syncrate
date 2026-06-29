import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * AI Platform (CBOS) — Sprint 8.
 *
 * Tier 1 (runs today, no DB): every AI route is auth-protected.
 * Tier 2 (gated on E2E_LIVE): the assistant propose→approve journey and OCR
 * extraction need a live Supabase backend AND a configured ANTHROPIC_API_KEY,
 * so they are gated and documented rather than run in CI. See e2e/README.md.
 */

// ── Tier 1 — protected routes redirect when logged out (runs without a DB) ────
test.describe("AI Platform — route protection", () => {
  for (const path of [
    "/ai",
    "/ai/assistant",
    "/ai/ocr",
    "/ai/forecasting",
    "/ai/recommendations",
    "/ai/insights",
    "/ai/search",
    "/ai/reports",
  ]) {
    test(`visiting ${path} while logged out redirects to /login`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?redirectTo=/);
    });
  }
});

// ── Tier 2 — authenticated AI journeys (need a live backend + ANTHROPIC_API_KEY)
test.describe("AI Platform — assistant & OCR (live)", () => {
  test.skip(
    !process.env.E2E_LIVE,
    "Requires a live Supabase backend and a configured ANTHROPIC_API_KEY — set E2E_LIVE=1"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("the AI hub lists the capability launchers", async ({ page }) => {
    await page.goto("/ai");
    await expect(
      page.getByRole("heading", { name: "AI Platform", exact: true })
    ).toBeVisible();
    await expect(page.getByText("Business Assistant")).toBeVisible();
    await expect(page.getByText("Document OCR")).toBeVisible();
  });

  test("the assistant proposes an action for the user to approve", async ({
    page,
  }) => {
    await page.goto("/ai/assistant");
    const input = page.getByRole("textbox").first();
    await input.fill("Create an invoice for ABC Hardware with 10 Cement Bags");
    await input.press("Enter");
    // The assistant prepares a draft for review — it must not auto-create.
    await expect(
      page.getByRole("button", { name: /approve/i })
    ).toBeVisible({ timeout: 30_000 });
  });
});
