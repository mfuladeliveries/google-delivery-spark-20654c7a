import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  findNearestZone,
  getActiveZones,
  type DeliveryZone,
  type ZoneMatch,
} from "@/lib/serviceArea";

interface UseCustomerLocationResult {
  loading: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Closest active zone covering the saved coords, or null if none. */
  zone: ZoneMatch | null;
  /** All active zones (for map circles, hints, etc.). */
  zones: DeliveryZone[];
  needsAddress: boolean;
  needsCoords: boolean;
  /** True when we have coords but they're outside every zone. */
  outOfZone: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads the customer's saved profile (address + lat/lng) and tells us whether
 * they're inside any active delivery zone. Replaces the old service-area circle.
 */
export const useCustomerLocation = (): UseCustomerLocationResult => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  const load = useCallback(async () => {
    const z = await getActiveZones();
    setZones(z);
    if (!user) {
      setAddress(null);
      setLat(null);
      setLng(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("address, lat, lng")
      .eq("user_id", user.id)
      .maybeSingle();
    const a = (data?.address ?? "").trim() || null;
    setAddress(a);
    setLat(typeof data?.lat === "number" ? data.lat : null);
    setLng(typeof data?.lng === "number" ? data.lng : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const zone =
    typeof lat === "number" && typeof lng === "number"
      ? findNearestZone(lat, lng, zones)
      : null;

  const needsAddress = !!user && !loading && !address;
  const needsCoords = !!user && !loading && !!address && (lat === null || lng === null);
  const outOfZone = !!user && lat != null && lng != null && zone === null;

  return {
    loading: authLoading || loading,
    address,
    lat,
    lng,
    zone,
    zones,
    needsAddress,
    needsCoords,
    outOfZone,
    refresh: load,
  };
};
