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