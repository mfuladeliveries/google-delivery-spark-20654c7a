// Geocoding helpers backed by Google Maps Platform via the `maps-geocode` edge
// function (Lovable connector gateway). Works on every domain — no browser key
// required — and never exposes the API key to clients.

import { supabase } from "@/integrations/supabase/client";

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
  place_id?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  place_id?: string;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

export interface PlaceSuggestion {
  place_id: string;
  text: string;
  main: string;
  secondary: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("maps-geocode", { body });
    if (error) {
      console.warn("maps-geocode error", error);
      return null;
    }
    return data as T;
  } catch (e) {
    console.warn("maps-geocode invoke failed", e);
    return null;
  }
}

/** Forward-geocode a free-text address to coordinates (best match). */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query?.trim();
  if (!q) return null;
  const data = await invoke<{ results: GeocodeResult[] }>({ action: "forward", query: q });
  const top = data?.results?.[0];
  if (!top || !Number.isFinite(top.lat) || !Number.isFinite(top.lng)) return null;
  return { lat: top.lat, lng: top.lng };
}

/** Forward-geocode and return the full formatted address + place_id. */
export async function geocodeAddressFull(query: string): Promise<GeocodeResult | null> {
  const q = query?.trim();
  if (!q) return null;
  const data = await invoke<{ results: GeocodeResult[] }>({ action: "forward", query: q });
  const top = data?.results?.[0];
  if (!top || !Number.isFinite(top.lat) || !Number.isFinite(top.lng)) return null;
  return top;
}

/** Reverse-geocode coords to a formatted street address + components. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const data = await invoke<ReverseGeocodeResult & { address: string | null }>({
    action: "reverse",
    lat,
    lng,
  });
  if (!data || !data.address) return null;
  return data as ReverseGeocodeResult;
}

/** Google Places (New) autocomplete suggestions for a free-text query. */
export async function placeAutocomplete(
  input: string,
  sessionToken?: string,
): Promise<PlaceSuggestion[]> {
  const q = input?.trim();
  if (!q || q.length < 2) return [];
  const data = await invoke<{ suggestions: PlaceSuggestion[] }>({
    action: "autocomplete",
    input: q,
    sessionToken,
  });
  return data?.suggestions ?? [];
}

/** Resolve a Places autocomplete prediction into a full address + coords. */
export async function placeDetails(
  placeId: string,
  sessionToken?: string,
): Promise<GeocodeResult | null> {
  if (!placeId) return null;
  const data = await invoke<{ address: string | null; lat: number; lng: number; place_id: string }>(
    { action: "details", placeId, sessionToken },
  );
  if (!data || !data.address || !Number.isFinite(data.lat) || !Number.isFinite(data.lng))
    return null;
  return { address: data.address, lat: data.lat, lng: data.lng, place_id: data.place_id };
}
