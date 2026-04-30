// Coordinate-based delivery zones — replaces the old global service-area circle.
// Each zone has a centre (lat/lng), a radius (default 5km) and a flat delivery fee.
// A customer can order if their delivery coords fall inside ANY active zone.

import { supabase } from "@/integrations/supabase/client";

export interface DeliveryZone {
  id: string;
  name: string;
  suburb: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  delivery_fee: number;
  is_active: boolean;
}

/** Default radius shown to customers in error copy. */
export const DEFAULT_ZONE_RADIUS_KM = 5;

/** Haversine distance in kilometres. */
export const distanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
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
      .select("id, name, suburb, lat, lng, radius_km, delivery_fee, is_active")
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
  distance_km: number;
}

/** Closest zone whose radius covers the point, or null. */
export const findNearestZone = (
  lat: number,
  lng: number,
  zones: DeliveryZone[],
): ZoneMatch | null => {
  let best: ZoneMatch | null = null;
  for (const z of zones) {
    if (z.lat == null || z.lng == null) continue;
    const d = distanceKm(z.lat, z.lng, lat, lng);
    if (d <= Number(z.radius_km) && (!best || d < best.distance_km)) {
      best = { zone: z, distance_km: d };
    }
  }
  return best;
};

/** Driver payout: 70% of the per-zone delivery fee, rounded to rand. */
export const driverPayoutForFee = (deliveryFee: number | null | undefined): number => {
  const fee = Number(deliveryFee ?? 0);
  return Math.round(fee * 0.7);
};

/** Out-of-zone error message shown to customers. */
export const OUT_OF_ZONE_MESSAGE =
  "Sorry, delivery is only available within 5km of this area.";
