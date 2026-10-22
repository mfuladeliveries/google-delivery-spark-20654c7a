import { describe, expect, it } from "vitest";
import { branchForArea, type RestaurantLocation } from "../restaurantAreas";

const base = { restaurant_id: "kfc", active: true, delivery_enabled: true, is_open: true, opens_at: null, closes_at: null, operating_days: null, address: "" };
const mk = (id: string, area: string, lat: number | null, lng: number | null): RestaurantLocation =>
  ({ ...base, id, area_id: area, branch_name: id, lat, lng }) as RestaurantLocation;

describe("branch selection per delivery area", () => {
  it("hides a branch that has no map location", () => {
    expect(branchForArea([mk("mfuleni", "A", null, null)], "kfc", "A")).toBeNull();
  });
  it("picks the branch nearest the customer when an area has two", () => {
    const list = [mk("far", "A", -34.1, 18.8), mk("near", "A", -33.99, 18.69)];
    expect(branchForArea(list, "kfc", "A", { lat: -33.988, lng: 18.688 })?.id).toBe("near");
  });
  it("never offers another area's branch", () => {
    expect(branchForArea([mk("delft", "B", -33.97, 18.64)], "kfc", "A")).toBeNull();
  });
});
