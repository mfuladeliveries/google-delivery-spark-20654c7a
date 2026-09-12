export type OperationalOrder = {
  status: string;
  created_at: string;
  payment_status?: string | null;
  driver_id?: string | null;
};

const ACTIVE = new Set([
  "confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picking_up",
  "arrived_at_restaurant",
  "out_for_delivery",
  "no_driver_found",
]);

export const orderAgeMinutes = (createdAt: string, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));

export const driverOrderPriority = (status: string) => {
  const priority: Record<string, number> = {
    out_for_delivery: 0,
    arrived_at_restaurant: 1,
    picking_up: 2,
    driver_assigned: 3,
    ready: 4,
  };
  return priority[status] ?? 9;
};

export const sortDriverOrders = <T extends { status: string; created_at: string }>(orders: T[]) =>
  [...orders].sort((a, b) => {
    const byStatus = driverOrderPriority(a.status) - driverOrderPriority(b.status);
    if (byStatus !== 0) return byStatus;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

export const estimatedRemainingMinutes = (status: string, activeCount = 1) => {
  const base: Record<string, number> = {
    ready: 35,
    driver_assigned: 30,
    picking_up: 25,
    arrived_at_restaurant: 20,
    out_for_delivery: 12,
  };
  const workloadPenalty = Math.max(0, activeCount - 1) * 8;
  return (base[status] ?? 35) + workloadPenalty;
};

export const summarizeOperations = (orders: OperationalOrder[], now = Date.now()) => {
  let stuck = 0;
  let noDriver = 0;
  let unpaid = 0;
  let active = 0;

  for (const order of orders) {
    if (ACTIVE.has(order.status)) active += 1;
    const age = orderAgeMinutes(order.created_at, now);
    if (ACTIVE.has(order.status) && age >= 60) stuck += 1;
    if ((order.status === "ready" || order.status === "no_driver_found") && !order.driver_id && age >= 15)
      noDriver += 1;
    if (order.payment_status && !["paid", "succeeded", "successful"].includes(order.payment_status.toLowerCase()) && ACTIVE.has(order.status))
      unpaid += 1;
  }

  return { active, stuck, noDriver, unpaid };
};
