import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { canPayOrder } from "@/lib/approvalPayment";
import { savePendingPaymentOrder } from "@/lib/pendingPaymentOrder";

const statusLabels: Record<string, string> = {
  awaiting_restaurant: "Waiting for Approval",
  pending_payment: "Accepted — awaiting payment",
  pending: "Order Placed",
  confirmed: "Accepted by Restaurant",
  preparing: "Being Prepared",
  ready: "Ready for Pickup",
  driver_assigned: "Driver Assigned",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Order Cancelled",
  rejected: "Order Rejected",
};

const statusEmojis: Record<string, string> = {
  pending: "🕐",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  driver_assigned: "🧑‍✈️",
  out_for_delivery: "🚗",
  delivered: "🎉",
  cancelled: "❌",
  rejected: "🚫",
};

// Track which notifications have been shown to prevent duplicates
const shownNotifications = new Set<string>();

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

const sendBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", badge: "/favicon.ico" });
  } catch {
    /* silent */
  }
};

const OrderNotifications = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = useRef(location.pathname);
  currentPath.current = location.pathname;
  const resumedOrders = useRef(new Set<string>());
  const hasRequestedPermission = useRef(false);

  // Subscribe to Web Push notifications for background alerts
  usePushNotifications();

  useEffect(() => {
    if (!user || loading) return;

    let cancelled = false;
    let checking = false;
    const resumePayment = async () => {
      if (role !== "customer" || checking || !navigator.onLine) return;
      if (/^\/(pay\/|payment\/|auth|reset-password|forgot-password|admin|driver|restaurant\/login)/.test(currentPath.current)) return;
      checking = true;
      try {
        const { data, error } = await supabase.from("orders")
          .select("id,order_number,total,restaurant,status,payment_status,payment_method")
          .eq("user_id", user.id).eq("status", "pending_payment")
          .eq("payment_method", "online").order("created_at", { ascending: false }).limit(10);
        if (cancelled || error) return;
        const order = data?.find((candidate) => canPayOrder(candidate) && !resumedOrders.current.has(candidate.id));
        if (!order) return;
        resumedOrders.current.add(order.id);
        savePendingPaymentOrder({ orderId: order.id, orderNumber: String(order.order_number), total: Number(order.total), restaurant: order.restaurant });
        navigate(`/pay/yoco?order_id=${order.id}`, { replace: true });
      } finally {
        checking = false;
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void resumePayment(); };
    void resumePayment();
    window.addEventListener("online", resumePayment);
    window.addEventListener("focus", resumePayment);
    document.addEventListener("visibilitychange", onVisible);
    const recoveryTimer = window.setInterval(onVisible, 10000);

    if (!hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestNotificationPermission();
    }

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Customer notifications: order status updates
    if (role === "customer" || !role) {
      const ch = supabase
        .channel("customer-notifications")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.old?.status === "awaiting_restaurant" && canPayOrder(payload.new)) void resumePayment();
            const newStatus = payload.new?.status;
            const orderNumber = payload.new?.order_number;
            const orderId = payload.new?.id;
            if (!newStatus || !orderNumber || !orderId) return;

            if (payload.new?.payment_status === "paid" && payload.old?.payment_status !== "paid") {
              const key = `${orderId}-paid`;
              if (!shownNotifications.has(key)) {
                shownNotifications.add(key);
                toast.success(`Payment successful — Order #${orderNumber}`);
                if (document.hidden) sendBrowserNotification(`Order #${orderNumber}`, "Payment successful");
              }
            }
            if (payload.old?.status === newStatus) return;

            // Deduplication: only show cancellation and out_for_delivery once per order
            const dedupeKey = `${orderId}-${newStatus}`;
            if (
              (newStatus === "cancelled" ||
                newStatus === "rejected" ||
                newStatus === "out_for_delivery") &&
              shownNotifications.has(dedupeKey)
            ) {
              return;
            }

            // Respect user notification preferences for one-shot alerts
            const prefs = getNotificationPrefs();
            if (newStatus === "out_for_delivery" && !prefs.out_for_delivery) return;
            if ((newStatus === "cancelled" || newStatus === "rejected") && !prefs.cancelled) return;

            const emoji = statusEmojis[newStatus] || "📋";
            const label = statusLabels[newStatus] || newStatus;
            const title = `${emoji} Order #${orderNumber}`;

            if (newStatus === "delivered") toast.success(title, { description: label });
            else if (newStatus === "cancelled" || newStatus === "rejected")
              toast.error(title, { description: label });
            else toast.info(title, { description: label });

            // Mark as shown for dedupe statuses
            if (
              newStatus === "cancelled" ||
              newStatus === "rejected" ||
              newStatus === "out_for_delivery"
            ) {
              shownNotifications.add(dedupeKey);
            }

            if (document.hidden) sendBrowserNotification(title, label);
          },
        )
        .subscribe();
      channels.push(ch);
    }

    // Restaurant + driver alerts are delivered exclusively via Web Push
    // (`push-notify` edge function). We deliberately do NOT open an
    // unfiltered Realtime channel here — at scale that fans out every
    // order INSERT/UPDATE to every signed-in restaurant/driver, which is
    // the single biggest Realtime cost driver.

    return () => {
      cancelled = true;
      window.clearInterval(recoveryTimer);
      window.removeEventListener("online", resumePayment);
      window.removeEventListener("focus", resumePayment);
      document.removeEventListener("visibilitychange", onVisible);
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [user?.id, role, loading, navigate]);

  return null;
};

export default OrderNotifications;
