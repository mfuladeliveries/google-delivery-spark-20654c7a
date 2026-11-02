import { describe, expect, it } from "vitest";
import { checkoutAction, paidFulfilmentStatus } from "../../../supabase/functions/_shared/paymentRules";
import { deliverPaymentNotifications } from "../../../supabase/functions/_shared/paymentNotifications";

describe("Yoco checkout safety", () => {
  it("reuses an existing payable checkout rather than creating a duplicate", () => {
    expect(checkoutAction("created", true)).toBe("reuse");
    expect(checkoutAction("started", true)).toBe("reuse");
  });
  it("requires confirmation rather than repayment for successful checkouts", () => {
    expect(checkoutAction("completed", true)).toBe("confirm");
    expect(checkoutAction("succeeded", true)).toBe("confirm");
  });
  it("replaces only verified failed, cancelled or expired checkouts", () => {
    for (const status of ["failed", "cancelled", "expired"]) expect(checkoutAction(status, false)).toBe("replace");
    for (const status of [undefined, "processing", "unknown", "created"]) expect(checkoutAction(status, false)).toBe("wait");
  });
  it("keeps already-approved restaurants in preparation and auto orders ready for drivers", () => {
    expect(paidFulfilmentStatus("restaurant")).toBe("confirmed");
    expect(paidFulfilmentStatus("admin")).toBe("confirmed");
    expect(paidFulfilmentStatus("auto")).toBe("ready");
  });
});

describe("durable payment notifications", () => {
  function mockQueue(response: unknown) {
    const updates: Record<string, unknown>[] = [];
    const filters: unknown[] = [];
    const client = {
      rpc: async () => ({ data: [{ order_id: "order", lease_token: "lease", attempts: 1 }] }),
      functions: { invoke: async () => response },
      from: () => ({ update: (values: Record<string, unknown>) => {
        updates.push(values);
        const chain = { eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
        return chain;
      } }),
    };
    return { client, updates, filters };
  }
  it("marks only successful notification delivery complete under its lease", async () => {
    const { client, updates, filters } = mockQueue({ data: { sent: 3, failed: 0 }, error: null });
    await deliverPaymentNotifications(client);
    expect(updates[0].sent_at).toEqual(expect.any(String));
    expect(updates[0].last_error).toBeNull();
    expect(filters).toContainEqual(["lease_token", "lease"]);
  });
  it("retains partial delivery for a later retry", async () => {
    const { client, updates } = mockQueue({ data: { sent: 2, failed: 1 }, error: null });
    await deliverPaymentNotifications(client);
    expect(updates[0].sent_at).toBeNull();
    expect(updates[0].last_error).toBe("Some payment notifications failed");
  });
  it("does not treat a notification service error as delivered", async () => {
    const { client, updates } = mockQueue({ data: { error: "VAPID keys not configured" }, error: null });
    await deliverPaymentNotifications(client);
    expect(updates[0].sent_at).toBeNull();
    expect(updates[0].last_error).toBe("VAPID keys not configured");
  });
});