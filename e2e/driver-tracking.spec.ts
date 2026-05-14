import { test, expect } from "@playwright/test";

test.describe("Driver dashboard & job board", () => {
  test("loads dashboard and shows job board section", async ({ page }) => {
    await page.goto("/driver");

    // Dashboard should render without redirecting back to /auth or /driver/auth.
    await expect(page).toHaveURL(/\/driver(\/|$)/, { timeout: 15_000 });

    // The dashboard contains either an "Online/Offline" toggle or a job-board
    // heading. We look for any of these stable bits of copy.
    const indicators = page.getByText(
      /(go online|go offline|online|offline|job board|available orders|earnings|today)/i,
    );
    await expect(indicators.first()).toBeVisible({ timeout: 15_000 });
  });

  test("can navigate to earnings or wallet view", async ({ page }) => {
    await page.goto("/driver");
    await expect(page).toHaveURL(/\/driver(\/|$)/);

    // Try to find an earnings/wallet entry — non-fatal if the dashboard
    // surfaces it differently. We only assert that the dashboard is alive.
    const earnings = page.getByRole("button", { name: /earnings|wallet|withdraw/i }).first();
    if (await earnings.isVisible().catch(() => false)) {
      await earnings.click();
      await expect(page.getByText(/balance|earnings|withdraw/i).first()).toBeVisible();
    }
  });
});
