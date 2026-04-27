import { test, expect } from "@playwright/test";

// Customer flow: browse restaurants → open menu → add an item → place a real order.
// The admin spec is responsible for cleaning the order up afterwards.
test.describe("Customer order flow", () => {
  test("browse, add to cart, and place an order", async ({ page }) => {
    await page.goto("/");

    // Home page should render at least one restaurant card. We click the first
    // active one we find by following the first link to /restaurant/<id>.
    const restaurantLink = page.locator('a[href^="/restaurant/"]').first();
    await expect(restaurantLink).toBeVisible({ timeout: 15_000 });
    await restaurantLink.click();

    await page.waitForURL(/\/restaurant\/[^/]+$/);

    // Find the first available menu item and add it to the cart.
    // Menu items expose an "Add" or "+" trigger; we use a permissive name match.
    const addButton = page
      .getByRole("button", { name: /^(add|add to cart|\+)$/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Open the cart and proceed. The Cart drawer/sheet has a "Place Order" CTA
    // (see src/components/Cart.tsx).
    const placeOrder = page.getByRole("button", { name: /place order/i });
    // The cart may auto-open after add, otherwise click a cart trigger.
    if (!(await placeOrder.isVisible().catch(() => false))) {
      // Try a generic cart trigger by aria-label, falling back to text.
      const cartToggle = page
        .getByRole("button", { name: /cart|view cart|basket/i })
        .first();
      if (await cartToggle.isVisible().catch(() => false)) {
        await cartToggle.click();
      }
    }
    await expect(placeOrder).toBeVisible({ timeout: 10_000 });
    await placeOrder.click();

    // Checkout dialog opens. It auto-fills the address from the mocked
    // geolocation set in playwright.config.ts. We still need to provide
    // name + contact if they are empty for this test account.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const nameInput = dialog.getByPlaceholder(/full name|your name/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      const current = await nameInput.inputValue();
      if (!current) await nameInput.fill("E2E Customer");
    }

    const contactInput = dialog.getByPlaceholder(/contact|phone|number/i).first();
    if (await contactInput.isVisible().catch(() => false)) {
      const current = await contactInput.inputValue();
      if (!current) await contactInput.fill("0820000000");
    }

    // Wait for the geolocation reverse-lookup to populate the address.
    // Allow up to 10s; if it never populates we fill it manually.
    const addressInput = dialog.getByPlaceholder(/address|street/i).first();
    if (await addressInput.isVisible().catch(() => false)) {
      await page.waitForTimeout(2000);
      const current = await addressInput.inputValue();
      if (!current) await addressInput.fill("123 Test Street, Johannesburg");
    }

    const submit = dialog.getByRole("button", { name: /place order/i });
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    // After successful create_verified_order the app navigates to
    // /order-confirmation or /orders. Accept either.
    await page.waitForURL(/\/(order-confirmation|orders)/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/(order-confirmation|orders)/);
  });
});
