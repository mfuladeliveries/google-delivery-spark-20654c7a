// Single source of truth for the public catalog (restaurants + delivery areas).
// Backed by the `get-catalog` edge function which sits behind Supabase's CDN
// with a 5-minute s-maxage, so repeat calls within that window don't touch
// Postgres at all. We also keep an in-memory cache for the current session,
// plus a localStorage copy so a cold start on a slow/flaky connection can show
// restaurants immediately instead of an endless spinner.
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryZone } from "@/lib/serviceArea";
import type { RestaurantLocation } from "@/lib/restaurantAreas";

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
  /** Branches of each restaurant, one per delivery area it serves. */
  restaurant_locations?: RestaurantLocation[];
  generated_at: string;
}

const TTL_MS = 60_000; // mirror browser Cache-Control max-age
/** How long a stored copy may be served while the network request is stalling. */
const OFFLINE_MAX_AGE_MS = 1000 * 60 * 60 * 24;
/** Give the network this long before falling back to the stored copy. */
const NETWORK_TIMEOUT_MS = 6000;
const STORAGE_KEY = "mfula-catalog-v1";

let cached: { at: number; data: Catalog } | null = null;
let inflight: Promise<Catalog> | null = null;

const readStored = (): { at: number; data: Catalog } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: Catalog };
    if (!parsed?.data?.restaurants || Date.now() - parsed.at > OFFLINE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStored = (data: Catalog) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full / unavailable — not fatal */
  }
};

const fetchCatalog = async (): Promise<Catalog> => {
  const { data, error } = await supabase.functions.invoke<Catalog>("get-catalog");
  if (error || !data) throw error ?? new Error("empty catalog");
  return data;
};

export const getCatalog = async (force = false): Promise<Catalog> => {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const stored = cached ?? readStored();
    const request = fetchCatalog().then((data) => {
      cached = { at: Date.now(), data };
      writeStored(data);
      return data;
    });

    // If we already have something to show, don't let a stalled network block
    // the UI: serve the stored copy and let the request finish in the
    // background (it still refreshes the cache when it lands).
    if (!force && stored) {
      request.catch(() => {
        /* background refresh failure is fine — cached data stays on screen */
      });
      const timeout = new Promise<Catalog>((resolve) =>
        window.setTimeout(() => resolve(stored.data), NETWORK_TIMEOUT_MS),
      );
      try {
        return await Promise.race([request, timeout]);
      } finally {
        inflight = null;
      }
    }

    try {
      return await request;
    } catch (err) {
      if (stored) return stored.data;
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

export const invalidateCatalog = () => {
  cached = null;
  inflight = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
