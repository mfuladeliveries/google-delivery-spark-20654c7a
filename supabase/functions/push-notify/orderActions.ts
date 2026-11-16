export function orderActionKind(status: string): string | null {
  if (status === "cancelled" || status === "rejected") return "customer_cancelled";
  if (status === "driver_assigned") return "customer_driver_assigned";
  if (status === "picking_up") return "customer_picking_up";
  if (status === "out_for_delivery") return "customer_out_for_delivery";
  if (status === "customer_arrived") return "customer_driver_arrived";
  if (status === "offer_pending") return "driver_offer_pending";
  if (status === "dispatch_broadcast") return "driver_dispatch_broadcast";
  return null;
}

// Arrival is an alert, not delivery completion: PIN handover remains unchanged.
export function canAnnounceCustomerArrival(order: { status: string; driver_id: string | null }, callerId: string | null, isService: boolean): boolean {
  return order.status === "out_for_delivery" && !!order.driver_id && (isService || order.driver_id === callerId);
}

// Reserve before sending, using the existing unique (order, recipient, kind) index.
// An ambiguous network failure must not release the reservation and send twice.
export async function deliverOrderActionOnce(
  claim: () => Promise<boolean>,
  deliver: () => Promise<void>,
): Promise<boolean> {
  if (!(await claim())) return false;
  await deliver();
  return true;
}