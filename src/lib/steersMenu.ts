export const isSteers = (name?: string | null) => name?.trim().toLowerCase() === "steers";
export const steersPricePending = (restaurant: string | null | undefined, item: { price: number; is_available: boolean }) =>
  isSteers(restaurant) && (!item.is_available || !Number.isFinite(item.price) || item.price <= 0);