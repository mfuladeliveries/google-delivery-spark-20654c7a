import { describe, it, expect } from "vitest";
import {
  distanceKm,
  calcZoneFee,
  findNearestZone,
  driverPayoutForFee,
  DeliveryZone,
} from "@/lib/serviceArea";

const zone = (over: Partial<DeliveryZone> = {}): DeliveryZone => ({
  id: "z1",
  name: "Zone 1",
  suburb: "Mfuleni",
  lat: -34.0,
  lng: 18.6,
  radius_km: 5,
  delivery_fee: 40,
  base_fee: 20,
  price_per_km: 5,
  min_fee: null,
  max_fee: null,
  is_active: true,
  ...over,
});

describe("distanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(distanceKm(-34.0, 18.6, -34.0, 18.6)).toBe(0);
  });

  it("computes a known distance (Cape Town -> Johannesburg ~1260 km)", () => {
    const d = distanceKm(-33.9249, 18.4241, -26.2041, 28.0473);
    expect(d).toBeGreaterThan(1250);
    expect(d).toBeLessThan(1280);
  });

  it("is symmetric", () => {
    const a = distanceKm(-34.0, 18.6, -33.9, 18.5);
    const b = distanceKm(-33.9, 18.5, -34.0, 18.6);
    expect(a).toBeCloseTo(b, 10);
  });

  it("computes ~111 km for one degree of latitude", () => {
    expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
});

describe("calcZoneFee", () => {
  it("applies base + per-km", () => {
    expect(calcZoneFee({ base_fee: 20, price_per_km: 5, min_fee: null, max_fee: null }, 4)).toBe(40);
  });

  it("returns just the base fee at distance 0", () => {
    expect(calcZoneFee({ base_fee: 20, price_per_km: 5, min_fee: null, max_fee: null }, 0)).toBe(20);
  });

  it("clamps to max_fee", () => {
    expect(calcZoneFee({ base_fee: 20, price_per_km: 10, min_fee: null, max_fee: 60 }, 20)).toBe(60);
  });

  it("clamps up to min_fee", () => {
    expect(calcZoneFee({ base_fee: 5, price_per_km: 1, min_fee: 35, max_fee: null }, 1)).toBe(35);
  });

  it("treats negative distance as 0", () => {
    expect(calcZoneFee({ base_fee: 20, price_per_km: 5, min_fee: null, max_fee: null }, -10)).toBe(20);
  });

  it("treats missing fee config as 0", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(calcZoneFee({} as any, 3)).toBe(0);
  });

  it("rounds to 2 decimals", () => {
    const v = calcZoneFee({ base_fee: 10, price_per_km: 3.333, min_fee: null, max_fee: null }, 1);
    expect(v).toBe(13.33);
  });
});

describe("findNearestZone", () => {
  const near = zone({ id: "near", lat: -34.0, lng: 18.6, radius_km: 5 });
  const far = zone({ id: "far", lat: -34.05, lng: 18.65, radius_km: 20 });

  it("picks the closest covering zone", () => {
    const match = findNearestZone(-34.001, 18.601, [far, near]);
    expect(match?.zone.id).toBe("near");
    expect(match?.distance_km).toBeLessThan(1);
  });

  it("returns null when nothing is in range", () => {
    const match = findNearestZone(-26.2, 28.0, [near]);
    expect(match).toBeNull();
  });

  it("returns null for an empty zone list", () => {
    expect(findNearestZone(-34.0, 18.6, [])).toBeNull();
  });

  it("skips zones without coordinates", () => {
    expect(findNearestZone(-34.0, 18.6, [zone({ lat: null, lng: null })])).toBeNull();
  });

  it("includes a point exactly on the radius boundary", () => {
    // ~1 degree latitude north of centre, radius set to that distance.
    const d = distanceKm(-34.0, 18.6, -33.0, 18.6);
    const boundary = zone({ id: "b", radius_km: d });
    const match = findNearestZone(-33.0, 18.6, [boundary]);
    expect(match?.zone.id).toBe("b");
  });

  it("prices from the restaurant when restaurant coords are supplied", () => {
    const restaurant = { lat: -34.02, lng: 18.62 };
    const match = findNearestZone(-34.0, 18.6, [near], restaurant);
    const expectedDist = distanceKm(restaurant.lat, restaurant.lng, -34.0, 18.6);
    expect(match?.pricing_distance_km).toBeCloseTo(expectedDist, 6);
    expect(match?.delivery_fee).toBe(calcZoneFee(near, expectedDist));
  });

  it("falls back to zone-centre distance when the restaurant has no coords", () => {
    const match = findNearestZone(-34.01, 18.61, [near], { lat: null, lng: null });
    expect(match?.pricing_distance_km).toBeCloseTo(match!.distance_km, 10);
  });
});

describe("driverPayoutForFee", () => {
  it("pays 70% of the fee, rounded", () => {
    expect(driverPayoutForFee(55)).toBe(39); // 38.5 -> 39
    expect(driverPayoutForFee(40)).toBe(28);
  });

  it("handles null and undefined without throwing", () => {
    expect(driverPayoutForFee(null)).toBe(0);
    expect(driverPayoutForFee(undefined)).toBe(0);
  });

  it("handles 0", () => {
    expect(driverPayoutForFee(0)).toBe(0);
  });
});
