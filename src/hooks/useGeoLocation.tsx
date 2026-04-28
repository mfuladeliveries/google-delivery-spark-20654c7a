import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { distanceKm } from "@/lib/serviceArea";

/**
 * Per-restaurant delivery radius (km). Customer must be within this distance
 * of a restaurant's saved coordinates to order from it.
 */
export const DELIVERY_RADIUS_KM = 8;
/** Copy used in the user-facing "out of range" message. */
export const DELIVERY_RADIUS_LABEL_KM = 8;

export type GeoStatus =
  | "idle"        // not asked yet
  | "prompt"      // asking the browser for permission
  | "granted"    // live GPS available
  | "fallback"    // GPS unavailable, using saved profile coords
  | "denied"      // user denied & no fallback
  | "unsupported";

interface GeoState {
  status: GeoStatus;
  lat: number | null;
  lng: number | null;
  /** True once we've finished the first attempt. */
  ready: boolean;
  /** Where the coords came from. */
  source: "gps" | "profile" | null;
  error: string | null;
}

const STORAGE_KEY = "mfula-geo-cache-v1";
const MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5 min

function loadCache(): { lat: number; lng: number; ts: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lat === "number" && typeof v?.lng === "number" && typeof v?.ts === "number") {
      if (Date.now() - v.ts < MAX_CACHE_AGE_MS) return v;
    }
  } catch {/* ignore */}
  return null;
}

function saveCache(lat: number, lng: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {/* ignore */}
}

/**
 * Live GPS hook with profile-coords fallback.
 * - Asks the browser for geolocation
 * - Keeps a watch so the user's position updates in real time
 * - If GPS is denied/unavailable, falls back to the user's saved profile lat/lng
 */
export function useGeoLocation(): GeoState & {
  /** Re-request permission / refresh location. */
  refresh: () => void;
  /** Compute distance from current location to a restaurant. Returns null if no coords. */
  distanceTo: (lat: number | null | undefined, lng: number | null | undefined) => number | null;
  /** True if we have any coords (live or fallback). */
  hasCoords: boolean;
} {
  const { user } = useAuth();
  const cached = useRef(loadCache());
  const [state, setState] = useState<GeoState>(() => ({
    status: "idle",
    lat: cached.current?.lat ?? null,
    lng: cached.current?.lng ?? null,
    ready: false,
    source: cached.current ? "gps" : null,
    error: null,
  }));
  const watchIdRef = useRef<number | null>(null);

  const loadProfileFallback = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("lat,lng")
      .eq("user_id", user.id)
      .maybeSingle();
    if (typeof data?.lat === "number" && typeof data?.lng === "number") {
      return { lat: data.lat, lng: data.lng };
    }
    return null;
  }, [user]);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unsupported", ready: true }));
      // Try fallback even if unsupported
      loadProfileFallback().then((p) => {
        if (p) setState((s) => ({ ...s, lat: p.lat, lng: p.lng, source: "profile", status: "fallback", ready: true }));
      });
      return;
    }

    setState((s) => ({ ...s, status: "prompt" }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        saveCache(lat, lng);
        setState({ status: "granted", lat, lng, ready: true, source: "gps", error: null });

        // Start watching for live updates
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => {
            const nlat = p.coords.latitude;
            const nlng = p.coords.longitude;
            saveCache(nlat, nlng);
            setState((s) => ({ ...s, lat: nlat, lng: nlng, status: "granted", source: "gps", ready: true }));
          },
          () => {/* ignore transient errors */},
          { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
        );
      },
      async (err) => {
        // Try profile fallback
        const fb = await loadProfileFallback();
        if (fb) {
          setState({ status: "fallback", lat: fb.lat, lng: fb.lng, ready: true, source: "profile", error: null });
        } else {
          setState({ status: "denied", lat: null, lng: null, ready: true, source: null, error: err.message });
        }
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }, [loadProfileFallback]);

  useEffect(() => {
    requestGps();
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const distanceTo = useCallback(
    (lat: number | null | undefined, lng: number | null | undefined) => {
      if (state.lat == null || state.lng == null) return null;
      if (lat == null || lng == null) return null;
      return distanceKm(state.lat, state.lng, lat, lng);
    },
    [state.lat, state.lng],
  );

  return {
    ...state,
    refresh: requestGps,
    distanceTo,
    hasCoords: state.lat != null && state.lng != null,
  };
}
