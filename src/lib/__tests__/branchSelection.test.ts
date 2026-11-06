import { describe, expect, it } from "vitest";
import {
  branchForArea,
  getSelectedAreaId,
  setSelectedAreaId,
  type RestaurantLocation,
  validBranchCoordinates,
} from "../restaurantAreas";

const base = { restaurant_id: "kfc", active: true, delivery_enabled: true, is_open: true, opens_at: null, closes_at: null, operating_days: null, address: "" };
const mk = (id: string, area: string, lat: number | null, lng: number | null): RestaurantLocation =>
  ({ ...base, id, area_id: area, branch_name: id, lat, lng }) as RestaurantLocation;

describe("branch selection per delivery area", () => {
  it.each(["KFC", "Debonairs", "Pedros", "Burger King", "Steers", "Mdala Tshisanyama", "Other restaurant"])("uses area-specific coordinates for %s", (restaurant_id) => {
    const locations = [
      { ...mk("mfuleni", "Mfuleni", -33.99, 18.68), restaurant_id },
      { ...mk("delft", "Delft", -33.97, 18.64), restaurant_id },
    ];
    expect(branchForArea(locations, restaurant_id, "Delft")?.lat).toBe(-33.97);
    expect(branchForArea(locations, restaurant_id, "Mfuleni")?.lng).toBe(18.68);
  });
  it.each(["Mfuleni", "Delft", "Blue Downs", "Malibu", "Blackheath", "Eerste River", "Summerville", "Bardale Village"])("never substitutes another area for %s", (area) => {
    expect(branchForArea([mk("other", "unrelated", -33.97, 18.64)], "kfc", area)).toBeNull();
  });
  it("blocks branches without a known customer area", () => {
    expect(branchForArea([mk("delft", "Delft", -33.97, 18.64)], "kfc", null)).toBeNull();
  });
  it("excludes closed, inactive and delivery-disabled branches", () => {
    const b = mk("delft", "Delft", -33.97, 18.64);
    for (const unavailable of [{ ...b, active: false }, { ...b, delivery_enabled: false }, { ...b, is_open: false }]) {
      expect(branchForArea([unavailable], "kfc", "Delft")).toBeNull();
    }
  });
  it("rejects incomplete and invalid GPS coordinates", () => {
    expect(validBranchCoordinates(null, 18.64)).toBe(false);
    expect(validBranchCoordinates(-91, 18.64)).toBe(false);
    expect(validBranchCoordinates(-33.97, 181)).toBe(false);
    expect(validBranchCoordinates(NaN, 18.64)).toBe(false);
    expect(validBranchCoordinates(-33.97, 18.64)).toBe(true);
  });
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

describe("selected area changes", () => {
  it("notifies listeners so open screens re-resolve branch coordinates", () => {
    let notified = 0;
    const listener = () => {
      notified += 1;
    };
    window.addEventListener("mfula-area-changed", listener);
    try {
      setSelectedAreaId("area-b");
      expect(notified).toBe(1);
      expect(getSelectedAreaId()).toBe("area-b");
      setSelectedAreaId(null);
      expect(notified).toBe(2);
      expect(getSelectedAreaId()).toBeNull();
    } finally {
      window.removeEventListener("mfula-area-changed", listener);
      setSelectedAreaId(null);
    }
  });
});
