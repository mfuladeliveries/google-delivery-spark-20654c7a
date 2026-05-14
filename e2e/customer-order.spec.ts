import { test, expect } from "@playwright/test";

// Customer flow: browse restaurants → open menu → add an item → place a real order.
// The admin spec is responsible for cleaning the order up afterwards.
//
// Selectors prefer stable data-testid attributes (added in the React tree) and
// fall back to accessible-name queries only where unavoidable.
test.describe("Customer order flow", () => {
  test("browse, add to cart, and place an order", async ({ page }) => {
    await page.goto("/");

    // Pick the first OPEN restaurant card. Cards expose:
    //   data-testid="restaurant-card"
    //   data-restaurant-id="<uuid>"
    //   data-restaurant-open="true|false"
    const openCard = page
      .locator('[data-testid="restaurant-card"][data-restaurant-open="true"]')
      .first();
    await expect(openCard).toBeVisible({ timeout: 15_000 });
    await openCard.click();

    await page.waitForURL(/\/restaurant\/[^/]+$/);

    // Add the first menu item. MenuCard renders:
    //   data-testid="menu-add-button"
    const addButton = page.locator('[data-testid="menu-add-button"]').first();
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();

    // Open the cart drawer via the header trigger.
    const openCart = page.locator('[data-testid="open-cart-button"]');
    await expect(openCart).toBeVisible({ timeout: 5_000 });
    await openCart.click();

    // Cart "Place Order" CTA opens the checkout dialog.
    const cartCheckout = page.locator('[data-testid="cart-checkout-button"]');
    await expect(cartCheckout).toBeVisible({ timeout: 10_000 });
    await expect(cartCheckout).toBeEnabled({ timeout: 10_000 });
    await cartCheckout.click();

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
    const addressInput = dialog.getByPlaceholder(/address|street/i).first();
    if (await addressInput.isVisible().catch(() => false)) {
      await page.waitForTimeout(2000);
      const current = await addressInput.inputValue();
      if (!current) await addressInput.fill("123 Test Street, Johannesburg");
    }

    // Final submit lives inside the checkout dialog.
    const submit = page.locator('[data-testid="checkout-place-order-button"]');
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    // After successful create_verified_order the app navigates to
    // /order-confirmation or /orders. Accept either.
    await page.waitForURL(/\/(order-confirmation|orders)/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/(order-confirmation|orders)/);

    // Sanity check: a tracked order card shows up on /orders.
    if (/\/orders/.test(page.url())) {
      const orderCard = page.locator('[data-testid="order-card"]').first();
      await expect(orderCard).toBeVisible({ timeout: 10_000 });
      await expect(orderCard.locator('[data-testid="order-status-label"]')).toBeVisible();
    }
  });
});
