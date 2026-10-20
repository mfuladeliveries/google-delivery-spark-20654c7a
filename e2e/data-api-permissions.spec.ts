import { test, expect } from "@playwright/test";

// Read-only: supply a confirmed customer session, never a service key.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.E2E_CUSTOMER_ACCESS_TOKEN;
const userId = process.env.E2E_CUSTOMER_USER_ID;

test("anonymous visitors cannot read private delivery or payment data", async ({ request }) => {
  test.skip(!url || !key, "Public API configuration required");
  if (!url || !key) return;
  for (const table of ["orders", "profiles", "customer_addresses", "driver_orders", "email_send_log", "payment_transactions"]) {
    const response = await request.get(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    expect([401, 403]).toContain(response.status());
  }
});

test("customers can read their own profile but not other users' personal records", async ({ request }) => {
  test.skip(!url || !key || !token || !userId, "Confirmed customer session required");
  if (!url || !key || !token || !userId) return;
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const own = await request.get(`${url}/rest/v1/profiles?select=user_id&user_id=eq.${userId}`, { headers });
  expect(own.status()).toBe(200);
  expect(await own.json()).toEqual([{ user_id: userId }]);
  for (const table of ["profiles", "orders", "customer_addresses"]) {
    const response = await request.get(`${url}/rest/v1/${table}?select=user_id&user_id=neq.${userId}&limit=1`, { headers });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  }
});

test("customers cannot read the authorized driver delivery feed", async ({ request }) => {
  test.skip(!url || !key || !token, "Confirmed customer session required");
  if (!url || !key || !token) return;
  const response = await request.get(`${url}/rest/v1/driver_orders?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});