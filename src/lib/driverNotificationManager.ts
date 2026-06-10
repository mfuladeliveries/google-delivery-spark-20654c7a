/**
 * Centralized driver notification manager.
 *
 * Responsibilities:
 *  - Owns the single active <audio> instance for the new-order ringtone.
 *  - Plays the sound exactly ONCE per offer id (Uber Eats / Bolt Food / Mr D style).
 *  - Stops audio + vibration immediately on accept / reject / timeout / cancel / offline / background.
 *  - Tracks per-offer state so an offer can never re-trigger the sound once it has been
 *    played, responded to, or cancelled.
 *
 * The module exports a singleton — only one ringtone can be active at a time anywhere
 * in the driver app.
 */

type PlayedState = "played" | "responded" | "cancelled";

let audio: HTMLAudioElement | null = null;
let fallback: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null = null;
const offerState = new Map<string, PlayedState>();

const safeVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
};

const teardownAudio = () => {
  try {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      audio.onended = null;
      audio = null;
    }
  } catch {
    /* ignore */
  }
  try {
    if (fallback) {
      fallback.osc.stop();
      fallback.ctx.close();
      fallback = null;
    }
  } catch {
    /* ignore */
  }
};

/**
 * Stop the ringtone immediately and cancel any active vibration.
 * Safe to call multiple times.
 */
export const stopNotificationSound = () => {
  teardownAudio();
  safeVibrate(0);
};

/**
 * Play the new-order ringtone exactly once for the given offer.
 * - No-op if the same offer already played (prevents duplicate Supabase / push events from re-ringing).
 * - No-op if the offer was responded to or cancelled.
 * - Stops any previously playing sound before starting (single active instance).
 */
export const startNotificationSound = (offerId: string) => {
  const state = offerState.get(offerId);
  if (state === "played" || state === "responded" || state === "cancelled") return;

  offerState.set(offerId, "played");

  // Stop any previous sound (only one ringtone at a time)
  teardownAudio();

  try {
    audio = new Audio("/sounds/new-order.mp3");
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 1.0;
    audio.onended = () => {
      // Clean up handle once playback finishes naturally
      if (audio) audio.onended = null;
      audio = null;
    };
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay blocked — fall back to a short synthesized beep (also one-shot)
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = 880;
          gain.gain.value = 0.4;
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.9);
          fallback = { ctx, osc, gain };
          osc.onended = () => {
            try {
              ctx.close();
            } catch {
              /* ignore */
            }
            fallback = null;
          };
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }

  // Single vibration burst (no repeating interval)
  safeVibrate([500, 200, 500]);
};

/**
 * Mark an offer as responded to (accepted or rejected).
 * Stops the sound and guarantees the offer can never trigger it again.
 */
export const markOfferResponded = (offerId: string) => {
  offerState.set(offerId, "responded");
  stopNotificationSound();
};

/**
 * Mark an offer as cancelled / expired / reassigned. Stops sound and blocks future triggers.
 */
export const markOfferCancelled = (offerId: string) => {
  offerState.set(offerId, "cancelled");
  stopNotificationSound();
};

/**
 * Returns true if the offer should still trigger UI / sound (not played, responded, or cancelled).
 */
export const isOfferActive = (offerId: string) => {
  const s = offerState.get(offerId);
  return s !== "responded" && s !== "cancelled";
};

/**
 * Returns true if the ringtone has already been played for this offer.
 */
export const hasOfferRung = (offerId: string) => offerState.has(offerId);

/**
 * Close any OS-level notifications tagged for this offer.
 */
export const clearOfferNotifications = (offerId: string) => {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.getNotifications({ tag: `offer-${offerId}` }).then((ns) => {
          ns.forEach((n) => n.close());
        });
      });
    }
  } catch {
    /* ignore */
  }
};

/**
 * Full reset — used when the driver goes offline or signs out.
 */
export const cleanupNotificationListeners = () => {
  stopNotificationSound();
  offerState.clear();
};
