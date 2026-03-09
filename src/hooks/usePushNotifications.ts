import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;

    const subscribe = async () => {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Get VAPID public key from edge function
        const { data, error } = await supabase.functions.invoke("push-subscribe", {
          body: { action: "get-key" },
        });

        if (error || !data?.publicKey) {
          console.error("Failed to get VAPID key:", error);
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const convertedKey = urlBase64ToUint8Array(data.publicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
        }

        // Save subscription to server
        const subJson = subscription.toJSON();
        await supabase.functions.invoke("push-subscribe", {
          body: {
            action: "subscribe",
            subscription: {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
            },
          },
        });

        subscribedRef.current = true;
        console.log("Push notifications subscribed successfully");
      } catch (err) {
        console.error("Push subscription failed:", err);
      }
    };

    // Delay subscription slightly to not block initial load
    const timer = setTimeout(subscribe, 3000);
    return () => clearTimeout(timer);
  }, [user]);
};
