// Pure incident-detection helpers shared by the Admin Incident & Recovery view
// and the admin alert banner. No data is written here — detection only.

export type IncidentOrder = {
  id: string;
  order_number: number | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  created_at: string;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  driver_id?: string | null;
  restaurant?: string | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  total?: number | null;
  refund_status?: string | null;
  refund_method?: string | null;
  refund_amount?: number | null;
  credits_applied?: number | null;
  subtotal?: number | null;
  tax?: number | null;
  delivery_fee?: number | null;
  tip?: number | null;
  discount_amount?: number | null;
};

export type IncidentKind =
  | "payment_failed"
  | "payment_mismatch"
  | "no_driver"
  | "restaurant_delay"
  | "stuck_status"
  | "delivery_overdue"
  | "refund_needed"
  | "duplicate_credit"
  | "duplicate_earnings"
  | "whatsapp_failed";

export type Severity = "critical" | "high" | "medium";

export type Incident = {
  key: string;
  kind: IncidentKind;
  severity: Severity;
  title: string;
  detail: string;
  orderId: string | null;
  orderNumber: number | null;
  ageMinutes: number;
  action?: "dispatch" | "cancel" | "regenerate_pin" | "mark_refund_paid" | "review";
};

export const TERMINAL_STATUSES = new Set(["delivered", "cancelled", "rejected"]);

export const RESTAURANT_STAGES = new Set(["pending", "confirmed", "awaiting_restaurant", "preparing"]);

export const DEFAULT_THRESHOLDS = {
  noDriverMinutes: 15,
  restaurantDelayMinutes: 25,
  stuckMinutes: 60,
  deliveryOverdueMinutes: 90,
  paymentPendingMinutes: 30,
};

export type Thresholds = typeof DEFAULT_THRESHOLDS;

export const minutesSince = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60000));
};

export const severityRank = (s: Severity) => (s === "critical" ? 0 : s === "high" ? 1 : 2);

const label = (o: IncidentOrder) => `#${o.order_number ?? "—"}`;

export const detectOrderIncidents = (
  orders: IncidentOrder[],
  now = Date.now(),
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Incident[] => {
  const out: Incident[] = [];

  for (const o of orders) {
    const age = minutesSince(o.created_at, now);
    const terminal = TERMINAL_STATUSES.has(o.status);
    const paid = o.payment_status === "paid";

    // Payment failure / expiry on an order that was never cancelled
    if (!terminal && (o.payment_status === "failed" || o.payment_status === "expired")) {
      out.push({
        key: `${o.id}:payment_failed`,
        kind: "payment_failed",
        severity: "critical",
        title: `Payment ${o.payment_status} on ${label(o)}`,
        detail: "Order is still open but payment did not go through.",
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "cancel",
      });
    }

    // Payment stuck pending for too long on an online order
    if (
      !terminal &&
      o.payment_method === "online" &&
      o.payment_status === "pending" &&
      age >= thresholds.paymentPendingMinutes
    ) {
      out.push({
        key: `${o.id}:payment_pending`,
        kind: "payment_mismatch",
        severity: "high",
        title: `Payment not confirmed on ${label(o)}`,
        detail: `Waiting ${age} min for the payment result.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "review",
      });
    }

    // Total does not match its parts
    const parts =
      (o.subtotal ?? 0) + (o.tax ?? 0) + (o.delivery_fee ?? 0) + (o.tip ?? 0) - (o.discount_amount ?? 0);
    if (o.total != null && (o.subtotal != null || o.delivery_fee != null)) {
      if (Math.abs(o.total - parts) > 0.05) {
        out.push({
          key: `${o.id}:total_mismatch`,
          kind: "payment_mismatch",
          severity: "high",
          title: `Amount mismatch on ${label(o)}`,
          detail: `Charged R${(o.total ?? 0).toFixed(2)} but the items add up to R${parts.toFixed(2)}.`,
          orderId: o.id,
          orderNumber: o.order_number,
          ageMinutes: age,
          action: "review",
        });
      }
    }

    // No driver found
    if (o.status === "no_driver_found") {
      out.push({
        key: `${o.id}:no_driver`,
        kind: "no_driver",
        severity: age >= thresholds.noDriverMinutes * 2 ? "critical" : "high",
        title: `No driver for ${label(o)}`,
        detail: `Unassigned for ${age} min.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "dispatch",
      });
    } else if (!terminal && !o.driver_id && age >= thresholds.noDriverMinutes) {
      out.push({
        key: `${o.id}:no_driver`,
        kind: "no_driver",
        severity: age >= thresholds.stuckMinutes ? "critical" : "high",
        title: `Still no driver on ${label(o)}`,
        detail: `${age} min old with nobody assigned.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "dispatch",
      });
    }

    // Restaurant taking too long
    if (RESTAURANT_STAGES.has(o.status) && age >= thresholds.restaurantDelayMinutes) {
      out.push({
        key: `${o.id}:restaurant_delay`,
        kind: "restaurant_delay",
        severity: age >= thresholds.stuckMinutes ? "critical" : "medium",
        title: `${o.restaurant ?? "Restaurant"} slow on ${label(o)}`,
        detail: `Still "${o.status}" after ${age} min.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "review",
      });
    }

    // Delivery not progressing
    if (o.status === "out_for_delivery") {
      const since = minutesSince(o.picked_up_at ?? o.created_at, now);
      if (since >= thresholds.deliveryOverdueMinutes) {
        out.push({
          key: `${o.id}:delivery_overdue`,
          kind: "delivery_overdue",
          severity: "critical",
          title: `Delivery overdue on ${label(o)}`,
          detail: `On the road for ${since} min without being completed.`,
          orderId: o.id,
          orderNumber: o.order_number,
          ageMinutes: since,
          action: "regenerate_pin",
        });
      }
    }

    // Generic stuck order
    if (!terminal && o.status !== "no_driver_found" && age >= thresholds.stuckMinutes) {
      out.push({
        key: `${o.id}:stuck`,
        kind: "stuck_status",
        severity: "high",
        title: `${label(o)} stuck on "${o.status}"`,
        detail: `No progress for ${age} min.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "review",
      });
    }

    // Refund owed to the customer
    if (o.refund_status === "pending" && paid) {
      const since = minutesSince(o.cancelled_at ?? o.created_at, now);
      out.push({
        key: `${o.id}:refund`,
        kind: "refund_needed",
        severity: since >= 60 * 24 ? "critical" : "high",
        title: `Refund owed on ${label(o)}`,
        detail: `R${(o.refund_amount ?? o.total ?? 0).toFixed(2)} to refund${
          o.refund_method ? ` by ${o.refund_method}` : " (method not chosen yet)"
        }.`,
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: since,
        action: o.refund_method === "bank" ? "mark_refund_paid" : "review",
      });
    }

    // Refund flagged without a captured payment — money was never taken
    if (o.refund_status === "pending" && !paid) {
      out.push({
        key: `${o.id}:refund_unpaid`,
        kind: "refund_needed",
        severity: "medium",
        title: `Refund flagged but ${label(o)} was never paid`,
        detail: "No payment was captured, so no money should leave the business.",
        orderId: o.id,
        orderNumber: o.order_number,
        ageMinutes: age,
        action: "review",
      });
    }
  }

  return sortIncidents(out);
};

export type DuplicateGroup = { orderId: string; orderNumber: number | null; count: number };

export const detectDuplicateIncidents = (
  duplicateCredits: DuplicateGroup[],
  duplicateEarnings: DuplicateGroup[],
): Incident[] => {
  const out: Incident[] = [];
  for (const g of duplicateCredits) {
    out.push({
      key: `${g.orderId}:dup_credit`,
      kind: "duplicate_credit",
      severity: "critical",
      title: `Wallet credit issued ${g.count}× on #${g.orderNumber ?? "—"}`,
      detail: "The same order created more than one wallet credit.",
      orderId: g.orderId,
      orderNumber: g.orderNumber,
      ageMinutes: 0,
      action: "review",
    });
  }
  for (const g of duplicateEarnings) {
    out.push({
      key: `${g.orderId}:dup_earnings`,
      kind: "duplicate_earnings",
      severity: "critical",
      title: `Driver paid ${g.count}× on #${g.orderNumber ?? "—"}`,
      detail: "The same delivery created more than one driver payout.",
      orderId: g.orderId,
      orderNumber: g.orderNumber,
      ageMinutes: 0,
      action: "review",
    });
  }
  return sortIncidents(out);
};

export type WhatsAppRow = {
  id: string;
  order_id: string | null;
  recipient: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

export const detectWhatsAppIncidents = (rows: WhatsAppRow[], now = Date.now()): Incident[] =>
  sortIncidents(
    rows
      .filter((r) => r.status === "failed" || (r.status === "pending" && r.attempts >= 3))
      .map((r) => ({
        key: `${r.id}:whatsapp`,
        kind: "whatsapp_failed" as IncidentKind,
        severity: "medium" as Severity,
        title: `WhatsApp message failed to ${r.recipient}`,
        detail: r.last_error ? r.last_error.slice(0, 140) : `${r.attempts} attempts, still not sent.`,
        orderId: r.order_id,
        orderNumber: null,
        ageMinutes: minutesSince(r.created_at, now),
        action: "review" as const,
      })),
  );

export const sortIncidents = (list: Incident[]) =>
  [...list].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return b.ageMinutes - a.ageMinutes;
  });

export const countBySeverity = (list: Incident[]) => ({
  critical: list.filter((i) => i.severity === "critical").length,
  high: list.filter((i) => i.severity === "high").length,
  medium: list.filter((i) => i.severity === "medium").length,
});

export const groupByKind = (list: Incident[]) => {
  const map = new Map<IncidentKind, Incident[]>();
  for (const i of list) {
    const arr = map.get(i.kind) ?? [];
    arr.push(i);
    map.set(i.kind, arr);
  }
  return map;
};

export const KIND_LABELS: Record<IncidentKind, string> = {
  payment_failed: "Failed payments",
  payment_mismatch: "Payment problems",
  no_driver: "No driver assigned",
  restaurant_delay: "Restaurant delays",
  stuck_status: "Stuck orders",
  delivery_overdue: "Delivery not progressing",
  refund_needed: "Refunds needed",
  duplicate_credit: "Duplicate wallet credits",
  duplicate_earnings: "Duplicate driver payouts",
  whatsapp_failed: "WhatsApp failures",
};
