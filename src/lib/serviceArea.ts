// Distance-based serviceability — replaces the old zone system.
// Customers never see "zones" — only a yes/no serviceability and a delivery fee.

import { supabase } from "@/integrations/supabase/client";

export interface ServiceAreaConfig {
  center_lat: number;
  center_lng: number;
  inner_radius_km: number;
  outer_radius_km: number;
  inner_fee: number;
  outer_fee: number;
}

export const DEFAULT_SERVICE_AREA: ServiceAreaConfig = {
  center_lat: -34.0233, // Mfuleni, Cape Town
  center_lng: 18.6781,
  inner_radius_km: 5,
  outer_radius_km: 10,
  inner_fee: 65,
  outer_fee: 75,
};

let cached: ServiceAreaConfig | null = null;
let cachePromise: Promise<ServiceAreaConfig> | null = null;

/** Load (and cache) the service area config from app_settings. */
export const getServiceArea = async (): Promise<ServiceAreaConfig> => {
  if (cached) return cached;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "service_area")
      .maybeSingle();
    const v = (data?.value ?? null) as Partial<ServiceAreaConfig> | null;
    cached = { ...DEFAULT_SERVICE_AREA, ...(v ?? {}) };
    return cached;
  })();
  return cachePromise;
};

/** Force-reload the service area (after admin updates it). */
export const refreshServiceArea = (): void => {
  cached = null;
  cachePromise = null;
};

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

export interface ServiceAreaResult {
  in_range: boolean;
  fee: number;
  distance_km: number;
}

/** Decide if a coordinate is serviceable and what the delivery fee is. */
export const evaluateServiceArea = (
  lat: number,
  lng: number,
  cfg: ServiceAreaConfig,
): ServiceAreaResult => {
  const d = distanceKm(cfg.center_lat, cfg.center_lng, lat, lng);
  if (d <= cfg.inner_radius_km) return { in_range: true, fee: cfg.inner_fee, distance_km: d };
  if (d <= cfg.outer_radius_km) return { in_range: true, fee: cfg.outer_fee, distance_km: d };
  return { in_range: false, fee: 0, distance_km: d };
};

/**
 * Driver payout per delivery, derived from the saved delivery_fee on the order.
 * Mirrors the public.update_driver_earnings trigger (R65 → R45, R75 → R55).
 * For any other / legacy fee we fall back to the historical 70% split.
 */
export const driverPayoutForFee = (deliveryFee: number | null | undefined): number => {
  const fee = Number(deliveryFee ?? 0);
  if (fee >= 75) return 55;
  if (fee >= 65) return 45;
  return Math.round(fee * 0.7);
};
