import { useEffect, useState, useCallback } from "react";

export type NotificationPrefs = {
  out_for_delivery: boolean;
  cancelled: boolean;
  driver_action_sounds: boolean;
};

const STORAGE_KEY = "notification_prefs";
const DEFAULTS: NotificationPrefs = {
  out_for_delivery: true,
  cancelled: true,
  driver_action_sounds: true,
};
const EVENT_NAME = "notification-prefs-change";

const read = (): NotificationPrefs => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
};

export const getNotificationPrefs = read;

export const useNotificationPrefs = () => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(read);

  useEffect(() => {
    const handler = () => setPrefs(read());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    const next = { ...read(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  return { prefs, update };
};
