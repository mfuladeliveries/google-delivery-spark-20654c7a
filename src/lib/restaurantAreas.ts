// Restaurant brands vs. branches.
//
// A restaurant row is the *brand* (KFC). `restaurant_locations` rows are its
// *branches*, each allocated to a delivery area. Customers see one card per
// brand; the branch that serves their selected area supplies the coordinates,
// address and hours used for distance, delivery fee, driver pickup and the
// order itself.

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

export const setSelectedAreaId = (areaId: string | null): void => {
  try {
    if (areaId) localStorage.setItem(AREA_STORAGE_KEY, areaId);
    else localStorage.removeItem(AREA_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const orderable = (l: RestaurantLocation) => l.active && l.delivery_enabled;

/** The branch of `restaurantId` that serves `areaId` (null when none does). */
export const branchForArea = (
  locations: RestaurantLocation[],
  restaurantId: string,
  areaId: string | null,
): RestaurantLocation | null => {
  if (!areaId) return null;
  return (
    locations.find((l) => l.restaurant_id === restaurantId && l.area_id === areaId && orderable(l)) ??
    null
  );
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

/** The general store rides along in every area. */
export const isCompanionStore = (name: string | null | undefined): boolean =>
  (name ?? "").trim().toLowerCase() === "mfula shop";
