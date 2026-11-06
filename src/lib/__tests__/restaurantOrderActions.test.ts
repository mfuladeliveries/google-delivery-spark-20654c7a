import { describe, expect, it } from "vitest";
import { canRestaurantTransition, nextRestaurantStatus, restaurantNeedsDecision, resolveRejectionReason, RESTAURANT_ORDER_REFRESH_MS } from "../restaurantOrderActions";

it("refreshes restaurant orders every 10 seconds", () => {
  expect(RESTAURANT_ORDER_REFRESH_MS).toBe(10_000);
});

describe("restaurant order decisions", () => {
  it("offers accept and reject for new orders and availability requests", () => {
    expect(restaurantNeedsDecision("pending")).toBe(true);
    expect(restaurantNeedsDecision("awaiting_restaurant")).toBe(true);
    expect(restaurantNeedsDecision("confirmed")).toBe(false);
    expect(canRestaurantTransition("pending", "confirmed")).toBe(true);
    expect(canRestaurantTransition("pending", "rejected")).toBe(true);
  });
  it("prepares accepted orders before marking them ready", () => {
    expect(nextRestaurantStatus("confirmed")).toBe("preparing");
    expect(nextRestaurantStatus("preparing")).toBe("ready");
    expect(canRestaurantTransition("confirmed", "ready")).toBe(false);
  });
  it("does not change payment, driver or completed stages", () => {
    for (const status of ["awaiting_restaurant", "pending_payment", "ready", "driver_assigned", "delivered", "rejected", "cancelled"]) {
      expect(canRestaurantTransition(status, "confirmed")).toBe(false);
      expect(nextRestaurantStatus(status)).toBe(null);
    }
  });
});

describe("rejection reasons", () => {
  it("requires a reason before an order can be rejected", () => {
    expect(resolveRejectionReason("", "")).toBe(null);
    expect(resolveRejectionReason("Other", "")).toBe(null);
    expect(resolveRejectionReason("Other", "   ")).toBe(null);
  });
  it("uses the preset reason directly", () => {
    expect(resolveRejectionReason("Ingredients unavailable", "")).toBe("Ingredients unavailable");
    expect(resolveRejectionReason("Kitchen closed", "ignored")).toBe("Kitchen closed");
  });
  it("uses the typed detail for Other", () => {
    expect(resolveRejectionReason("Other", "Load shedding")).toBe("Load shedding");
  });
});