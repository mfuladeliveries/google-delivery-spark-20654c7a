export interface PaymentOrderStatus {
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
}

export function canPayOrder(order: PaymentOrderStatus): boolean {
  return order.status === "pending_payment" && order.payment_method === "online" &&
    !["paid", "refunded", "expired"].includes(order.payment_status ?? "");
}

export function isConfirmedPaid(order: PaymentOrderStatus): boolean {
  return order.payment_status === "paid";
}

export interface OrderAmounts {
  subtotal: number;
  tax: number;
  delivery_fee: number;
  tip: number;
  discount_amount: number;
  credits_applied: number;
  total: number;
}

export function paymentBreakdown(order: OrderAmounts) {
  const cents = (value: number) => Math.round(Number(value) * 100);
  const calculated = Math.max(0, cents(order.subtotal) + cents(order.tax) +
    cents(order.delivery_fee) + cents(order.tip) - cents(order.discount_amount) - cents(order.credits_applied));
  return { total: calculated / 100, matches: calculated === cents(order.total) };
}