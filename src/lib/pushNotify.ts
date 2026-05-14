import { supabase } from "@/integrations/supabase/client";

interface PushNotifyParams {
  order_id: string;
  order_number: number;
  status: string;
  restaurant?: string;
  total?: number;
  user_id?: string;
  driver_id?: string | null;
  restaurant_id?: string | null;
  old_status?: string | null;
  reason?: string;
  target_user_id?: string;
}

export const sendPushNotification = (params: PushNotifyParams) => {
  supabase.functions.invoke("push-notify", { body: params }).catch(() => {});
};

/**
 * Kick off the targeted dispatch chain and immediately push the first offered driver.
 * Without this, the very first offer relies on a periodic dispatch-tick — which means
 * a driver only gets a push notification on the next tick (or never if their app is closed).
 */
export const dispatchAndNotify = async (
  orderId: string,
  orderNumber: number,
  restaurant: string,
  total: number,
) => {
  try {
    const { data } = await supabase.rpc("dispatch_assign_next", { p_order_id: orderId });
    const result = data as { phase?: string; offered_to?: string | null } | null;

    if (result?.offered_to && (result.phase === "offer_a" || result.phase === "offer_b")) {
      // Targeted push to the first offered driver — works even when the app is closed
      sendPushNotification({
        order_id: orderId,
        order_number: orderNumber,
        status: "offer_pending",
        restaurant,
        total,
        target_user_id: result.offered_to,
      });
    } else if (result?.phase === "waiting") {
      // No driver in the customer's area is available — tell the customer + broadcast to any online drivers as fallback
      sendPushNotification({
        order_id: orderId,
        order_number: orderNumber,
        status: "no_driver_available",
        restaurant,
        total,
      });
      sendPushNotification({
        order_id: orderId,
        order_number: orderNumber,
        status: "dispatch_broadcast",
        restaurant,
        total,
      });
    }
  } catch {
    /* silent — dispatch-tick will retry */
  }
};
