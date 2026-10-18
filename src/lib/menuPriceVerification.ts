import { isSteers, steersPricePending } from "./steersMenu";

export const isBurgerKing = (name?: string | null) => name?.trim().toLowerCase() === "burger king";
export const requiresMenuPriceVerification = (name?: string | null) => isSteers(name) || isBurgerKing(name);
export const menuPricePending = (name: string | null | undefined, item: { price: number; is_available: boolean; price_verified?: boolean }) =>
  isBurgerKing(name)
    ? item.price_verified !== true || !item.is_available || !Number.isFinite(item.price) || item.price <= 0
    : steersPricePending(name, item);