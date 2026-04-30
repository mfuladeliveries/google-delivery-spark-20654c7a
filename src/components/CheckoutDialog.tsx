import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { X, Package, MapPin, Phone, User, StickyNote, CreditCard, Wallet, Clock, Navigation, AlertTriangle, Map as MapIcon, Check } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCredits } from "@/hooks/useCustomerCredits";
import { useCustomerLocation } from "@/hooks/useCustomerLocation";
import { z } from "zod";
import { toast } from "sonner";
// dispatchAndNotify removed — dispatch is now triggered server-side after PayFast ITN confirms payment.
import { useNavigate } from "react-router-dom";
import { AddressAutocomplete, type ValidatedAddress } from "@/components/AddressAutocomplete";
import { findNearestZone, OUT_OF_ZONE_MESSAGE, DEFAULT_ZONE_RADIUS_KM } from "@/lib/serviceArea";

// Lazy-load the heavy Leaflet map picker only when the user opens it.
const AddressMapPicker = lazy(() => import("@/components/AddressMapPicker"));

// Same-day delivery cutoff (last time a scheduled order can be requested for)
const CLOSING_HOUR = 21; // 21:00
const CLOSING_MINUTE = 0;
const PREP_LEAD_MINUTES = 30; // earliest schedule from now

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  contact: z.string().trim().min(7, "Contact number is too short").max(20, "Contact number is too long").regex(/^[0-9\s+()-]+$/, "Invalid phone number format"),
  address: z
    .string()
    .trim()
    .min(8, 'Full address looks too short. Try e.g. "12 Oak Street, Khayelitsha".')
    .max(300, "Address must be less than 300 characters")
    .regex(/[A-Za-z]/, 'Address needs a street or suburb name, e.g. "12 Oak Street, Khayelitsha".')
    .regex(/^[A-Za-z0-9\s,.\-/#'’()]+$/, 'Address has invalid characters. Use letters, numbers, and , . - / # only (e.g. "12A Oak St, Mfuleni").'),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
  deliveryInstructions: z.string().max(300, "Delivery instructions must be less than 300 characters").optional(),
  tip: z.number().min(0, "Tip cannot be negative").max(10000, "Tip amount is too large"),
});

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  tax: number;
  delivery: number;
  onOrderPlaced: () => void;
  initialFoodNote?: string;
}

const tipOptions = [0, 5, 10, 15, 20, 30];

const pad = (n: number) => String(n).padStart(2, "0");

const CheckoutDialog = ({
  open,
  onClose,
  items,
  subtotal,
  tax,
  delivery,
  onOrderPlaced,
  initialFoodNote,
}: CheckoutDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance: walletBalance, refresh: refreshWallet } = useCustomerCredits();
  const { refresh: refreshLocation } = useCustomerLocation();
  const [useWallet, setUseWallet] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  /** Optional house/unit number prepended to the geocoded street/suburb. */
  const [houseNumber, setHouseNumber] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  /** True only when address came from autocomplete suggestion OR map confirmation. */
  const [addressVerified, setAddressVerified] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [deliveryWhen, setDeliveryWhen] = useState<"asap" | "schedule">("asap");
  const [scheduleTime, setScheduleTime] = useState("");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  // PayFast-only — kept as a constant to minimise churn through the rest of the file.
  const paymentMethod: "online" = "online";
  const setPaymentMethod = (_: "online") => {}; // no-op kept for legacy refs
  const [loading, setLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const restaurants = useMemo(
    () => [...new Set(items.map((ci) => ci.item.restaurantName || ci.item.category).filter(Boolean))],
    [items]
  );
  const primaryRestaurantName = restaurants[0] || "";

  // Sync incoming food note from cart
  useEffect(() => {
    if (open && initialFoodNote !== undefined) {
      setNotes(initialFoodNote);
    }
  }, [open, initialFoodNote]);

  // Fetch restaurant coordinates so we can enforce the 8km radius client-side.
  useEffect(() => {
    if (!open || !primaryRestaurantName) return;
    let alive = true;
    supabase
      .from("restaurants")
      .select("lat,lng")
      .eq("name", primaryRestaurantName)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        if (data && typeof data.lat === "number" && typeof data.lng === "number") {
          setRestaurantCoords({ lat: data.lat, lng: data.lng });
        } else {
          setRestaurantCoords(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [open, primaryRestaurantName]);

  // Distance from selected delivery address to the restaurant (km), or null if either side missing.
  const distanceToRestaurant = useMemo(() => {
    if (!coords || !restaurantCoords) return null;
    return distanceKm(coords.lat, coords.lng, restaurantCoords.lat, restaurantCoords.lng);
  }, [coords, restaurantCoords]);

  const outOfRange = distanceToRestaurant != null && distanceToRestaurant > MAX_DELIVERY_KM;

  // Driver-coverage check: when the customer's coords change, ask the server whether any
  // online driver covers this delivery location. Non-blocking — we only warn the customer.
  const [coverage, setCoverage] = useState<{ covered: boolean; online_in_area: number; total_online: number; address_tag: string | null } | null>(null);
  useEffect(() => {
    if (!coords) {
      setCoverage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("check_area_coverage", { p_lat: coords.lat, p_lng: coords.lng, p_address: address });
      if (!cancelled && data) setCoverage(data as any);
    })();
    return () => { cancelled = true; };
  }, [coords, address]);

  const handleAddressSelect = (result: ValidatedAddress) => {
    setAddress(result.address);
    setCoords({ lat: result.lat, lng: result.lng });
    setAddressVerified(true);
    setValidationErrors((prev) => {
      const { address: _a, ...rest } = prev;
      return rest;
    });
  };

  const handleAddressTextChange = (text: string) => {
    setAddress(text);
    // Plain typing invalidates any previously selected coords.
    if (addressVerified) {
      setCoords(null);
      setAddressVerified(false);
    }
  };

  const handleMapConfirm = (result: { address: string; lat: number; lng: number }) => {
    setAddress(result.address);
    setCoords({ lat: result.lat, lng: result.lng });
    setAddressVerified(true);
    setShowMapPicker(false);
    setValidationErrors((prev) => {
      const { address: _a, ...rest } = prev;
      return rest;
    });
  };

  // Compute valid schedule range for today
  const { minTime, maxTime, todayLabel, isPastClosing } = useMemo(() => {
    const now = new Date();
    const earliest = new Date(now.getTime() + PREP_LEAD_MINUTES * 60_000);
    const closing = new Date(now);
    closing.setHours(CLOSING_HOUR, CLOSING_MINUTE, 0, 0);
    const past = earliest > closing;
    return {
      minTime: `${pad(earliest.getHours())}:${pad(earliest.getMinutes())}`,
      maxTime: `${pad(CLOSING_HOUR)}:${pad(CLOSING_MINUTE)}`,
      todayLabel: now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      isPastClosing: past,
    };
  }, [open]);

  const actualTip = customTip ? parseFloat(customTip) || 0 : tip;
  const grossTotal = subtotal + tax + delivery + actualTip;
  const creditsToApply = useWallet && walletBalance > 0 ? Math.min(walletBalance, grossTotal) : 0;
  const total = Math.max(0, grossTotal - creditsToApply);

  // Load profile to prefill name + contact. We deliberately do NOT prefill the
  // delivery address — it must always be re-selected from autocomplete or the
  // map so the coords are guaranteed valid.
  useEffect(() => {
    if (!user || profileLoaded) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, contact_number")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setName(data.full_name || "");
        setContact(data.contact_number || "");
      }
      setProfileLoaded(true);
    };
    loadProfile();
  }, [user, profileLoaded]);

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please sign in to place an order.");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    const trimmedUnit = houseNumber.trim();
    const trimmedStreet = address.trim();
    const fullAddress = trimmedUnit ? `${trimmedUnit} ${trimmedStreet}` : trimmedStreet;

    if (!fullAddress) {
      toast.error("Please enter your delivery address.");
      setValidationErrors((prev) => ({
        ...prev,
        address: 'Delivery address is required, e.g. "12 Oak Street, Khayelitsha".',
      }));
      return;
    }

    // House/unit number must be alphanumeric (allows things like "12A", "Unit 3", "B-4").
    if (trimmedUnit && !/^[A-Za-z0-9\s\-/#]{1,20}$/.test(trimmedUnit)) {
      toast.error("House/unit number contains invalid characters.");
      setValidationErrors((prev) => ({
        ...prev,
        address: 'House/unit number can only contain letters, numbers, spaces, and - / # (e.g. "12A", "Unit 3", "B-4").',
      }));
      return;
    }

    if (!addressVerified || !coords) {
      toast.error("Please pick your delivery address from the suggestions or confirm it on the map.");
      setValidationErrors((prev) => ({
        ...prev,
        address: "Select a valid address from the suggestions.",
      }));
      return;
    }

    if (outOfRange) {
      toast.error(`Your address is outside the ${MAX_DELIVERY_KM} km delivery range for this restaurant.`);
      return;
    }

    const result = checkoutSchema.safeParse({
      name, contact, address: fullAddress, notes, deliveryInstructions, tip: actualTip,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setValidationErrors(errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    let scheduledLabel = "";
    if (deliveryWhen === "schedule") {
      if (!scheduleTime) {
        setValidationErrors({ schedule: "Please pick a delivery time." });
        toast.error("Please pick a delivery time.");
        return;
      }
      if (isPastClosing) {
        setValidationErrors({ schedule: `Too late to schedule today. We close at ${maxTime}.` });
        toast.error(`Too late to schedule today. We close at ${maxTime}.`);
        return;
      }
      if (scheduleTime < minTime || scheduleTime > maxTime) {
        setValidationErrors({ schedule: `Pick a time between ${minTime} and ${maxTime} today.` });
        toast.error(`Pick a time between ${minTime} and ${maxTime} today.`);
        return;
      }
      scheduledLabel = `${todayLabel} at ${scheduleTime}`;
    }

    setValidationErrors({});
    setLoading(true);

    try {
      await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          contact_number: contact.trim(),
          address: fullAddress,
          lat: coords.lat,
          lng: coords.lng,
        })
        .eq("user_id", user.id);
      refreshLocation();

      const deliveryCode = String(Math.floor(100000 + Math.random() * 900000));

      const orderItems = items.map((ci) => ({
        id: ci.item.id,
        quantity: ci.quantity,
      }));

      // Build a per-item options summary so the kitchen + driver see what was picked.
      const optionsLines = items
        .filter(ci =>
          ci.selectedCut ||
          ci.selectedSize ||
          (ci.selectedAddOns && ci.selectedAddOns.length > 0)
        )
        .map(ci => {
          const parts: string[] = [];
          if (ci.selectedCut) {
            parts.push(
              ci.selectedPieces && ci.selectedPieces > 1
                ? `${ci.selectedPieces}× ${ci.selectedCut.name}`
                : ci.selectedCut.name
            );
          }
          if (ci.selectedSize) parts.push(ci.selectedSize.name);
          if (ci.selectedAddOns && ci.selectedAddOns.length > 0) {
            parts.push(`with ${ci.selectedAddOns.map(a => a.name).join(", ")}`);
          }
          return `${ci.quantity}× ${ci.item.name} (${parts.join(" — ")})`;
        });

      // Combine food note, delivery instructions, and scheduled time into special_notes
      const combinedNotes = [
        optionsLines.length > 0 ? `Item options: ${optionsLines.join(" | ")}` : "",
        notes.trim() ? `Food note: ${notes.trim()}` : "",
        deliveryInstructions.trim() ? `Delivery instructions: ${deliveryInstructions.trim()}` : "",
        scheduledLabel ? `Scheduled for: ${scheduledLabel}` : "Deliver ASAP",
      ].filter(Boolean).join(" | ");

      const { data: order, error: orderError } = await supabase.rpc("create_verified_order", {
        p_items: orderItems,
        p_restaurant_name: restaurants[0] || "",
        p_customer_name: name.trim(),
        p_customer_contact: contact.trim(),
        p_customer_address: fullAddress,
        p_customer_lat: coords.lat,
        p_customer_lng: coords.lng,
        p_special_notes: combinedNotes,
        p_tip: actualTip,
        p_delivery_code: deliveryCode,
        p_payment_method: paymentMethod,
      });

      if (orderError) {
        console.error("Order placement failed:", orderError.message, orderError.details, orderError.hint);
        const isRateLimited =
          orderError.code === "42901" ||
          /too many orders/i.test(orderError.message || "");
        const isOutOfRange =
          orderError.code === "22023" ||
          /not available in your area/i.test(orderError.message || "");
        const title = isRateLimited
          ? "You're placing orders too quickly"
          : isOutOfRange
          ? "Delivery not available in your area"
          : "Failed to place your order, try again.";
        const description = isRateLimited
          ? "Please wait about a minute before placing another order."
          : isOutOfRange
          ? "Please pick a delivery location closer to our service area."
          : orderError.message;
        toast.error(title, { description });
        setLoading(false);
        return;
      }

      const orderResult = order as Record<string, unknown> | null;
      const orderNum = orderResult?.order_number || "N/A";
      const orderId = orderResult?.order_id as string;

      // Apply wallet credits if selected
      if (orderId && creditsToApply > 0) {
        const { error: credErr } = await supabase.rpc("spend_customer_credits", {
          p_amount: creditsToApply,
          p_order_id: orderId,
          p_note: `Applied to order #${orderNum}`,
        });
        if (credErr) {
          console.error("Failed to apply credits:", credErr);
        } else {
          refreshWallet();
        }
      }

      // Save delivery PIN to localStorage so customer can view it later
      if (orderId) {
        const pins = JSON.parse(localStorage.getItem("delivery_pins") || "{}");
        pins[orderId] = deliveryCode;
        localStorage.setItem("delivery_pins", JSON.stringify(pins));
      }

      // Order is created in `pending_payment` — do NOT dispatch yet.
      // Hand off to PayFast; ITN webhook will flip status to `ready` and
      // start dispatch once payment is confirmed.
      const orderTotalNum = Number(orderResult?.total) || 0;

      toast.success("Redirecting to secure payment…", {
        description: `Order #${orderNum} · R${orderTotalNum.toFixed(2)}`,
        duration: 3000,
      });

      setLoading(false);
      onOrderPlaced();
      onClose();

      navigate("/pay/payfast", {
        state: {
          orderId,
          orderNumber: orderNum,
          total: orderTotalNum,
          restaurant: restaurants[0] || undefined,
        },
        replace: true,
      });
    } catch (err) {
      console.error("Unexpected order error:", err);
      toast.error("Failed to place your order, try again.");
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-[60] mx-auto max-w-lg -translate-y-1/2 rounded-3xl border border-border bg-background p-5 max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-foreground">Checkout</h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-secondary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer Details */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <User className="h-3.5 w-3.5 text-primary" /> Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {validationErrors.name && <p className="mt-1 text-xs text-destructive">{validationErrors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Phone className="h-3.5 w-3.5 text-primary" /> Contact Number
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. 072 123 4567"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {validationErrors.contact && <p className="mt-1 text-xs text-destructive">{validationErrors.contact}</p>}
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
            </label>
            <input
              type="text"
              inputMode="text"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value.slice(0, 20))}
              placeholder='House / unit number (optional) — e.g. "12A" or "Unit 3"'
              aria-label="House or unit number"
              className="mb-2 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <AddressAutocomplete
              value={address}
              hasValidSelection={addressVerified}
              onSelect={handleAddressSelect}
              onTextChange={handleAddressTextChange}
              placeholder='e.g. "Oak Street, Khayelitsha"'
            />
            {(houseNumber.trim() || address.trim()) && (
              <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Delivering to {addressVerified ? "(verified)" : "(not yet verified)"}
                </p>
                <p className="mt-0.5 break-words text-sm font-semibold text-foreground">
                  {houseNumber.trim() ? `${houseNumber.trim()} ` : ""}
                  {address.trim() || "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    House #: <span className="font-semibold text-foreground">{houseNumber.trim() || "—"}</span>
                  </span>
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Street &amp; suburb: <span className="font-semibold text-foreground">{address.trim() || "—"}</span>
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              <MapIcon className="h-3.5 w-3.5 text-primary" />
              {addressVerified ? "Adjust pin on map" : "Pick on map & confirm location"}
            </button>

            {validationErrors.address && (
              <p className="mt-1 text-xs text-destructive">{validationErrors.address}</p>
            )}

            {!addressVerified && address.trim().length >= 3 && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Please select a valid address from the suggestions or confirm it on the map.</span>
              </p>
            )}

            {addressVerified && coords && !outOfRange && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Check className="h-3.5 w-3.5" />
                Address verified
                {distanceToRestaurant != null && (
                  <span className="text-muted-foreground font-normal">
                    · {distanceToRestaurant.toFixed(1)} km from {primaryRestaurantName || "restaurant"}
                  </span>
                )}
              </p>
            )}

            {addressVerified && outOfRange && distanceToRestaurant != null && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-destructive mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-destructive">Outside delivery range</p>
                  <p className="mt-0.5 text-foreground">
                    This address is {distanceToRestaurant.toFixed(1)} km from {primaryRestaurantName || "the restaurant"}.
                    We deliver up to {MAX_DELIVERY_KM} km. Please pick a closer address.
                  </p>
                </div>
              </div>
            )}

            {addressVerified && coords && !outOfRange && coverage && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Delivery area
                </span>
                {coverage.address_tag ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    <MapPin className="h-3 w-3" />
                    {coverage.address_tag}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    No matching area
                  </span>
                )}
              </div>
            )}

            {addressVerified && coords && !outOfRange && coverage && !coverage.covered && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-700">No drivers online in your area right now</p>
                  <p className="mt-0.5 text-foreground">
                    You can still place this order, but it may take longer than usual to be picked up while we wait for a driver to come online nearby.
                  </p>
                </div>
              </div>
            )}
          </div>

          {showMapPicker && (
            <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
              <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-background pt-4 shadow-xl">
                <div className="flex items-center justify-between px-4 pb-2">
                  <h3 className="font-display text-base font-bold text-foreground">Confirm delivery location</h3>
                  <button
                    onClick={() => setShowMapPicker(false)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
                    aria-label="Close map"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Suspense
                  fallback={
                    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  }
                >
                  <AddressMapPicker
                    onConfirm={handleMapConfirm}
                    initialAddress={address}
                    initialCoords={coords}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {/* Delivery Instructions */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Navigation className="h-3.5 w-3.5 text-primary" /> Delivery Instructions
            </label>
            <textarea
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="e.g. Gate code 1234, leave at door, call on arrival, blue house with white gate..."
              rows={2}
              maxLength={300}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            {validationErrors.deliveryInstructions && <p className="mt-1 text-xs text-destructive">{validationErrors.deliveryInstructions}</p>}
          </div>

          {/* Delivery Schedule */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" /> When should we deliver?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryWhen("asap")}
                className={`rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all ${
                  deliveryWhen === "asap"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                As soon as possible
              </button>
              <button
                type="button"
                onClick={() => setDeliveryWhen("schedule")}
                disabled={isPastClosing}
                className={`rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  deliveryWhen === "schedule"
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                Schedule for today
              </button>
            </div>
            {deliveryWhen === "schedule" && (
              <div className="mt-2 rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Same day only · between <span className="font-semibold text-foreground">{minTime}</span> and <span className="font-semibold text-foreground">{maxTime}</span> ({todayLabel})
                </p>
                <input
                  type="time"
                  value={scheduleTime}
                  min={minTime}
                  max={maxTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {isPastClosing && (
              <p className="mt-1.5 text-xs text-destructive">
                Too late to schedule today (we close at {maxTime}). Choose ASAP or order tomorrow.
              </p>
            )}
            {validationErrors.schedule && <p className="mt-1 text-xs text-destructive">{validationErrors.schedule}</p>}
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <StickyNote className="h-3.5 w-3.5 text-primary" /> Food Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests? e.g. extra sauce, no onions..."
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            {validationErrors.notes && <p className="mt-1 text-xs text-destructive">{validationErrors.notes}</p>}
          </div>

          {/* Wallet Credits */}
          {walletBalance > 0 && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Wallet className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Use Wallet Credits</p>
                    <p className="text-[11px] text-muted-foreground">
                      Balance: {storeInfo.currency}{walletBalance.toFixed(2)}
                      {useWallet && creditsToApply > 0 && (
                        <> · Applying {storeInfo.currency}{creditsToApply.toFixed(2)}</>
                      )}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="h-5 w-5 rounded border-border accent-primary cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* Payment Method — PayFast only */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">💳 Payment Method</label>
            <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-3.5 text-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-xs text-foreground">Pay online with PayFast</p>
                <p className="text-[10px] text-muted-foreground">Card · Instant EFT · QR · SnapScan</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Secure</span>
            </div>
          </div>

          {/* Tip */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">🙏 Add a Tip</label>
            <div className="flex flex-wrap gap-2">
              {tipOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTip(t); setCustomTip(""); }}
                  className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                    tip === t && !customTip
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {t === 0 ? "No tip" : `R${t}`}
                </button>
              ))}
            </div>
            <input
              value={customTip}
              onChange={(e) => { setCustomTip(e.target.value); setTip(0); }}
              placeholder="Or enter custom amount"
              type="number"
              min="0"
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{storeInfo.currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Service Fee (5%)</span>
              <span>{storeInfo.currency}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span>{storeInfo.currency}{delivery}</span>
            </div>
            {actualTip > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tip</span>
                <span>{storeInfo.currency}{actualTip.toFixed(2)}</span>
              </div>
            )}
            {creditsToApply > 0 && (
              <div className="flex justify-between text-primary">
                <span>Wallet credit</span>
                <span>−{storeInfo.currency}{creditsToApply.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground">
              <span>Total</span>
              <span className="text-primary">{storeInfo.currency}{total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">🍽️ {restaurants.join(", ")}</p>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                💳 Pay online
              </span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || !name.trim() || !contact.trim() || !addressVerified || !coords || outOfRange}
            data-testid="checkout-place-order-button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-display font-bold text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-orange"
          >
            <Package className="h-5 w-5" />
            {loading ? "Placing Order..." : "Place Order"}
          </button>

          <p className="text-center text-[10px] text-muted-foreground">
            {storeInfo.paymentNote}
          </p>
        </div>
      </div>
    </>
  );
};

export default CheckoutDialog;
