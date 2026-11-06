import { useEffect, useState } from "react";
import { getCatalog } from "@/lib/catalog";
import { findNearestZone } from "@/lib/serviceArea";
import { useSelectedAreaId } from "@/lib/restaurantAreas";

/** Direct menu/search visits can resolve GPS/profile/address coverage without visiting home first. */
export const useRestaurantArea = (lat: number | null, lng: number | null) => {
  const selected = useSelectedAreaId();
  const [detected, setDetected] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDetected(null);
    if (lat == null || lng == null) return;
    void getCatalog().then((catalog) => {
      if (!cancelled) setDetected(findNearestZone(lat, lng, catalog.delivery_areas)?.zone.id ?? null);
    }).catch(() => { /* Unknown coverage stays unavailable. */ });
    return () => { cancelled = true; };
  }, [lat, lng]);
  return selected ?? detected;
};