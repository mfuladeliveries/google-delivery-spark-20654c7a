// Single source of truth for the public catalog (restaurants + delivery areas).
// Backed by the `get-catalog` edge function which sits behind Supabase's CDN
// with a 5-minute s-maxage, so repeat calls within that window don't touch
// Postgres at all. We also keep an in-memory cache for the current session.
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryZone } from "@/lib/serviceArea";

export interface CatalogRestaurant {
  id: string;
  name: string;
  cuisine: string;
  image_url: string | null;
  rating: number;
  total_reviews: number;
  delivery_time: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  area_id: string | null;
  address: string | null;
  suburb: string | null;
  description: string | null;
  min_order: number | null;
}

export interface Catalog {
  restaurants: CatalogRestaurant[];
  delivery_areas: DeliveryZone[];
  generated_at: string;
}

const TTL_MS = 60_000; // mirror browser Cache-Control max-age
let cached: { at: number; data: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

export const getCatalog = async (force = false): Promise<Catalog> => {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<Catalog>("get-catalog");
      if (error || !data) throw error ?? new Error("empty catalog");
      cached = { at: Date.now(), data };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

export const invalidateCatalog = () => {
  cached = null;
  inflight = null;
};
