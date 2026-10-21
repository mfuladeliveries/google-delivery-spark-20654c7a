import { test, expect } from "@playwright/test";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = process.env.E2E_ADMIN_ACCESS_TOKEN;
const customer = process.env.E2E_CUSTOMER_ACCESS_TOKEN;

test("anonymous visitors cannot read daily credit snapshots", async ({ request }) => {
  if (!url || !key) throw new Error("Public API configuration required");
  const response = await request.get(`${url}/rest/v1/daily_credit_usage?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  expect([401, 403]).toContain(response.status());
});

test("customers cannot read daily credit snapshots", async ({ request }) => {
  if (!url || !key || !customer) throw new Error("Confirmed customer session required");
  const response = await request.get(`${url}/rest/v1/daily_credit_usage?select=*&limit=7`, {
    headers: { apikey: key, Authorization: `Bearer ${customer}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([]);
});

test("admins read the real dated running credit snapshot", async ({ request }) => {
  if (!url || !key || !admin) throw new Error("Admin session required");
  const response = await request.get(`${url}/rest/v1/daily_credit_usage?select=recorded_date,backend_credits,function_credits,storage_credits,traffic_credits&recorded_date=eq.2026-10-20`, {
    headers: { apikey: key, Authorization: `Bearer ${admin}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual([{ recorded_date: "2026-10-20", backend_credits: 1.8580608,
    function_credits: 0.04999, storage_credits: 0.000043808, traffic_credits: 0.014254134 }]);
});