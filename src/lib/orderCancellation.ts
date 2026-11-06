import type { PaymentOrderStatus } from "@/lib/approvalPayment";

export const PAID_ORDER_STATUS = "Payment Successful – Order Cannot Be Cancelled";
export const PAYMENT_CANCELLATION_WARNING = "IMPORTANT: Please check your order carefully before making payment. Once your payment has been successfully completed, your order cannot be cancelled by the customer. Please make sure your order and delivery details are correct before proceeding.";

export function canCustomerCancelOrder(order: PaymentOrderStatus): boolean {
  return ["pending", "pending_payment", "failed", "cancelled", "expired", "unpaid"].includes(order.payment_status ?? "") &&
    !["cancelled", "rejected", "delivered"].includes(order.status ?? "");
}