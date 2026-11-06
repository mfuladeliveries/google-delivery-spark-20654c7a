// @vitest-environment node
import { describe, expect, it } from "vitest";

const url = process.env.CANCELLATION_TEST_URL;
const key = process.env.CANCELLATION_TEST_KEY;
const token = process.env.CANCELLATION_TEST_CUSTOMER_TOKEN;
const unusedOrder = "00000000-0000-4000-8000-000000000099";

describe.skipIf(!url || !key || !token)("live cancellation API isolation (no order mutations)", () => {
  async function rpc(name: string, body: object, bearer: string | undefined) {
    if (!url || !key || !bearer) throw new Error("Confirmed customer test session required");
    return fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  it("denies customer-issued refunds", async () => {
    const result = await rpc("customer_choose_refund", { p_order_id: unusedOrder, p_method: "credits" }, token);
    expect(result.status).toBe(403);
  });
  it("requires the admin role for exceptional cancellation", async () => {
    const result = await rpc("admin_cancel_order", { p_order_id: unusedOrder }, token);
    expect(result.ok).toBe(false);
    expect((await result.json()).message).toBe("Admin only");
  });
  it("denies anonymous callers on both customer cancellation entry points", async () => {
    for (const name of ["customer_cancel_pending_order", "customer_cancel_recent_order"]) {
      const result = await rpc(name, { p_order_id: unusedOrder }, key);
      expect([401, 403]).toContain(result.status);
    }
  });
});