export function checkoutAction(status: unknown, hasRedirect: boolean): "reuse" | "confirm" | "replace" | "wait" {
  const value = String(status ?? "").toLowerCase();
  if (["completed", "succeeded"].includes(value)) return "confirm";
  if (["failed", "cancelled", "expired"].includes(value)) return "replace";
  if (["created", "started"].includes(value) && hasRedirect) return "reuse";
  return "wait";
}

export function paidFulfilmentStatus(approvalMode: string): "confirmed" | "ready" {
  return ["restaurant", "admin"].includes(approvalMode) ? "confirmed" : "ready";
}