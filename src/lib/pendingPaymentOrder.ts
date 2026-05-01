export interface PendingPaymentOrder {
  orderId: string;
  orderNumber: string;
  total: number;
  restaurant?: string;
  savedAt: number;
}

const STORAGE_KEY = "pending_payfast_order";
const MAX_AGE_MS = 1000 * 60 * 60 * 6;

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const savePendingPaymentOrder = (
  order: Omit<PendingPaymentOrder, "savedAt">,
) => {
  if (!canUseStorage()) return;

  const payload: PendingPaymentOrder = {
    ...order,
    orderNumber: String(order.orderNumber),
    savedAt: Date.now(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const loadPendingPaymentOrder = (
  orderNumber?: string | number | null,
): PendingPaymentOrder | null => {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingPaymentOrder>;
    if (
      !parsed ||
      typeof parsed.orderId !== "string" ||
      typeof parsed.orderNumber !== "string" ||
      typeof parsed.total !== "number" ||
      typeof parsed.savedAt !== "number"
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (
      orderNumber != null &&
      String(orderNumber).trim() !== "" &&
      parsed.orderNumber !== String(orderNumber)
    ) {
      return null;
    }

    return parsed as PendingPaymentOrder;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearPendingPaymentOrder = (
  orderNumber?: string | number | null,
) => {
  if (!canUseStorage()) return;

  if (orderNumber == null || String(orderNumber).trim() === "") {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const current = loadPendingPaymentOrder();
  if (current && current.orderNumber === String(orderNumber)) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
};