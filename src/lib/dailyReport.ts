// Pure aggregation helpers for the Admin Daily Business Report.
// Everything is derived from existing order / payout / credit data.

export type ReportOrder = {
  id: string;
  order_number: number | null;
  created_at: string;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  delivery_fee?: number | null;
  tip?: number | null;
  discount_amount?: number | null;
  credits_applied?: number | null;
  total?: number | null;
  refund_status?: string | null;
  refund_amount?: number | null;
  promo_code?: string | null;
  referral_code?: string | null;
};

export type ReportPayout = { order_id: string; driver_payout: number; created_at: string };

export type DailyRow = {
  date: string;
  orders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  foodCost: number;
  deliveryIncome: number;
  driverFees: number;
  discounts: number;
  walletCreditsUsed: number;
  refunds: number;
  failedPayments: number;
  grossSales: number;
  netEarnings: number;
};

export const dateKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const buildDailyRows = (orders: ReportOrder[], payouts: ReportPayout[]): DailyRow[] => {
  const payoutByOrder = new Map<string, number>();
  for (const p of payouts) {
    payoutByOrder.set(p.order_id, num(payoutByOrder.get(p.order_id)) + num(p.driver_payout));
  }

  const byDate = new Map<string, DailyRow>();
  for (const o of orders) {
    const key = dateKey(o.created_at);
    const row =
      byDate.get(key) ??
      ({
        date: key,
        orders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        foodCost: 0,
        deliveryIncome: 0,
        driverFees: 0,
        discounts: 0,
        walletCreditsUsed: 0,
        refunds: 0,
        failedPayments: 0,
        grossSales: 0,
        netEarnings: 0,
      } satisfies DailyRow);

    row.orders += 1;
    if (o.status === "delivered") row.deliveredOrders += 1;
    if (o.status === "cancelled" || o.status === "rejected") row.cancelledOrders += 1;
    if (o.payment_status === "failed" || o.payment_status === "expired") row.failedPayments += 1;

    const counted = o.status !== "cancelled" && o.status !== "rejected";
    if (counted) {
      row.foodCost += num(o.subtotal);
      row.deliveryIncome += num(o.delivery_fee);
      row.grossSales += num(o.total);
      row.driverFees += num(payoutByOrder.get(o.id));
    }
    row.discounts += num(o.discount_amount);
    row.walletCreditsUsed += num(o.credits_applied);
    if (o.refund_status === "refunded" || o.refund_status === "pending") {
      row.refunds += num(o.refund_amount);
    }

    byDate.set(key, row);
  }

  for (const row of byDate.values()) {
    // What Mfula keeps: delivery income + service tax, less what drivers are paid,
    // less discounts and refunds the business carries.
    row.netEarnings =
      row.deliveryIncome - row.driverFees - row.discounts - row.refunds;
    row.netEarnings = Math.round(row.netEarnings * 100) / 100;
    row.foodCost = Math.round(row.foodCost * 100) / 100;
    row.deliveryIncome = Math.round(row.deliveryIncome * 100) / 100;
    row.driverFees = Math.round(row.driverFees * 100) / 100;
    row.discounts = Math.round(row.discounts * 100) / 100;
    row.walletCreditsUsed = Math.round(row.walletCreditsUsed * 100) / 100;
    row.refunds = Math.round(row.refunds * 100) / 100;
    row.grossSales = Math.round(row.grossSales * 100) / 100;
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
};

export const totalDailyRows = (rows: DailyRow[]): DailyRow =>
  rows.reduce<DailyRow>(
    (acc, r) => ({
      date: "Total",
      orders: acc.orders + r.orders,
      deliveredOrders: acc.deliveredOrders + r.deliveredOrders,
      cancelledOrders: acc.cancelledOrders + r.cancelledOrders,
      foodCost: Math.round((acc.foodCost + r.foodCost) * 100) / 100,
      deliveryIncome: Math.round((acc.deliveryIncome + r.deliveryIncome) * 100) / 100,
      driverFees: Math.round((acc.driverFees + r.driverFees) * 100) / 100,
      discounts: Math.round((acc.discounts + r.discounts) * 100) / 100,
      walletCreditsUsed: Math.round((acc.walletCreditsUsed + r.walletCreditsUsed) * 100) / 100,
      refunds: Math.round((acc.refunds + r.refunds) * 100) / 100,
      failedPayments: acc.failedPayments + r.failedPayments,
      grossSales: Math.round((acc.grossSales + r.grossSales) * 100) / 100,
      netEarnings: Math.round((acc.netEarnings + r.netEarnings) * 100) / 100,
    }),
    {
      date: "Total",
      orders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      foodCost: 0,
      deliveryIncome: 0,
      driverFees: 0,
      discounts: 0,
      walletCreditsUsed: 0,
      refunds: 0,
      failedPayments: 0,
      grossSales: 0,
      netEarnings: 0,
    },
  );

export const CSV_HEADERS = [
  "Date",
  "Orders",
  "Delivered",
  "Cancelled",
  "Food cost (R)",
  "Delivery income (R)",
  "Driver fees (R)",
  "Discounts (R)",
  "Wallet credits used (R)",
  "Refunds (R)",
  "Failed payments",
  "Gross sales (R)",
  "Net Mfula earnings (R)",
];

export const toCsv = (rows: DailyRow[]) => {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.orders,
        r.deliveredOrders,
        r.cancelledOrders,
        r.foodCost.toFixed(2),
        r.deliveryIncome.toFixed(2),
        r.driverFees.toFixed(2),
        r.discounts.toFixed(2),
        r.walletCreditsUsed.toFixed(2),
        r.refunds.toFixed(2),
        r.failedPayments,
        r.grossSales.toFixed(2),
        r.netEarnings.toFixed(2),
      ].join(","),
    );
  }
  return lines.join("\n");
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const buildOrderTimeline = (o: {
  created_at: string;
  payment_initiated_at?: string | null;
  paid_at?: string | null;
  payment_failed_at?: string | null;
  accepted_at?: string | null;
  picking_up_at?: string | null;
  arrived_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  refunded_at?: string | null;
}) =>
  (
    [
      ["Order placed", o.created_at],
      ["Payment started", o.payment_initiated_at],
      ["Payment received", o.paid_at],
      ["Payment failed", o.payment_failed_at],
      ["Driver accepted", o.accepted_at],
      ["Driver heading to restaurant", o.picking_up_at],
      ["Driver at restaurant", o.arrived_at],
      ["Food collected", o.picked_up_at],
      ["Delivered", o.delivered_at],
      ["Cancelled", o.cancelled_at],
      ["Refunded", o.refunded_at],
    ] as [string, string | null | undefined][]
  )
    .filter(([, at]) => !!at)
    .map(([step, at]) => ({ step, at: at as string }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
