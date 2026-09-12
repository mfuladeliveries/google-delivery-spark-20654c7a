import { describe, expect, it } from "vitest";
import {
  detectOrderIncidents,
  detectDuplicateIncidents,
  detectWhatsAppIncidents,
  countBySeverity,
  minutesSince,
  sortIncidents,
  type IncidentOrder,
} from "@/lib/incidents";
import { buildDailyRows, totalDailyRows, toCsv, buildOrderTimeline } from "@/lib/dailyReport";

const NOW = new Date("2026-09-12T12:00:00.000Z").getTime();
const ago = (minutes: number) => new Date(NOW - minutes * 60000).toISOString();

const base: IncidentOrder = {
  id: "o1",
  order_number: 100,
  status: "preparing",
  payment_status: "paid",
  payment_method: "online",
  created_at: ago(5),
  subtotal: 100,
  tax: 5,
  delivery_fee: 40,
  tip: 0,
  discount_amount: 0,
  total: 145,
};

describe("minutesSince", () => {
  it("returns 0 for missing or invalid dates", () => {
    expect(minutesSince(null, NOW)).toBe(0);
    expect(minutesSince("nonsense", NOW)).toBe(0);
  });

  it("floors elapsed minutes and never goes negative", () => {
    expect(minutesSince(ago(30), NOW)).toBe(30);
    expect(minutesSince(new Date(NOW + 60000).toISOString(), NOW)).toBe(0);
  });
});

describe("detectOrderIncidents", () => {
  it("finds nothing wrong with a fresh healthy order", () => {
    expect(detectOrderIncidents([base], NOW)).toHaveLength(0);
  });

  it("ignores completed orders", () => {
    const done = { ...base, status: "delivered", created_at: ago(500), delivered_at: ago(400) };
    expect(detectOrderIncidents([done], NOW)).toHaveLength(0);
  });

  it("flags a failed payment on an open order as critical", () => {
    const found = detectOrderIncidents([{ ...base, payment_status: "failed" }], NOW);
    const inc = found.find((i) => i.kind === "payment_failed");
    expect(inc?.severity).toBe("critical");
    expect(inc?.action).toBe("cancel");
  });

  it("flags an online payment stuck pending", () => {
    const found = detectOrderIncidents([{ ...base, payment_status: "pending", created_at: ago(40) }], NOW);
    expect(found.some((i) => i.kind === "payment_mismatch")).toBe(true);
  });

  it("flags an amount mismatch", () => {
    const found = detectOrderIncidents([{ ...base, total: 200 }], NOW);
    expect(found.some((i) => i.kind === "payment_mismatch" && i.title.includes("mismatch"))).toBe(true);
  });

  it("flags no_driver_found orders and escalates with age", () => {
    const fresh = detectOrderIncidents([{ ...base, status: "no_driver_found", created_at: ago(16) }], NOW);
    expect(fresh.find((i) => i.kind === "no_driver")?.severity).toBe("high");
    const old = detectOrderIncidents([{ ...base, status: "no_driver_found", created_at: ago(120) }], NOW);
    expect(old.find((i) => i.kind === "no_driver")?.severity).toBe("critical");
  });

  it("flags an unassigned order past the no-driver threshold", () => {
    const found = detectOrderIncidents([{ ...base, status: "ready", created_at: ago(20) }], NOW);
    expect(found.some((i) => i.kind === "no_driver" && i.action === "dispatch")).toBe(true);
  });

  it("flags restaurant delays and stuck orders", () => {
    const found = detectOrderIncidents([{ ...base, created_at: ago(70), driver_id: "d1" }], NOW);
    expect(found.some((i) => i.kind === "restaurant_delay")).toBe(true);
    expect(found.some((i) => i.kind === "stuck_status")).toBe(true);
  });

  it("flags an overdue delivery and offers a new PIN", () => {
    const found = detectOrderIncidents(
      [{ ...base, status: "out_for_delivery", driver_id: "d1", created_at: ago(150), picked_up_at: ago(100) }],
      NOW,
    );
    const inc = found.find((i) => i.kind === "delivery_overdue");
    expect(inc?.severity).toBe("critical");
    expect(inc?.action).toBe("regenerate_pin");
  });

  it("flags refunds owed on paid orders and offers bank payout", () => {
    const found = detectOrderIncidents(
      [
        {
          ...base,
          status: "cancelled",
          refund_status: "pending",
          refund_method: "bank",
          refund_amount: 145,
          cancelled_at: ago(30),
        },
      ],
      NOW,
    );
    const inc = found.find((i) => i.kind === "refund_needed");
    expect(inc?.action).toBe("mark_refund_paid");
    expect(inc?.detail).toContain("145.00");
  });

  it("flags a refund queued on an order that was never paid", () => {
    const found = detectOrderIncidents(
      [{ ...base, status: "cancelled", payment_status: "expired", refund_status: "pending" }],
      NOW,
    );
    expect(found.some((i) => i.key.endsWith("refund_unpaid"))).toBe(true);
  });
});

describe("duplicate and messaging incidents", () => {
  it("flags duplicate credits and payouts as critical", () => {
    const found = detectDuplicateIncidents(
      [{ orderId: "o1", orderNumber: 12, count: 2 }],
      [{ orderId: "o2", orderNumber: 13, count: 3 }],
    );
    expect(found).toHaveLength(2);
    expect(found.every((i) => i.severity === "critical")).toBe(true);
  });

  it("flags failed and repeatedly retried WhatsApp messages only", () => {
    const found = detectWhatsAppIncidents(
      [
        { id: "1", order_id: "o1", recipient: "+27", status: "failed", attempts: 1, last_error: "boom", created_at: ago(10) },
        { id: "2", order_id: "o2", recipient: "+27", status: "pending", attempts: 4, last_error: null, created_at: ago(10) },
        { id: "3", order_id: "o3", recipient: "+27", status: "sent", attempts: 1, last_error: null, created_at: ago(10) },
      ],
      NOW,
    );
    expect(found).toHaveLength(2);
  });
});

describe("sorting and counting", () => {
  it("orders by severity then age", () => {
    const sorted = sortIncidents([
      { key: "a", kind: "stuck_status", severity: "medium", title: "", detail: "", orderId: null, orderNumber: null, ageMinutes: 100 },
      { key: "b", kind: "stuck_status", severity: "critical", title: "", detail: "", orderId: null, orderNumber: null, ageMinutes: 5 },
      { key: "c", kind: "stuck_status", severity: "critical", title: "", detail: "", orderId: null, orderNumber: null, ageMinutes: 50 },
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["c", "b", "a"]);
    expect(countBySeverity(sorted)).toEqual({ critical: 2, high: 0, medium: 1 });
  });
});

describe("daily report", () => {
  const orders = [
    {
      id: "o1",
      order_number: 1,
      created_at: "2026-09-10T09:00:00.000Z",
      status: "delivered",
      payment_status: "paid",
      subtotal: 100,
      tax: 5,
      delivery_fee: 40,
      tip: 0,
      discount_amount: 10,
      credits_applied: 20,
      total: 135,
    },
    {
      id: "o2",
      order_number: 2,
      created_at: "2026-09-10T18:00:00.000Z",
      status: "cancelled",
      payment_status: "paid",
      subtotal: 50,
      tax: 2.5,
      delivery_fee: 40,
      total: 92.5,
      refund_status: "pending",
      refund_amount: 92.5,
    },
    {
      id: "o3",
      order_number: 3,
      created_at: "2026-09-11T10:00:00.000Z",
      status: "pending",
      payment_status: "failed",
      subtotal: 80,
      delivery_fee: 40,
      total: 120,
    },
  ];
  const payouts = [{ order_id: "o1", driver_payout: 28, created_at: "2026-09-10T10:00:00.000Z" }];

  it("groups by day, newest first", () => {
    const rows = buildDailyRows(orders, payouts);
    expect(rows.map((r) => r.date)).toEqual(["2026-09-11", "2026-09-10"]);
  });

  it("excludes cancelled orders from income but keeps refunds and credits", () => {
    const day = buildDailyRows(orders, payouts).find((r) => r.date === "2026-09-10")!;
    expect(day.orders).toBe(2);
    expect(day.foodCost).toBe(100);
    expect(day.deliveryIncome).toBe(40);
    expect(day.driverFees).toBe(28);
    expect(day.refunds).toBe(92.5);
    expect(day.walletCreditsUsed).toBe(20);
    expect(day.netEarnings).toBe(40 - 28 - 10 - 92.5);
  });

  it("counts failed payments", () => {
    const day = buildDailyRows(orders, payouts).find((r) => r.date === "2026-09-11")!;
    expect(day.failedPayments).toBe(1);
  });

  it("totals every day", () => {
    const rows = buildDailyRows(orders, payouts);
    const total = totalDailyRows(rows);
    expect(total.orders).toBe(3);
    expect(total.deliveredOrders).toBe(1);
    expect(total.cancelledOrders).toBe(1);
  });

  it("exports a CSV with a header and one line per day", () => {
    const csv = toCsv(buildDailyRows(orders, payouts));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Net Mfula earnings");
    expect(lines).toHaveLength(3);
  });
});

describe("buildOrderTimeline", () => {
  it("keeps only reached steps in chronological order", () => {
    const timeline = buildOrderTimeline({
      created_at: "2026-09-10T09:00:00.000Z",
      paid_at: "2026-09-10T09:02:00.000Z",
      accepted_at: null,
      delivered_at: "2026-09-10T09:40:00.000Z",
    });
    expect(timeline.map((t) => t.step)).toEqual(["Order placed", "Payment received", "Delivered"]);
  });
});
