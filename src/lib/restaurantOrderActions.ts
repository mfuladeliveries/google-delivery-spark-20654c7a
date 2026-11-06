export const RESTAURANT_ORDER_REFRESH_MS = 10_000;

export function restaurantNeedsDecision(status: string): boolean {
  return status === "pending" || status === "awaiting_restaurant";
}

export function nextRestaurantStatus(status: string): "preparing" | "ready" | null {
  if (status === "confirmed") return "preparing";
  if (status === "preparing") return "ready";
  return null;
}

export function canRestaurantTransition(current: string, next: string): boolean {
  if (current === "pending") return next === "confirmed" || next === "rejected";
  return nextRestaurantStatus(current) === next;
}

export const REJECTION_REASONS = [
  "Ingredients unavailable",
  "Kitchen closed",
  "Unable to prepare this order",
  "Too busy — cannot fulfil in time",
  "Other",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

/**
 * Returns the final rejection reason to store/notify with, or null when the
 * chosen reason is not usable yet (e.g. "Other" picked but no detail typed).
 */
export function resolveRejectionReason(reason: string, customDetail: string): string | null {
  if (!reason) return null;
  if (reason === "Other") {
    const detail = customDetail.trim();
    return detail.length > 0 ? detail : null;
  }
  return reason;
}
