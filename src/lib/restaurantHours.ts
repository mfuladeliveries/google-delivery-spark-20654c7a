/**
 * Helpers for restaurant opening-hours.
 * Times are stored as Postgres `time` (HH:MM:SS) strings.
 */

const toMinutes = (t: string | null | undefined): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export const isRestaurantOpen = (
  opens_at: string | null | undefined,
  closes_at: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  const open = toMinutes(opens_at);
  const close = toMinutes(closes_at);
  // No hours set → assume always open
  if (open === null || close === null) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  // Overnight hours (e.g. 18:00 → 02:00)
  if (close <= open) return cur >= open || cur < close;
  return cur >= open && cur < close;
};

export const formatOpensAt = (opens_at: string | null | undefined): string => {
  if (!opens_at) return "";
  const [h, m] = opens_at.split(":");
  const hh = parseInt(h, 10);
  const period = hh >= 12 ? "PM" : "AM";
  const display = hh % 12 || 12;
  return `${display}:${m} ${period}`;
};
