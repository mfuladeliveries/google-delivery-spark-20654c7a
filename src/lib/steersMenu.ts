export const isSteers = (name?: string | null) => name?.trim().toLowerCase() === "steers";
export const steersPricePending = (restaurant: string | null | undefined, item: { price: number; is_available: boolean; price_verified?: boolean }) =>
  isSteers(restaurant) && (item.price_verified !== true || !item.is_available || !Number.isFinite(item.price) || item.price <= 0);