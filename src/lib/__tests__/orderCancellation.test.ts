import { describe, expect, it } from "vitest";
import { canCustomerCancelOrder } from "../orderCancellation";

describe("strict customer cancellation policy", () => {
  it("blocks verified paid orders at every fulfilment stage", () => {
    for (const status of ["awaiting_restaurant", "pending_payment", "confirmed", "preparing", "ready", "driver_assigned", "out_for_delivery", "delivered"]) {
      expect(canCustomerCancelOrder({ status, payment_status: "paid" })).toBe(false);
    }
  });
  it("allows pending or unsuccessful payments without a five-minute limit", () => {
    for (const payment_status of ["pending", "pending_payment", "failed", "cancelled", "expired", "unpaid"]) {
      expect(canCustomerCancelOrder({ status: "pending_payment", payment_status })).toBe(true);
      expect(canCustomerCancelOrder({ status: "awaiting_restaurant", payment_status })).toBe(true);
    }
  });
  it("does not reopen final orders or allow unknown/refunded payment states", () => {
    for (const status of ["delivered", "cancelled", "rejected"]) {
      expect(canCustomerCancelOrder({ status, payment_status: "failed" })).toBe(false);
    }
    for (const payment_status of [undefined, "refunded", "processing", "success"]) {
      expect(canCustomerCancelOrder({ status: "confirmed", payment_status })).toBe(false);
    }
  });
});