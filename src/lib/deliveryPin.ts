/**
 * Delivery PIN helpers.
 *
 * The authoritative hash + attempt lockout lives in the database
 * (`verify_and_complete_delivery`). These helpers only cover the
 * client-side generation of the 6-digit code, plus a SHA-256 hash
 * helper matching the server's digest so it can be asserted in tests.
 */

/** Cryptographically-random 6-digit delivery PIN (always 100000–999999). */
export const generateDeliveryPin = (): string => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
};

/** SHA-256 hex digest of a PIN — deterministic for the same input. */
export const hashDeliveryPin = async (pin: string): Promise<string> => {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
