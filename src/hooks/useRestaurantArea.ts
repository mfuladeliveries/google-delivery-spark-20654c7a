import { useEffect, useMemo, useState } from "react";
import { getCatalog } from "@/lib/catalog";
import { findNearestZone, type DeliveryZone } from "@/lib/serviceArea";
import { useSelectedAreaId } from "@/lib/restaurantAreas";

/** Direct menu/search visits can resolve GPS/profile/address coverage without visiting home first. */
export const useRestaurantArea = (lat: number | null, lng: number | null) => {
  const selected = useSelectedAreaId();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const needsDetection = selected === null && lat !== null && lng !== null;
  useEffect(() => {
    let cancelled = false;
    if (!needsDetection) return;
    void getCatalog().then((catalog) => {
      if (!cancelled) setZones(catalog.delivery_areas);
    }).catch(() => { /* Unknown coverage stays unavailable. */ });
    return () => { cancelled = true; };
  }, [needsDetection]);
  const detected = useMemo(() => lat != null && lng != null
    ? findNearestZone(lat, lng, zones)?.zone.id ?? null
    : null, [lat, lng, zones]);
  return selected ?? detected;
};