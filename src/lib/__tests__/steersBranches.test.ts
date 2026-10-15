import { describe, expect, it } from "vitest";
import { branchForArea, type RestaurantLocation } from "../restaurantAreas";
import { computeUnitPrice } from "@/hooks/useCart";

const restaurantId = "1eba46bd-ed43-4e10-80dc-d07efb772a0d";
const branches: RestaurantLocation[] = [
  { id: "delft", restaurant_id: restaurantId, area_id: "49a9ab78-e2f5-4329-82a0-47250889a617", branch_name: "Steers Delft Mall", address: "Delft Mall", lat: -33.9763, lng: 18.64559, active: true, delivery_enabled: true, is_open: true, opens_at: null, closes_at: null, operating_days: null },
  { id: "melkbos", restaurant_id: restaurantId, area_id: "6bed9b06-57b2-4c31-ac77-dcdc0cc4152a", branch_name: "Steers Melkbosstrand", address: "Birkenhead Shopping Centre", lat: -33.7306416, lng: 18.4430685, active: true, delivery_enabled: true, is_open: true, opens_at: null, closes_at: null, operating_days: null },
];
describe("Steers area isolation", () => {
  it("selects only Delft for the Delft delivery area", () => {
    expect(branchForArea(branches, restaurantId, "49a9ab78-e2f5-4329-82a0-47250889a617")?.id).toBe("delft");
  });
  it("does not offer an unrelated branch in Mfuleni", () => {
    expect(branchForArea(branches, restaurantId, "710be50f-0238-4ea2-b492-d565b307a93a")).toBeNull();
  });
  it("preserves ordinary cart arithmetic for an admin-confirmed price", () => {
    const unit = computeUnitPrice({ id: "test-steers", name: "Test meal", price: 64.9, category: "Meals", caption: "", image: "", available: true });
    expect(unit).toBe(64.9);
    expect(Number((unit * 2).toFixed(2))).toBe(129.8);
  });
});