import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  preparing: "Being Prepared",
  ready: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Order Cancelled",
};

const statusEmojis: Record<string, string> = {
  pending: "🕐",
  confirmed: "✅",
  preparing: "👨‍🍳",
  ready: "📦",
  out_for_delivery: "🚗",
  delivered: "🎉",
  cancelled: "❌",
};

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
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
  } catch {
    // Silently fail on environments that don't support notifications
  }
};

const OrderNotifications = () => {
  const { user } = useAuth();
  const hasRequestedPermission = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Request permission once
    if (!hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestNotificationPermission();
    }

    const channel = supabase
      .channel("order-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          const orderNumber = payload.new?.order_number;
          if (!newStatus || !orderNumber) return;

          const emoji = statusEmojis[newStatus] || "📋";
          const label = statusLabels[newStatus] || newStatus;
          const title = `${emoji} Order #${orderNumber}`;
          const body = label;

          // In-app toast
          if (newStatus === "delivered") {
            toast.success(title, { description: body });
          } else if (newStatus === "cancelled") {
            toast.error(title, { description: body });
          } else {
            toast.info(title, { description: body });
          }

          // Browser push notification (works in background)
          if (document.hidden) {
            sendBrowserNotification(title, body);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
};

export default OrderNotifications;
