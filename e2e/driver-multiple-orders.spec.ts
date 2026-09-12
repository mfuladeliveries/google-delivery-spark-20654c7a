import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

function accessTokenFromStorage(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const origin of raw?.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item.name?.startsWith("sb-") && item.name?.endsWith("-auth-token")) {
        try {
          return JSON.parse(item.value)?.access_token ?? null;
        } catch {
          // ignore malformed storage entries
        }
      }
    }
  }
  return null;
}

test("driver can accept another order while already carrying an active delivery", async ({ page }) => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const token = accessTokenFromStorage("e2e/.auth/driver.json");

  test.skip(!url || !key || !token, "Supabase E2E credentials are required");

  const supabase = createClient(url!, key!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: me } = await supabase.auth.getUser(token!);
  const driverId = me.user?.id;
  test.skip(!driverId, "Could not resolve E2E driver user");

  const { data: active } = await supabase
    .from("orders")
    .select("id")
    .eq("driver_id", driverId!)
    .in("status", ["driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"])
    .limit(1);

  const { data: available } = await supabase
    .from("driver_orders")
    .select("id,offered_to_driver_id,dispatch_phase")
    .eq("status", "ready")
    .is("driver_id", null)
    .limit(5);

  test.skip(!active?.length || !available?.length, "Seed one active and one ready order to exercise this live regression test");

  const order = available![0] as any;
  const rpc = order.offered_to_driver_id === driverId ? "driver_accept_offer" : "claim_order";
  const { data, error } = await supabase.rpc(rpc as any, { p_order_id: order.id });

  expect(error, error?.message).toBeNull();
  expect(data).toBe(true);

  const { data: after } = await supabase
    .from("orders")
    .select("id")
    .eq("driver_id", driverId!)
    .in("status", ["driver_assigned", "picking_up", "arrived_at_restaurant", "out_for_delivery"]);

  expect((after ?? []).length).toBeGreaterThanOrEqual(2);

  await page.goto("/driver");
  await expect(page.getByText(/current trips/i)).toBeVisible({ timeout: 15_000 });
});
