export type PerformanceOrder = {
  id: string;
  total: number;
  subtotal?: number | null;
  delivery_fee?: number | null;
  tip?: number | null;
  status: string;
  created_at: string;
  delivered_at?: string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
};

export function summarizeOrders(orders: PerformanceOrder[]) {
  const totalOrders = orders.length;
  const delivered = orders.filter((o) => o.status === "delivered");
  const cancelled = orders.filter((o) => ["cancelled", "rejected"].includes(o.status));
  const revenue = delivered.reduce((sum, o) => sum + Number(o.subtotal ?? o.total ?? 0), 0);
  const avgOrderValue = delivered.length ? revenue / delivered.length : 0;
  const completionRate = totalOrders ? (delivered.length / totalOrders) * 100 : 0;
  const cancellationRate = totalOrders ? (cancelled.length / totalOrders) * 100 : 0;
  const deliveryMinutes = delivered
    .filter((o) => o.delivered_at)
    .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60000)
    .filter((n) => Number.isFinite(n) && n >= 0);
  const avgDeliveryMinutes = deliveryMinutes.length
    ? deliveryMinutes.reduce((a, b) => a + b, 0) / deliveryMinutes.length
    : 0;
  return { totalOrders, delivered: delivered.length, cancelled: cancelled.length, revenue, avgOrderValue, completionRate, cancellationRate, avgDeliveryMinutes };
}

export function summarizeDriver(orders: PerformanceOrder[], payouts: number[]) {
  const base = summarizeOrders(orders);
  const earnings = payouts.reduce((a, b) => a + Number(b || 0), 0);
  return { ...base, earnings };
}
