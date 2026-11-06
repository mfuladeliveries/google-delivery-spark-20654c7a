import { useEffect, useState } from "react";
import { getCatalog } from "@/lib/catalog";
import { resolveCartPickup } from "@/lib/cartRestaurant";
import { useRestaurantArea } from "@/hooks/useRestaurantArea";

/** Shared branch lookup for the cart's distance gate and delivery preview. */
export const useCartPickup = (name: string, id: string | null, lat: number | null, lng: number | null) => {
  const areaId = useRestaurantArea(lat, lng);
  const key = JSON.stringify([name, id, areaId, lat, lng]);
  const [result, setResult] = useState<{
    key: string;
    pickup: ReturnType<typeof resolveCartPickup>;
  } | null>(null);
  useEffect(() => {
    if (!name && !id) return;
    let alive = true;
    void getCatalog().then((catalog) => {
      if (!alive) return;
      const customer = lat != null && lng != null ? { lat, lng } : null;
      setResult({ key, pickup: resolveCartPickup(catalog.restaurants, catalog.restaurant_locations ?? [], { name, id }, areaId, customer) });
    }).catch(() => {
      if (alive) setResult({ key, pickup: null });
    });
    return () => { alive = false; };
  }, [key, name, id, areaId, lat, lng]);
  return {
    pickup: result?.key === key ? result.pickup : null,
    loading: Boolean(name || id) && result?.key !== key,
  };
};