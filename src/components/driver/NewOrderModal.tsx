import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Store, Clock, Package, Check, X, Loader2 } from "lucide-react";
import { driverPayoutForFee } from "@/lib/serviceArea";
import { getNotificationPrefs } from "@/hooks/useNotificationPrefs";

interface NewOrderOffer {
  id: string;
  order_number: number;
  restaurant: string;
  customer_address: string;
  total: number;
  delivery_fee: number;
  items: any[];
  created_at: string;
  customer_name?: string;
  offer_expires_at?: string | null;
}

interface NewOrderModalProps {
  open: boolean;
  offer: NewOrderOffer | null;
  distanceKm: number | null;
  accepting: boolean;
  rejecting: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const NewOrderModal = ({
  open,
  offer,
  distanceKm,
  accepting,
  rejecting,
  onAccept,
  onReject,
}: NewOrderModalProps) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedbackCtxRef = useRef<AudioContext | null>(null);

  // Reset dismissed flag whenever a new offer arrives
  useEffect(() => {
    setDismissed(false);
  }, [offer?.id]);

  const [confirmReject, setConfirmReject] = useState(false);

  const stopAlert = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        /* noop */
      }
    }
  };

  // Play a short two-note feedback chime via Web Audio.
  // variant "accept" = bright rising major third (E5 -> A5)
  // variant "decline" = muted descending minor (A4 -> D4)
  const playFeedback = (variant: "accept" | "decline") => {
    if (!getNotificationPrefs().driver_action_sounds) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = feedbackCtxRef.current ?? new Ctx();
      feedbackCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const notes =
        variant === "accept"
          ? [
              { f: 659.25, t: 0 },
              { f: 880.0, t: 0.11 },
            ] // E5 -> A5
          : [
              { f: 440.0, t: 0 },
              { f: 293.66, t: 0.13 },
            ]; // A4 -> D4

      notes.forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = variant === "accept" ? "triangle" : "sawtooth";
        osc.frequency.value = f;
        const start = now + t;
        const dur = 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(variant === "accept" ? 0.35 : 0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      /* audio unavailable — silent fallback */
    }
  };

  const handleAcceptClick = () => {
    if (dismissed || accepting || rejecting) return;
    setDismissed(true);
    stopAlert();
    playFeedback("accept");
    onAccept();
  };

  const handleRejectClick = () => {
    if (dismissed || accepting || rejecting) return;
    setDismissed(true);
    stopAlert();
    playFeedback("decline");
    onReject();
  };

  // Play custom alert sound + vibrate on open, loop for ~10 seconds, then stop
  useEffect(() => {
    if (!open || !offer || accepting || rejecting) return;

    const audio = new Audio("/sounds/new-order.mp3");
    audio.loop = true;
    audio.volume = 1;
    audioRef.current = audio;

    audio.play().catch(() => {
      /* autoplay blocked — silent fallback */
    });

    // Vibration pattern: buzz 600ms, pause 300ms — repeated for ~10s
    // navigator.vibrate accepts an array of on/off durations in ms
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const pattern: number[] = [];
      for (let i = 0; i < 11; i++) pattern.push(600, 300);
      try {
        navigator.vibrate(pattern);
      } catch {
        /* not supported */
      }
    }

    const stopTimer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch {
          /* noop */
        }
      }
    }, 10000);

    return () => {
      clearTimeout(stopTimer);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch {
          /* noop */
        }
      }
    };
  }, [open, offer?.id, accepting, rejecting]);

  useEffect(() => {
    if (!offer?.offer_expires_at) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(offer.offer_expires_at!).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [offer?.offer_expires_at, offer?.id]);

  if (!offer) return null;
  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(offer.created_at).getTime()) / 60000),
  );

  // Countdown ring math (5 min = 300s default)
  const totalSeconds = 300;
  const progress = secondsLeft !== null ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 1;
  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft !== null ? secondsLeft % 60 : 0;
  const countdownLabel = secondsLeft !== null ? `${mm}:${ss.toString().padStart(2, "0")}` : "";
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <Dialog
      open={open && !dismissed}
      onOpenChange={() => {
        /* must Accept or Reject */
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-2 border-primary max-h-[90vh] flex flex-col gap-0 top-[5vh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with countdown */}
        <div className="bg-primary px-5 py-3 text-primary-foreground shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Package className="h-5 w-5" />
              <h2 className="text-base font-bold">New Delivery Request</h2>
            </div>
            <p className="text-xs opacity-90">
              Order #{offer.order_number} • {minutesAgo}m ago
            </p>
          </div>
          {secondsLeft !== null && (
            <div className="relative h-12 w-12 shrink-0">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  fill="none"
                  stroke="hsl(var(--primary-foreground) / 0.25)"
                  strokeWidth="4"
                />
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  fill="none"
                  stroke="hsl(var(--primary-foreground))"
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 250ms linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                {countdownLabel}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--driver-success)/0.08)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-3">
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                You'll earn
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-[hsl(var(--driver-success))]">
                  R{driverPayoutForFee(offer.delivery_fee)}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Customer pays R{offer.delivery_fee} delivery
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                Order value
              </p>
              <p className="text-lg font-bold text-foreground">R{offer.total}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                Pickup
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{offer.restaurant}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--driver-info)/0.1)] shrink-0">
              <MapPin className="h-4 w-4 text-[hsl(var(--driver-info))]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">
                Delivery
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {offer.customer_address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs border-t border-border pt-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {distanceKm !== null ? `${distanceKm.toFixed(1)} km away` : "Distance unknown"}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {minutesAgo}m old
            </span>
            <span className="ml-auto text-muted-foreground">{offer.items.length} items</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-secondary/30 border-t border-border shrink-0 space-y-2">
          {(accepting || rejecting) && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing… please wait
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRejectClick}
              disabled={accepting || rejecting || dismissed}
              className="rounded-xl border-2 border-destructive/30 bg-card py-3.5 text-sm font-bold text-destructive disabled:opacity-50 transition-all hover:bg-destructive/5 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {rejecting ? "Declining…" : "Decline"}
            </button>
            <button
              onClick={handleAcceptClick}
              disabled={accepting || rejecting || dismissed}
              className="rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-95 active:scale-[0.98] shadow-orange flex items-center justify-center gap-2"
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {accepting ? "Accepting…" : "Accept"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderModal;
