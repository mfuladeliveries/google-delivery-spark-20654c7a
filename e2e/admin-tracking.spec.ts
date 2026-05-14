import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// Admin smoke tests + a guaranteed cleanup hook.
//
// The cleanup runs in test.afterAll so it executes even if any of the
// admin smoke tests above fail or throw. It spins up its own browser
// context from the persisted admin storage state on disk (rather than
// relying on the per-test `page` fixture) so it doesn't depend on the
// last test ending in a usable state.

const ADMIN_STORAGE = "e2e/.auth/admin.json";

async function runAdminCleanup(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.warn(
      "[e2e cleanup] Skipping: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set in .env.e2e.",
    );
    return;
  }

  if (!fs.existsSync(path.resolve(ADMIN_STORAGE))) {
    console.warn(
      `[e2e cleanup] Skipping: admin storage state not found at ${ADMIN_STORAGE}. Did auth.setup.ts run?`,
    );
    return;
  }

  // Pull the admin access token straight out of the saved storage state
  // so we don't need a live page session to perform cleanup.
  let accessToken: string | null = null;
  try {
    const raw = JSON.parse(fs.readFileSync(ADMIN_STORAGE, "utf8"));
    const origins = raw?.origins ?? [];
    for (const origin of origins) {
      for (const item of origin.localStorage ?? []) {
        if (
          typeof item.name === "string" &&
          item.name.startsWith("sb-") &&
          item.name.endsWith("-auth-token")
        ) {
          try {
            const parsed = JSON.parse(item.value ?? "{}");
            accessToken = parsed.access_token ?? null;
            if (accessToken) break;
          } catch {
            /* ignore */
          }
        }
      }
      if (accessToken) break;
    }
  } catch (err) {
    console.warn(`[e2e cleanup] Could not parse admin storage state: ${err}`);
    return;
  }

  if (!accessToken) {
    console.warn("[e2e cleanup] Skipping: no Supabase access token found in admin storage state.");
    return;
  }

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });

  // Find recent orders that look like they came from the E2E customer.
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
    console.warn(`[e2e cleanup] Could not query orders: ${queryErr.message}`);
    return;
  }

  const e2eOrders = (openOrders ?? []).filter((o) =>
    (o.customer_name ?? "").toLowerCase().includes("e2e"),
  );

  if (e2eOrders.length === 0) {
    console.log("[e2e cleanup] No leftover E2E orders to cancel.");
    return;
  }

  for (const order of e2eOrders) {
    const { error: cancelErr } = await supabase.rpc("admin_cancel_order", {
      p_order_id: order.id,
      p_reason: "E2E test cleanup",
    });
    if (cancelErr) {
      console.warn(`[e2e cleanup] Could not cancel order ${order.id}: ${cancelErr.message}`);
    } else {
      console.log(`[e2e cleanup] Cancelled leftover order ${order.id}.`);
    }
  }
}

test.describe("Admin dashboard", () => {
  // Guaranteed-to-run cleanup. afterAll executes even if every test in
  // this describe block fails, and it does its own context bootstrap so
  // it doesn't depend on any prior `page` fixture being healthy.
  test.afterAll(async () => {
    try {
      await runAdminCleanup();
    } catch (err) {
      // Never let cleanup itself fail the suite — just surface a warning.
      console.warn(`[e2e cleanup] Unexpected error during cleanup: ${err}`);
    }
  });

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
    const namedOrder = page.getByRole("button", { name: /order #|view|details/i }).first();
    const target = (await testidOrder.isVisible().catch(() => false)) ? testidOrder : namedOrder;

    if (await target.isVisible().catch(() => false)) {
      await target.click();
      await expect(page.getByText(/order|customer|status/i).first()).toBeVisible();
    }
  });
});
