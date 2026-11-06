import { describe, expect, it } from "vitest";
import { primaryCartRestaurant, resolveCartPickup } from "../cartRestaurant";
import { distanceKm } from "../serviceArea";
import type { RestaurantLocation } from "../restaurantAreas";

const restaurants = [{ id: "kfc", name: "KFC", is_active: true, lat: -33.7308302, lng: 18.4427445 }];
const delft: RestaurantLocation = {
  id: "kfc-delft", restaurant_id: "kfc", area_id: "delft", branch_name: "KFC Delft",
  address: "", lat: -33.97608, lng: 18.64417, active: true, delivery_enabled: true,
  opens_at: null, closes_at: null, operating_days: null,
};
const customer = { lat: -33.97608, lng: 18.64417 };
const identity = { id: "kfc", name: "KFC" };

describe("cart branch pickup", () => {
  it("uses KFC Delft instead of the distant Melkbosstrand brand pin", () => {
    const pickup = resolveCartPickup(restaurants, [delft], identity, "delft", customer);
    expect(pickup).toEqual({ branchId: "kfc-delft", lat: -33.97608, lng: 18.64417 });
    expect(distanceKm(customer.lat, customer.lng, pickup?.lat ?? 0, pickup?.lng ?? 0)).toBe(0);
    expect(distanceKm(customer.lat, customer.lng, restaurants[0].lat, restaurants[0].lng)).toBeGreaterThan(32);
  });
  it("does not use a brand pin when the selected area has no branch", () => {
    expect(resolveCartPickup(restaurants, [delft], identity, "mfuleni", customer)).toBeNull();
  });
  it("resolves an older name-only cart to the active brand", () => {
    expect(resolveCartPickup([{ ...restaurants[0], id: "inactive", is_active: false }, ...restaurants], [delft], { id: null, name: "kfc" }, "delft", customer)?.branchId).toBe("kfc-delft");
  });
  it("does not let companion items select the restaurant pickup", () => {
    expect(primaryCartRestaurant([{ item: { restaurantName: "Mfula Shop", restaurantId: "shop" } }, { item: { restaurantName: "KFC", restaurantId: "kfc" } }])).toEqual(identity);
  });
});