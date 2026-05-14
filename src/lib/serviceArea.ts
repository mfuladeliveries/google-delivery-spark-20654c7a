// Coordinate-based delivery zones with dynamic per-km pricing.
// A zone has a centre (lat/lng), a radius and a pricing model:
//   delivery_fee = clamp(base_fee + price_per_km * distance_km, min_fee, max_fee)
// "distance_km" for pricing is restaurant -> customer (preferred) or zone-centre -> customer.

import { supabase } from "@/integrations/supabase/client";

export interface DeliveryZone {
  id: string;
  name: string;
  suburb: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  /** Legacy flat fee — kept so old callers compile. New code uses base_fee/price_per_km. */
  delivery_fee: number;
  base_fee: number;
  price_per_km: number;
  min_fee: number | null;
  max_fee: number | null;
  is_active: boolean;
}

/** Default radius shown to customers in error copy. */
export const DEFAULT_ZONE_RADIUS_KM = 5;

/** Haversine distance in kilometres. */
export const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Apply the per-zone formula and clamp by min/max. */
export const calcZoneFee = (
  zone: Pick<DeliveryZone, "base_fee" | "price_per_km" | "min_fee" | "max_fee">,
  distanceKmValue: number,
): number => {
  const base = Number(zone.base_fee ?? 0);
  const perKm = Number(zone.price_per_km ?? 0);
  let v = base + perKm * Math.max(0, distanceKmValue);
  v = Math.round(v * 100) / 100;
  if (zone.max_fee != null && v > Number(zone.max_fee)) v = Number(zone.max_fee);
  if (zone.min_fee != null && v < Number(zone.min_fee)) v = Number(zone.min_fee);
  return v;
};

let zoneCache: DeliveryZone[] | null = null;
let zonePromise: Promise<DeliveryZone[]> | null = null;

/** Load active zones (with coords). Cached for the session. */
export const getActiveZones = async (): Promise<DeliveryZone[]> => {
  if (zoneCache) return zoneCache;
  if (zonePromise) return zonePromise;
  zonePromise = (async () => {
    const { data } = await supabase
      .from("delivery_areas")
      .select(
        "id, name, suburb, lat, lng, radius_km, delivery_fee, base_fee, price_per_km, min_fee, max_fee, is_active",
      )
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);
    zoneCache = (data ?? []) as DeliveryZone[];
    return zoneCache;
  })();
  return zonePromise;
};

export const refreshZones = (): void => {
  zoneCache = null;
  zonePromise = null;
};

export interface ZoneMatch {
  zone: DeliveryZone;
  /** Distance from zone centre to the customer (used to gate coverage). */
  distance_km: number;
  /**
   * Distance used to price the delivery: restaurant -> customer when a restaurant
   * location is provided, else zone-centre -> customer.
   */
  pricing_distance_km: number;
  /** Calculated, clamped delivery fee for this match. */
  delivery_fee: number;
}

/** Closest zone whose radius covers the customer, with calculated fee. */
export const findNearestZone = (
  lat: number,
  lng: number,
  zones: DeliveryZone[],
  restaurant?: { lat: number | null; lng: number | null } | null,
): ZoneMatch | null => {
  let best: { zone: DeliveryZone; distance_km: number } | null = null;
  for (const z of zones) {
    if (z.lat == null || z.lng == null) continue;
    const d = distanceKm(z.lat, z.lng, lat, lng);
    if (d <= Number(z.radius_km) && (!best || d < best.distance_km)) {
      best = { zone: z, distance_km: d };
    }
  }
  if (!best) return null;
  const pricingDistance =
    restaurant && restaurant.lat != null && restaurant.lng != null
      ? distanceKm(restaurant.lat, restaurant.lng, lat, lng)
      : best.distance_km;
  return {
    zone: best.zone,
    distance_km: best.distance_km,
    pricing_distance_km: pricingDistance,
    delivery_fee: calcZoneFee(best.zone, pricingDistance),
  };
};

/** Driver payout: 70% of the per-zone delivery fee, rounded to rand. */
export const driverPayoutForFee = (deliveryFee: number | null | undefined): number => {
  const fee = Number(deliveryFee ?? 0);
  return Math.round(fee * 0.7);
};

/** Out-of-zone error message shown to customers. */
export const OUT_OF_ZONE_MESSAGE = "Delivery is not available in your area yet.";
