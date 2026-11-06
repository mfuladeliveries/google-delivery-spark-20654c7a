import { branchForArea, isCompanionStore, type RestaurantLocation } from "@/lib/restaurantAreas";

type CartRestaurantItem = {
  item: { restaurantId?: string; restaurantName?: string; category?: string };
};
type Restaurant = {
  id: string;
  name: string;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
};

export const primaryCartRestaurant = (items: CartRestaurantItem[]) => {
  const primary = items.find(({ item }) => !isCompanionStore(item.restaurantName || item.category)) ?? items[0];
  return {
    id: primary?.item.restaurantId ?? null,
    name: primary?.item.restaurantName || primary?.item.category || "",
  };
};

/** Never use a brand's legacy pin for a restaurant pickup. */
export const resolveCartPickup = (
  restaurants: Restaurant[],
  locations: RestaurantLocation[],
  identity: { id: string | null; name: string },
  areaId: string | null,
  customer: { lat: number; lng: number } | null,
) => {
  const matches = restaurants.filter((r) => identity.id
    ? r.id === identity.id
    : r.name.trim().toLowerCase() === identity.name.trim().toLowerCase());
  const restaurant = matches.find((r) => r.is_active);
  if (!restaurant) return null;
  const branch = branchForArea(locations, restaurant.id, areaId, customer);
  if (branch?.lat != null && branch.lng != null) {
    return { branchId: branch.id, lat: branch.lat, lng: branch.lng };
  }
  if (isCompanionStore(restaurant.name) && restaurant.lat != null && restaurant.lng != null) {
    return { branchId: null, lat: restaurant.lat, lng: restaurant.lng };
  }
  return null;
};