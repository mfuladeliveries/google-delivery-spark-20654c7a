// Restaurant brands vs. branches.
//
// A restaurant row is the *brand* (KFC). `restaurant_locations` rows are its
// *branches*, each allocated to a delivery area. Customers see one card per
// brand; the branch that serves their selected area supplies the coordinates,
// address and hours used for distance, delivery fee, driver pickup and the
// order itself.

import { useSyncExternalStore } from "react";
import { distanceKm } from "@/lib/serviceArea";

export interface RestaurantLocation {
  id: string;
  restaurant_id: string;
  area_id: string | null;
  branch_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  delivery_enabled: boolean;
  /** Temporary open/closed switch for this branch. */
  is_open?: boolean | null;
  /** Flat delivery fee for this branch; null means use the area's fee. */
  delivery_fee?: number | null;
  /** e.g. "25-35 min"; null means use the restaurant's own estimate. */
  estimated_delivery_time?: string | null;
  opens_at: string | null;
  closes_at: string | null;
  operating_days: Record<string, boolean> | null;
}

/** Where the customer's confirmed delivery area is remembered. */
export const AREA_STORAGE_KEY = "mfula-area-v1";

export const getSelectedAreaId = (): string | null => {
  try {
    return localStorage.getItem(AREA_STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

const AREA_CHANGE_EVENT = "mfula-area-changed";

export const setSelectedAreaId = (areaId: string | null): void => {
  try {
    if (areaId) localStorage.setItem(AREA_STORAGE_KEY, areaId);
    else localStorage.removeItem(AREA_STORAGE_KEY);
    // Notify mounted screens (menu, checkout) so they re-resolve the branch
    // for the new area instead of keeping the previous area's coordinates.
    window.dispatchEvent(new Event(AREA_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
};

const subscribeArea = (onChange: () => void) => {
  window.addEventListener(AREA_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AREA_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Reactive selected area id: re-renders when the customer changes area anywhere. */
export const useSelectedAreaId = (): string | null =>
  useSyncExternalStore(subscribeArea, getSelectedAreaId, () => null);

/** A branch customers can order from: switched on, open, and with a real map location. */
export const validBranchCoordinates = (lat: number | null, lng: number | null): boolean =>
  lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

export const orderable = (l: RestaurantLocation) =>
  l.active && l.delivery_enabled && l.is_open !== false && validBranchCoordinates(l.lat, l.lng);

/**
 * The branch of `restaurantId` that serves `areaId` (null when none does).
 * With several branches in one area, the one nearest the customer wins.
 */
export const branchForArea = (
  locations: RestaurantLocation[],
  restaurantId: string,
  areaId: string | null,
  customer?: { lat: number; lng: number } | null,
): RestaurantLocation | null => {
  if (!areaId) return null;
  const matches = locations.filter(
    (l) => l.restaurant_id === restaurantId && l.area_id === areaId && orderable(l),
  );
  if (matches.length <= 1 || !customer) return matches[0] ?? null;
  return matches.reduce((best, l) => {
    if (l.lat == null || l.lng == null || best.lat == null || best.lng == null) return best;
    return distanceKm(customer.lat, customer.lng, l.lat, l.lng) <
      distanceKm(customer.lat, customer.lng, best.lat, best.lng) ? l : best;
  });
};

/** Any orderable branch, used as a fallback when no area is known yet. */
export const anyBranch = (
  locations: RestaurantLocation[],
  restaurantId: string,
): RestaurantLocation | null =>
  locations.find((l) => l.restaurant_id === restaurantId && orderable(l)) ?? null;

/** Distinct area ids a restaurant serves (for admin display). */
export const areaIdsForRestaurant = (
  locations: RestaurantLocation[],
  restaurantId: string,
): string[] => {
  const set = new Set<string>();
  for (const l of locations) {
    if (l.restaurant_id === restaurantId && l.area_id && orderable(l)) set.add(l.area_id);
  }
  return [...set];
};

/** Coordinates to use for a restaurant: the branch's when it has them. */
export const effectiveCoords = (
  restaurant: { lat?: number | null; lng?: number | null },
  branch: RestaurantLocation | null,
): { lat: number | null; lng: number | null } =>
  branch && branch.lat != null && branch.lng != null
    ? { lat: branch.lat, lng: branch.lng }
    : { lat: restaurant.lat ?? null, lng: restaurant.lng ?? null };

/** Opening hours to use: branch overrides the brand when both are set. */
export const effectiveHours = (
  restaurant: { opens_at?: string | null; closes_at?: string | null },
  branch: RestaurantLocation | null,
): { opens_at: string | null; closes_at: string | null } =>
  branch && branch.opens_at && branch.closes_at
    ? { opens_at: branch.opens_at, closes_at: branch.closes_at }
    : { opens_at: restaurant.opens_at ?? null, closes_at: restaurant.closes_at ?? null };

/** Estimated delivery time to show: the branch's when it has one. */
export const effectiveDeliveryTime = (
  restaurant: { delivery_time?: string | null },
  branch: RestaurantLocation | null,
): string | null =>
  (branch?.estimated_delivery_time?.trim() || restaurant.delivery_time) ?? null;

/** The general store rides along in every area. */
export const isCompanionStore = (name: string | null | undefined): boolean =>
  (name ?? "").trim().toLowerCase() === "mfula shop";
