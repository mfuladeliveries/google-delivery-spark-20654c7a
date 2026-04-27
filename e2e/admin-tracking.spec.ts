import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// The admin spec also acts as the cleanup step: it uses the admin's own
// Supabase session to cancel the most recent E2E order placed by the
// customer test account so we don't ping real drivers indefinitely.

test.describe("Admin dashboard", () => {
  test("loads dashboard and lists orders", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });

    const heading = page.getByText(/orders|users|restaurants|drivers/i).first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test("can open an order detail view (smoke)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin(\/|$)/);

    // Prefer a stable testid if the admin tab renders shared order cards;
    // otherwise fall back to an accessible-name match.
    const testidOrder = page.locator('[data-testid="order-card"]').first();
    const namedOrder = page
      .getByRole("button", { name: /order #|view|details/i })
      .first();
    const target = (await testidOrder.isVisible().catch(() => false))
      ? testidOrder
      : namedOrder;

    if (await target.isVisible().catch(() => false)) {
      await target.click();
      await expect(page.getByText(/order|customer|status/i).first()).toBeVisible();
    }
  });

  test("cleanup: cancel any open orders left behind by the customer spec", async ({ page }) => {
    // Read the admin's Supabase auth token from the page context so we can
    // call admin_cancel_order on their behalf.
    const supabaseUrl = await page.evaluate(() => (window as any).__SUPABASE_URL__ ?? null);
    const supabaseKey = await page.evaluate(
      () => (window as any).__SUPABASE_PUBLISHABLE_KEY__ ?? null
    );

    // Fall back to env (Vite exposes them at build time but not at runtime
    // unless the app re-exports them — we read them from .env.e2e instead).
    const url = supabaseUrl ?? process.env.VITE_SUPABASE_URL;
    const key = supabaseKey ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      test.info().annotations.push({
        type: "skip-cleanup",
        description:
          "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.e2e to enable order cleanup.",
      });
      return;
    }

    // Reuse the admin's storage state by extracting the access token from
    // localStorage (Supabase stores it under sb-<ref>-auth-token).
    const accessToken = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) ?? "{}");
            return parsed.access_token ?? null;
          } catch {
            return null;
          }
        }
      }
      return null;
    });

    if (!accessToken) {
      test.info().annotations.push({
        type: "skip-cleanup",
        description: "Could not read admin access token from storage state.",
      });
      return;
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    });

    // Find recent orders that look like they came from the E2E customer.
    // We narrow by created_at within the last hour and an open status.
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: openOrders, error: queryErr } = await supabase
      .from("orders")
      .select("id,status,created_at,customer_name")
      .gte("created_at", cutoff)
      .in("status", [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "driver_assigned",
        "picking_up",
        "arrived_at_restaurant",
        "out_for_delivery",
      ])
      .order("created_at", { ascending: false })
      .limit(10);

    if (queryErr) {
      test.info().annotations.push({
        type: "cleanup-warning",
        description: `Could not query orders: ${queryErr.message}`,
      });
      return;
    }

    const e2eOrders = (openOrders ?? []).filter(
      (o) => (o.customer_name ?? "").toLowerCase().includes("e2e")
    );

    for (const order of e2eOrders) {
      const { error: cancelErr } = await supabase.rpc("admin_cancel_order", {
        p_order_id: order.id,
        p_reason: "E2E test cleanup",
      });
      if (cancelErr) {
        test.info().annotations.push({
          type: "cleanup-warning",
          description: `Could not cancel order ${order.id}: ${cancelErr.message}`,
        });
      }
    }
  });
});
