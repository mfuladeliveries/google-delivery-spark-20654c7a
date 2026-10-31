import { describe, expect, it } from "vitest";
import { canPayOrder, isConfirmedPaid, paymentBreakdown } from "../approvalPayment";

describe("approval payment rules", () => {
  it("resumes accepted online orders pending payment", () => {
    expect(canPayOrder({ status: "pending_payment", payment_status: "pending", payment_method: "online" })).toBe(true);
  });
  it("never sends rejected or unapproved orders to payment", () => {
    for (const status of ["rejected", "cancelled", "awaiting_restaurant"]) {
      expect(canPayOrder({ status, payment_status: "pending", payment_method: "online" })).toBe(false);
    }
  });
  it("does not restart paid, refunded or expired payments", () => {
    for (const payment_status of ["paid", "refunded", "expired"]) {
      expect(canPayOrder({ status: "pending_payment", payment_status, payment_method: "online" })).toBe(false);
    }
  });
  it("allows failed payments to be retried while the order is reserved", () => {
    expect(canPayOrder({ status: "pending_payment", payment_status: "failed", payment_method: "online" })).toBe(true);
  });
  it("preserves cash orders", () => {
    expect(canPayOrder({ status: "pending_payment", payment_method: "cash" })).toBe(false);
  });
  it("only shows success after paid confirmation, not a fulfilment status", () => {
    expect(isConfirmedPaid({ status: "ready", payment_status: "paid" })).toBe(true);
    for (const status of ["confirmed", "ready", "rejected", "cancelled"]) {
      expect(isConfirmedPaid({ status, payment_status: "pending" })).toBe(false);
    }
  });
  it("adds confirmed prices and fees and subtracts discounts and credits in cents", () => {
    expect(paymentBreakdown({ subtotal: 100, tax: 5, delivery_fee: 55, tip: 10, discount_amount: 10, credits_applied: 20, total: 140 })).toEqual({ total: 140, matches: true });
  });
  it("blocks checkout when the displayed breakdown differs from the saved total", () => {
    expect(paymentBreakdown({ subtotal: 100, tax: 5, delivery_fee: 55, tip: 0, discount_amount: 0, credits_applied: 0, total: 155 }).matches).toBe(false);
  });
});