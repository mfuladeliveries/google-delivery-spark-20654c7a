import { describe, expect, it } from "vitest";
import { steersPricePending } from "../steersMenu";
describe("Steers branch price gating", () => {
  it("blocks unverified Steers products even with a reference price", () => {
    expect(steersPricePending("Steers", { price: 64.9, is_available: true, price_verified: false })).toBe(true);
  });
  it("blocks a zero pending price even if availability was enabled", () => {
    expect(steersPricePending("Steers", { price: 0, is_available: true, price_verified: true })).toBe(true);
  });
  it("allows a positive admin-confirmed available price", () => {
    expect(steersPricePending("Steers", { price: 64.9, is_available: true, price_verified: true })).toBe(false);
  });
  it("does not change KFC availability behavior", () => {
    expect(steersPricePending("KFC", { price: 0, is_available: false })).toBe(false);
  });
});