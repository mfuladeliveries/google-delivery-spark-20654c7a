import { describe, expect, it } from "vitest";
import { menuPricePending } from "../menuPriceVerification";

describe("Burger King price verification", () => {
  it("blocks an unconfirmed advertised price", () => {
    expect(menuPricePending("BURGER KING", { price: 49.9, is_available: true, price_verified: false })).toBe(true);
  });
  it("allows existing confirmed prices", () => {
    expect(menuPricePending("Burger King", { price: 75, is_available: true, price_verified: true })).toBe(false);
  });
  it("blocks zero prices", () => {
    expect(menuPricePending("Burger King", { price: 0, is_available: true, price_verified: true })).toBe(true);
  });
  it("preserves other restaurant behavior", () => {
    expect(menuPricePending("KFC", { price: 55, is_available: true })).toBe(false);
  });
});