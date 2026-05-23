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

/**
 * If GPS reports a position more than this many km away from the customer's
 * saved profile address, treat the GPS reading as untrustworthy (VPN, wifi
 * positioning error, etc.) and silently fall back to the saved address.
 */
const GPS_TRUST_RADIUS_KM = DELIVERY_RADIUS_KM;

export type GeoStatus =
  | "idle" // not asked yet
  | "prompt" // asking the browser for permission
  | "granted" // live GPS available
  | "fallback" // GPS unavailable / untrusted, using saved profile coords
  | "denied" // user denied & no fallback
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
  /**
   * When the GPS sanity check rejected a fix, this is how far (km) that
   * GPS reading was from the saved profile address. Null when no rejection
   * has occurred (or when there is no saved address to compare against).
   */
  gpsDiscrepancyKm: number | null;
  /**
   * Reported GPS accuracy in metres for the most recent live fix. Null when
   * we don't currently have a live GPS reading (e.g. fallback or denied).
   */
  accuracyM: number | null;
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
  } catch {
    /* ignore */
  }
  return null;
}

function saveCache(lat: number, lng: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * Live GPS hook with profile-coords fallback.
 * - Asks the browser for geolocation
 * - Keeps a watch so the user's position updates in real time
 * - If GPS is denied/unavailable, falls back to the user's saved profile lat/lng
 * - If GPS reports a position > GPS_TRUST_RADIUS_KM from the saved address,
 *   the reading is rejected and we fall back to the saved address instead.
 */
export function useGeoLocation(): GeoState & {
  /** Re-request permission / refresh location. */
  refresh: () => void;
  /**
   * Permanently trust GPS for this session, bypassing the saved-address
   * sanity check. Use when the customer has actually travelled away from
   * their saved address.
   */
  trustGps: () => void;
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
    gpsDiscrepancyKm: null,
    accuracyM: null,
  }));

  // Manual address override — when the customer has explicitly chosen a
  // browsing area on the home page, every consumer of useGeoLocation
  // (RestaurantMenu distance gate, Cart, etc.) should measure distance from
  // that address instead of live GPS. We read the same localStorage key the
  // home page writes to and stay in sync via the "storage" event.
  const readManual = (): { lat: number; lng: number } | null => {
    try {
      // Manual area override is session-only — on app open/login we want the
      // live GPS location to take over so customers automatically see
      // restaurants in their current area.
      const raw = sessionStorage.getItem("mfula-manual-area-v1");
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v?.lat === "number" && typeof v?.lng === "number") {
        return { lat: v.lat, lng: v.lng };
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  const [manualOverride, setManualOverride] = useState<{ lat: number; lng: number } | null>(
    readManual,
  );
  useEffect(() => {
    const sync = () => setManualOverride(readManual());
    window.addEventListener("storage", sync);
    window.addEventListener("mfula-manual-area-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("mfula-manual-area-changed", sync);
    };
  }, []);
  const watchIdRef = useRef<number | null>(null);
  /** Cached saved-profile coords, kept in a ref so the GPS watcher can sync-check. */
  const profileCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const loadProfileFallback = useCallback(async (): Promise<{
    lat: number;
    lng: number;
  } | null> => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("lat,lng")
      .eq("user_id", user.id)
      .maybeSingle();
    if (typeof data?.lat === "number" && typeof data?.lng === "number") {
      const coords = { lat: data.lat, lng: data.lng };
      profileCoordsRef.current = coords;
      return coords;
    }
    profileCoordsRef.current = null;
    return null;
  }, [user]);

  /**
   * Distance (km) from a GPS reading to the saved profile address, or null
   * if we have no saved address to compare against.
   */
  const gpsDistanceFromSaved = useCallback((lat: number, lng: number): number | null => {
    const p = profileCoordsRef.current;
    if (!p) return null;
    return distanceKm(p.lat, p.lng, lat, lng);
  }, []);

  /**
   * If true, the user has explicitly told us to trust GPS for this session
   * (e.g. they tapped "Use my GPS anyway" after travelling away from their
   * saved address). Skips the distance sanity check entirely.
   */
  const trustGpsRef = useRef(false);

  /**
   * Decide whether a GPS reading should be rejected in favour of the saved
   * address. We only reject when ALL of these are true:
   *   - the user hasn't manually opted to trust GPS
   *   - we actually have a saved address to fall back to
   *   - the GPS fix is more than GPS_TRUST_RADIUS_KM away from it
   *   - the reported accuracy is poor (>150 m) — i.e. likely wifi/IP-based,
   *     not a real GPS lock. A genuine GPS lock at a far-away spot means the
   *     user has actually travelled there, so we trust it.
   */
  const shouldRejectGps = useCallback(
    (lat: number, lng: number, accuracy: number | null): boolean => {
      if (trustGpsRef.current) return false;
      const dist = gpsDistanceFromSaved(lat, lng);
      if (dist == null || dist <= GPS_TRUST_RADIUS_KM) return false;
      // Far from saved address — only reject if the fix looks unreliable.
      return accuracy == null || accuracy > 150;
    },
    [gpsDistanceFromSaved],
  );

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unsupported", ready: true }));
      // Try fallback even if unsupported
      loadProfileFallback().then((p) => {
        if (p)
          setState((s) => ({
            ...s,
            lat: p.lat,
            lng: p.lng,
            source: "profile",
            status: "fallback",
            ready: true,
          }));
      });
      return;
    }

    setState((s) => ({ ...s, status: "prompt" }));

    // Preload saved profile coords so we can validate the very first GPS fix.
    loadProfileFallback().then(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy ?? null;
          const dist = gpsDistanceFromSaved(lat, lng);
          const reject = shouldRejectGps(lat, lng, acc);

          if (reject) {
            const p = profileCoordsRef.current!;
            saveCache(p.lat, p.lng);
            setState({
              status: "fallback",
              lat: p.lat,
              lng: p.lng,
              ready: true,
              source: "profile",
              error: null,
              gpsDiscrepancyKm: dist,
              accuracyM: null,
            });
          } else {
            saveCache(lat, lng);
            setState({
              status: "granted",
              lat,
              lng,
              ready: true,
              source: "gps",
              error: null,
              gpsDiscrepancyKm: null,
              accuracyM: acc,
            });
          }

          // Start watching for live updates (always — saved coords may be added later)
          if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = navigator.geolocation.watchPosition(
            (p) => {
              const nlat = p.coords.latitude;
              const nlng = p.coords.longitude;
              const nacc = p.coords.accuracy ?? null;
              const ndist = gpsDistanceFromSaved(nlat, nlng);
              if (shouldRejectGps(nlat, nlng, nacc)) {
                const pc = profileCoordsRef.current!;
                setState((s) => ({
                  ...s,
                  lat: pc.lat,
                  lng: pc.lng,
                  status: "fallback",
                  source: "profile",
                  ready: true,
                  gpsDiscrepancyKm: ndist,
                  accuracyM: null,
                }));
                return;
              }
              saveCache(nlat, nlng);
              setState((s) => ({
                ...s,
                lat: nlat,
                lng: nlng,
                status: "granted",
                source: "gps",
                ready: true,
                gpsDiscrepancyKm: null,
                accuracyM: nacc,
              }));
            },
            () => {
              /* ignore transient errors */
            },
            { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
          );
        },
        async (err) => {
          // GPS failed entirely — use whatever profile coords we already have
          const fb = profileCoordsRef.current ?? (await loadProfileFallback());
          if (fb) {
            setState({
              status: "fallback",
              lat: fb.lat,
              lng: fb.lng,
              ready: true,
              source: "profile",
              error: null,
              gpsDiscrepancyKm: null,
              accuracyM: null,
            });
          } else {
            setState({
              status: "denied",
              lat: null,
              lng: null,
              ready: true,
              source: null,
              error: err.message,
              gpsDiscrepancyKm: null,
              accuracyM: null,
            });
          }
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
      );
    });
  }, [loadProfileFallback, gpsDistanceFromSaved, shouldRejectGps]);

  /** Bypass the sanity check and trust GPS, then immediately re-acquire. */
  const trustGps = useCallback(() => {
    trustGpsRef.current = true;
    requestGps();
  }, [requestGps]);

  useEffect(() => {
    requestGps();
    return () => {
      if (
        watchIdRef.current !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const effectiveLat = manualOverride ? manualOverride.lat : state.lat;
  const effectiveLng = manualOverride ? manualOverride.lng : state.lng;

  const distanceTo = useCallback(
    (lat: number | null | undefined, lng: number | null | undefined) => {
      if (effectiveLat == null || effectiveLng == null) return null;
      if (lat == null || lng == null) return null;
      return distanceKm(effectiveLat, effectiveLng, lat, lng);
    },
    [effectiveLat, effectiveLng],
  );

  return {
    ...state,
    lat: effectiveLat,
    lng: effectiveLng,
    // When a manual override is active, treat location as ready & granted so
    // distance-gated UIs don't block ordering.
    ready: manualOverride ? true : state.ready,
    status: manualOverride ? "granted" : state.status,
    source: manualOverride ? "gps" : state.source,
    refresh: requestGps,
    trustGps,
    distanceTo,
    hasCoords: effectiveLat != null && effectiveLng != null,
  };
}
