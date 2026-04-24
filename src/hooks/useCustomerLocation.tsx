import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  evaluateServiceArea,
  getServiceArea,
  type ServiceAreaConfig,
  type ServiceAreaResult,
} from "@/lib/serviceArea";

interface UseCustomerLocationResult {
  loading: boolean;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Result of evaluating the saved coords against the service area, or null if no coords. */
  service: ServiceAreaResult | null;
  /** Service area config (centre point, radii, fees). */
  config: ServiceAreaConfig | null;
  /** True when user is logged in but has no saved address yet. */
  needsAddress: boolean;
  /** True when address is set but coords are missing — must re-pick on map. */
  needsCoords: boolean;
  /** True when we have coords but they're outside the service area. */
  outOfRange: boolean;
  /** Refresh after a profile update. */
  refresh: () => Promise<void>;
}

/**
 * Loads the customer's saved profile (address + lat/lng) and tells us whether
 * they're inside the (admin-configurable) delivery radius. Replaces useDeliveryZone.
 */
export const useCustomerLocation = (): UseCustomerLocationResult => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [config, setConfig] = useState<ServiceAreaConfig | null>(null);

  const load = useCallback(async () => {
    const cfg = await getServiceArea();
    setConfig(cfg);
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

  const service =
    config && typeof lat === "number" && typeof lng === "number"
      ? evaluateServiceArea(lat, lng, config)
      : null;

  const needsAddress = !!user && !loading && !address;
  const needsCoords = !!user && !loading && !!address && (lat === null || lng === null);
  const outOfRange = !!service && !service.in_range;

  return {
    loading: authLoading || loading,
    address,
    lat,
    lng,
    service,
    config,
    needsAddress,
    needsCoords,
    outOfRange,
    refresh: load,
  };
};
