import { test, expect } from "@playwright/test";

test.describe("Restaurant dashboard", () => {
  test("loads orders view", async ({ page }) => {
    await page.goto("/restaurant/dashboard");
    await expect(page).toHaveURL(/\/restaurant(\/|$)/, { timeout: 15_000 });

    // The restaurant dashboard surfaces an Orders / Menu tab and a list of
    // current orders. We look for stable copy that exists in any of these.
    const indicators = page.getByText(/orders|menu|today|preparing|ready/i);
    await expect(indicators.first()).toBeVisible({ timeout: 15_000 });
  });
});
