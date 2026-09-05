import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  X,
  Package,
  MapPin,
  Phone,
  User,
  StickyNote,
  CreditCard,
  Wallet,
  Clock,
  Navigation,
  AlertTriangle,
  Map as MapIcon,
  Check,
  Plus,
  Star,
  BookmarkPlus,
} from "lucide-react";
import { CartItem, isCompanionStore } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";
import { generateDeliveryPin } from "@/lib/deliveryPin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCredits } from "@/hooks/useCustomerCredits";
import { useCustomerLocation } from "@/hooks/useCustomerLocation";
import { useCustomerAddresses, type SavedAddress } from "@/hooks/useCustomerAddresses";
import { z } from "zod";
import { toast } from "sonner";
// dispatchAndNotify removed — dispatch is triggered server-side once the Yoco webhook confirms payment.
import { useNavigate } from "react-router-dom";
import { AddressAutocomplete, type ValidatedAddress } from "@/components/AddressAutocomplete";
import { SavedAddressDialog } from "@/components/SavedAddressDialog";
import { findNearestZone, OUT_OF_ZONE_MESSAGE, DEFAULT_ZONE_RADIUS_KM } from "@/lib/serviceArea";
import { savePendingPaymentOrder } from "@/lib/pendingPaymentOrder";
import { POLICY_VERSIONS } from "@/lib/policies";
import { Link } from "react-router-dom";

// Lazy-load the heavy Leaflet map picker only when the user opens it.
const AddressMapPicker = lazy(() => import("@/components/AddressMapPicker"));

// Same-day delivery cutoff (last time a scheduled order can be requested for)
const CLOSING_HOUR = 21; // 21:00
const CLOSING_MINUTE = 0;
const PREP_LEAD_MINUTES = 30; // earliest schedule from now

const checkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  contact: z
    .string()
    .trim()
    .min(7, "Contact number is too short")
    .max(20, "Contact number is too long")
    .regex(/^[0-9\s+()-]+$/, "Invalid phone number format"),
  address: z
    .string()
    .trim()
    .min(8, 'Full address looks too short. Try e.g. "12 Oak Street, Khayelitsha".')
    .max(300, "Address must be less than 300 characters")
    .regex(/[A-Za-z]/, 'Address needs a street or suburb name, e.g. "12 Oak Street, Khayelitsha".')
    .regex(
      /^[A-Za-z0-9\s,.\-/#'’()]+$/,
      'Address has invalid characters. Use letters, numbers, and , . - / # only (e.g. "12A Oak St, Mfuleni").',
    ),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
  deliveryInstructions: z
    .string()
    .max(300, "Delivery instructions must be less than 300 characters")
    .optional(),
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
  const { refresh: refreshLocation, zones } = useCustomerLocation();
  const {
    addresses: savedAddresses,
    defaultAddress,
    add: addSavedAddress,
    refresh: refreshAddresses,
  } = useCustomerAddresses();
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [showAddSaved, setShowAddSaved] = useState(false);
  const [saveForNextTime, setSaveForNextTime] = useState(false);
  const [nextTimeLabel, setNextTimeLabel] = useState("Home");
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
  // Online-only — kept as a constant to minimise churn through the rest of the file.
  const paymentMethod: "online" = "online";
  const setPaymentMethod = (_: "online") => {}; // no-op kept for legacy refs
  const [loading, setLoading] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; location: string } | null>(
    null,
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const restaurants = useMemo(
    () => [
      ...new Set(items.map((ci) => ci.item.restaurantName || ci.item.category).filter(Boolean)),
    ],
    [items],
  );
  // The companion store (Mfula Shop) may ride along with any order, so it must
  // never be treated as the order's restaurant.
  const primaryRestaurantName = useMemo(
    () => restaurants.find((n) => !isCompanionStore(n)) || restaurants[0] || "",
    [restaurants],
  );
  const primaryRestaurantId = useMemo(
    () =>
      items
        .filter((ci) => !isCompanionStore(ci.item.restaurantName))
        .map((ci) => ci.item.restaurantId)
        .find(Boolean) || null,
    [items],
  );
  // Stale carts (saved before restaurant IDs were stored on items) only carry a
  // name — we resolve the real UUID from the catalog as a fallback.
  const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(null);
  const checkoutRestaurantId = primaryRestaurantId ?? resolvedRestaurantId;

  // Sync incoming food note from cart
  useEffect(() => {
    if (open && initialFoodNote !== undefined) {
      setNotes(initialFoodNote);
    }
  }, [open, initialFoodNote]);

  // Auto-fill the customer's default saved address when the dialog opens.
  useEffect(() => {
    if (!open || !defaultAddress) return;
    if (addressVerified || address.trim()) return;
    setSelectedSavedId(defaultAddress.id);
    setAddress(defaultAddress.address);
    setCoords({ lat: defaultAddress.lat, lng: defaultAddress.lng });
    setAddressVerified(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultAddress?.id]);

  const handlePickSaved = (a: SavedAddress) => {
    setSelectedSavedId(a.id);
    setAddress(a.address);
    setCoords({ lat: a.lat, lng: a.lng });
    setAddressVerified(true);
    setHouseNumber("");
    setSaveForNextTime(false);
    setValidationErrors((prev) => {
      const { address: _a, ...rest } = prev;
      return rest;
    });
  };

  // Fetch restaurant coordinates so we can enforce the 8km radius client-side.
  useEffect(() => {
    if (!open) return;
    if (!primaryRestaurantId && !primaryRestaurantName) return;
    let alive = true;
    (async () => {
      const { getCatalog } = await import("@/lib/catalog");
      try {
        const cat = await getCatalog();
        if (!alive) return;
        const norm = (s: string) => s.trim().toLowerCase();
        const matches = cat.restaurants.filter((r) =>
          primaryRestaurantId
            ? r.id === primaryRestaurantId
            : norm(r.name) === norm(primaryRestaurantName),
        );
        // Duplicate names exist in the catalog — prefer the one that is switched on.
        const data = matches.find((r) => r.is_active) || matches[0];
        setResolvedRestaurantId(data?.id ?? null);
        if (data && typeof data.lat === "number" && typeof data.lng === "number") {
          setRestaurantCoords({ lat: data.lat, lng: data.lng });
        } else {
          setRestaurantCoords(null);
        }
        if (data) {
          setRestaurantInfo({
            name: data.name || primaryRestaurantName,
            location: ((data.address as string) || "").trim(),
          });
        } else {
          setRestaurantInfo(null);
        }
      } catch {
        if (alive) {
          setRestaurantCoords(null);
          setRestaurantInfo(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, primaryRestaurantName, primaryRestaurantId]);


  // Match the customer's verified coords against the active delivery zones.
  // A delivery is allowed only if the address falls within ANY zone's radius.
  const zoneMatch = useMemo(() => {
    if (!coords) return null;
    return findNearestZone(coords.lat, coords.lng, zones, restaurantCoords);
  }, [coords, zones, restaurantCoords]);

  const outOfRange = !!coords && zoneMatch === null;
  const baseZoneFee = zoneMatch ? zoneMatch.delivery_fee : null;

  // Peak-time surcharge fetched live from the backend; refreshes every minute
  // and whenever the dialog opens so the customer preview matches what the
  // server will charge in create_verified_order.
  const [peakSurcharge, setPeakSurcharge] = useState<number>(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const fetchSurcharge = async () => {
      const { data } = await supabase.rpc("current_peak_surcharge");
      if (alive) setPeakSurcharge(Number(data) || 0);
    };
    fetchSurcharge();
    const t = setInterval(fetchSurcharge, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open]);

  const zoneFee = baseZoneFee != null ? baseZoneFee + peakSurcharge : null;

  // Driver-coverage check: when the customer's coords change, ask the server whether any
  // online driver covers this delivery location. Non-blocking — we only warn the customer.
  const [coverage, setCoverage] = useState<{
    covered: boolean;
    online_in_area: number;
    total_online: number;
    address_tag: string | null;
  } | null>(null);
  useEffect(() => {
    if (!coords) {
      setCoverage(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let wasUncovered = false;

    const check = async () => {
      const { data } = await supabase.rpc("check_area_coverage", {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_address: address,
      });
      if (cancelled) return;
      const row = (Array.isArray(data) ? data[0] : data) as {
        covered: boolean;
        online_in_area: number;
        total_online: number;
        address_tag: string | null;
      } | null;
      if (row) {
        setCoverage(row);
        // If we previously had no driver and now one is online, notify the customer.
        if (wasUncovered && row.covered) {
          toast.success("A driver is now available in your area", {
            description: "You can complete your order now.",
            duration: 6000,
          });
          wasUncovered = false;
        }
        // While no driver is online, keep checking every 15s so we can notify
        // the customer the moment one comes online.
        if (!row.covered) {
          wasUncovered = true;
          timer = setTimeout(check, 15000);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [coords, address]);

  const handleAddressSelect = (result: ValidatedAddress) => {
    setAddress(result.address);
    setCoords({ lat: result.lat, lng: result.lng });
    setAddressVerified(true);
    setSelectedSavedId(null);
    setValidationErrors((prev) => {
      const { address: _a, ...rest } = prev;
      return rest;
    });
  };

  const handleAddressTextChange = (text: string) => {
    setAddress(text);
    setSelectedSavedId(null);
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
    setSelectedSavedId(null);
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
      todayLabel: now.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      isPastClosing: past,
    };
  }, [open]);

  const actualTip = customTip ? parseFloat(customTip) || 0 : tip;
  // Prefer the zone fee derived from the address selected INSIDE the dialog —
  // it reflects the customer's verified coords. Fall back to the cart's prop
  // (which may be stale if the address was changed mid-checkout).
  const effectiveDelivery = zoneFee != null ? zoneFee : delivery;
  const grossTotal = subtotal + tax + effectiveDelivery + actualTip;
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

    if (!policiesAccepted) {
      toast.error("Please accept the Terms, Delivery and Refund policies to continue.");
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
        address:
          'House/unit number can only contain letters, numbers, spaces, and - / # (e.g. "12A", "Unit 3", "B-4").',
      }));
      return;
    }

    if (!addressVerified || !coords) {
      toast.error(
        "Please pick your delivery address from the suggestions or confirm it on the map.",
      );
      setValidationErrors((prev) => ({
        ...prev,
        address: "Select a valid address from the suggestions.",
      }));
      return;
    }

    if (outOfRange) {
      toast.error(OUT_OF_ZONE_MESSAGE);
      return;
    }

    // Note: we no longer block here when no driver is online. The order is
    // created in `pending_payment`/`awaiting_restaurant` state and the
    // Yoco payment screen shows a "Waiting for driver…" hold until a
    // driver in the area comes online.

    const result = checkoutSchema.safeParse({
      name,
      contact,
      address: fullAddress,
      notes,
      deliveryInstructions,
      tip: actualTip,
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

      // Save this address to the customer's address book if they opted in.
      if (saveForNextTime && coords && !selectedSavedId) {
        try {
          await addSavedAddress({
            label: nextTimeLabel.trim() || "Home",
            address: fullAddress,
            lat: coords.lat,
            lng: coords.lng,
            area_id: zoneMatch?.zone.id ?? null,
            is_default: savedAddresses.length === 0,
          });
          refreshAddresses();
        } catch (e) {
          // non-fatal — just log
          console.warn("Failed to save address for next time", e);
        }
      }

      const deliveryCode = generateDeliveryPin();

      const orderItems = items.map((ci) => ({
        id: ci.item.id,
        quantity: ci.quantity,
      }));

      // Build a per-item options summary so the kitchen + driver see what was picked.
      const optionsLines = items
        .filter(
          (ci) =>
            ci.selectedCut ||
            ci.selectedSize ||
            (ci.selectedAddOns && ci.selectedAddOns.length > 0),
        )
        .map((ci) => {
          const parts: string[] = [];
          if (ci.selectedCut) {
            parts.push(
              ci.selectedPieces && ci.selectedPieces > 1
                ? `${ci.selectedPieces}× ${ci.selectedCut.name}`
                : ci.selectedCut.name,
            );
          }
          if (ci.selectedSize) parts.push(ci.selectedSize.name);
          if (ci.selectedAddOns && ci.selectedAddOns.length > 0) {
            parts.push(`with ${ci.selectedAddOns.map((a) => a.name).join(", ")}`);
          }
          return `${ci.quantity}× ${ci.item.name} (${parts.join(" — ")})`;
        });

      // Combine food note, delivery instructions, and scheduled time into special_notes
      const combinedNotes = [
        optionsLines.length > 0 ? `Item options: ${optionsLines.join(" | ")}` : "",
        notes.trim() ? `Food note: ${notes.trim()}` : "",
        deliveryInstructions.trim() ? `Delivery instructions: ${deliveryInstructions.trim()}` : "",
        scheduledLabel ? `Scheduled for: ${scheduledLabel}` : "Deliver ASAP",
      ]
        .filter(Boolean)
        .join(" | ");

      // Driver coverage is intentionally NOT re-checked here as a gate — the
      // Yoco payment screen polls coverage and shows "Waiting for driver…"
      // if none are online yet, so the order can still be placed.

      // Debug trace: what restaurant identity is actually used for this order.
      console.info("[checkout] placing order", {
        cartRestaurantId: primaryRestaurantId,
        resolvedRestaurantId,
        restaurantIdSent: checkoutRestaurantId,
        restaurantNameSent: primaryRestaurantName,
      });

      const { data: order, error: orderError } = await supabase.rpc("create_verified_order", {
        p_items: orderItems,
        p_restaurant_name: primaryRestaurantName,
        p_restaurant_id: checkoutRestaurantId ?? undefined,
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
        console.error("[checkout] order placement failed", {
          code: orderError.code,
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          restaurantIdSent: checkoutRestaurantId,
          restaurantNameSent: primaryRestaurantName,
        });
        const msg = orderError.message || "";
        const isRateLimited = orderError.code === "42901" || /too many orders/i.test(msg);
        const notFound = /could not be found|not found/i.test(msg);
        const unavailable = /currently unavailable/i.test(msg);
        const closed = /currently closed/i.test(msg);
        const noDrivers = /no drivers are online/i.test(msg);
        const noItems = /no valid items/i.test(msg);
        const isOutOfRange =
          /not available in your area/i.test(msg) ||
          (orderError.code === "22023" &&
            !notFound &&
            !unavailable &&
            !closed &&
            !noDrivers &&
            !noItems);

        let title = "We could not place your order. Please try again.";
        let description: string | undefined = msg;
        if (isRateLimited) {
          title = "You're placing orders too quickly";
          description = "Please wait about a minute before placing another order.";
        } else if (notFound) {
          title = "Restaurant could not be found.";
          description = "Please clear your cart and add the items again.";
        } else if (unavailable) {
          title = "This restaurant is currently unavailable for orders.";
          description = "Please choose another restaurant nearby.";
        } else if (closed) {
          title = "This restaurant is closed right now.";
          description = "Please try again during their opening hours.";
        } else if (noDrivers) {
          title = "No drivers are online in your area right now.";
          description = "Please try again in a few minutes.";
        } else if (noItems) {
          title = "Some items are no longer available.";
          description = "Please clear your cart and add the items again.";
        } else if (isOutOfRange) {
          title = "Delivery not available in your area";
          description = "Please pick a delivery location closer to our service area.";
        }
        toast.error(title, { description });
        setLoading(false);
        return;
      }

      const orderResult = order as Record<string, unknown> | null;
      const orderNum = orderResult?.order_number || "N/A";
      const orderId = orderResult?.order_id as string;

      // Persist the customer's policy acceptance alongside the order.
      if (orderId) {
        const { error: policyErr } = await supabase.from("order_policy_acceptances").insert({
          order_id: orderId,
          user_id: user.id,
          accepted_at: new Date().toISOString(),
          terms_version: POLICY_VERSIONS.terms,
          delivery_policy_version: POLICY_VERSIONS.delivery,
          refund_policy_version: POLICY_VERSIONS.refund,
        });
        if (policyErr) console.warn("Failed to record policy acceptance", policyErr);
      }

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

      const orderTotalNum = Number(orderResult?.total) || 0;
      const orderStatus = String(orderResult?.status || "pending_payment");

      if (orderId) {
        savePendingPaymentOrder({
          orderId,
          orderNumber: String(orderNum),
          total: orderTotalNum,
          restaurant: restaurants[0] || undefined,
        });
      }

      setLoading(false);
      onOrderPlaced();
      onClose();

      // If the restaurant must accept the order first, take the customer to a
      // wait screen instead of the Yoco checkout. Payment is initiated only AFTER the
      // restaurant confirms availability.
      if (orderStatus === "awaiting_restaurant") {
        toast.info("Waiting for the restaurant to confirm…", {
          description: `Order #${orderNum} · You won't be charged until they accept.`,
          duration: 5000,
        });
        navigate(`/order-confirmation?order=${orderNum}`, {
          state: {
            orderId,
            orderNumber: orderNum,
            total: orderTotalNum,
            restaurant: restaurants[0] || undefined,
            awaitingRestaurant: true,
          },
          replace: true,
        });
        return;
      }

      toast.success("Redirecting to secure payment…", {
        description: `Order #${orderNum} · R${orderTotalNum.toFixed(2)}`,
        duration: 3000,
      });

      navigate("/pay/yoco", {
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
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Selected restaurant */}
          {(restaurantInfo?.name || primaryRestaurantName) && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Package className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ordering from
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {restaurantInfo?.name || primaryRestaurantName}
                </p>
                {restaurantInfo?.location && (
                  <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{restaurantInfo.location}</span>
                  </p>
                )}
              </div>
            </div>
          )}

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
            {validationErrors.name && (
              <p className="mt-1 text-xs text-destructive">{validationErrors.name}</p>
            )}
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
            {validationErrors.contact && (
              <p className="mt-1 text-xs text-destructive">{validationErrors.contact}</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
            </label>
            {/* Saved-address picker */}
            {savedAddresses.length > 0 && (
              <div className="mb-3 rounded-xl border border-border bg-card p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Saved addresses
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddSaved(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add new
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {savedAddresses.map((a) => {
                    const active = selectedSavedId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handlePickSaved(a)}
                        className={`group inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                        title={a.address}
                      >
                        {a.is_default && (
                          <Star
                            className={`h-3 w-3 flex-shrink-0 ${active ? "" : "text-primary"}`}
                          />
                        )}
                        <span className="font-bold">{a.label}</span>
                        <span
                          className={`truncate max-w-[140px] ${active ? "opacity-90" : "text-muted-foreground"}`}
                        >
                          · {a.address}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {savedAddresses.length === 0 && (
              <button
                type="button"
                onClick={() => setShowAddSaved(true)}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card px-3 py-2.5 text-xs font-semibold text-primary hover:bg-secondary"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save addresses for faster checkout
              </button>
            )}

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
                    House #:{" "}
                    <span className="font-semibold text-foreground">
                      {houseNumber.trim() || "—"}
                    </span>
                  </span>
                  <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Street &amp; suburb:{" "}
                    <span className="font-semibold text-foreground">{address.trim() || "—"}</span>
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
                <span>
                  Please select a valid address from the suggestions or confirm it on the map.
                </span>
              </p>
            )}

            {addressVerified && coords && !outOfRange && zoneMatch && (
              <div className="mt-1.5 space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Check className="h-3.5 w-3.5" />
                  Address verified
                  <span className="text-muted-foreground font-normal">
                    · {zoneMatch.distance_km.toFixed(1)} km from {zoneMatch.zone.name} centre
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    <MapPin className="h-3 w-3" />
                    {zoneMatch.zone.name}
                  </span>
                  {zoneFee != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      Delivery fee: {storeInfo.currency}
                      {zoneFee.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Save-for-next-time toggle (only for fresh, verified, in-range addresses not already saved) */}
            {addressVerified && coords && !outOfRange && !selectedSavedId && (
              <div className="mt-2 rounded-xl border border-border bg-card p-3 space-y-2">
                <label className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookmarkPlus className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Save this for next time
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={saveForNextTime}
                    onChange={(e) => setSaveForNextTime(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                {saveForNextTime && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(["Home", "Work", "Other"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNextTimeLabel(p)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          nextTimeLabel === p
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <input
                      value={["Home", "Work", "Other"].includes(nextTimeLabel) ? "" : nextTimeLabel}
                      onChange={(e) => setNextTimeLabel(e.target.value.slice(0, 40))}
                      placeholder="Custom label"
                      className="flex-1 min-w-[100px] rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {addressVerified && outOfRange && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-destructive mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-destructive">Outside delivery range</p>
                  <p className="mt-0.5 text-foreground">
                    {OUT_OF_ZONE_MESSAGE} Please pick an address within {DEFAULT_ZONE_RADIUS_KM} km
                    of one of our active zones
                    {zones.length > 0 && <> ({zones.map((z) => z.name).join(", ")})</>}.
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
              <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-destructive mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-destructive">No drivers online in your area</p>
                  <p className="mt-0.5 text-foreground">
                    We can't accept orders for this location right now because no driver is
                    currently online nearby. Please try again in a few minutes.
                  </p>
                </div>
              </div>
            )}
          </div>

          {showMapPicker && (
            <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
              <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-background pt-4 shadow-xl">
                <div className="flex items-center justify-between px-4 pb-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    Confirm delivery location
                  </h3>
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
            {validationErrors.deliveryInstructions && (
              <p className="mt-1 text-xs text-destructive">
                {validationErrors.deliveryInstructions}
              </p>
            )}
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
                  Same day only · between{" "}
                  <span className="font-semibold text-foreground">{minTime}</span> and{" "}
                  <span className="font-semibold text-foreground">{maxTime}</span> ({todayLabel})
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
            {validationErrors.schedule && (
              <p className="mt-1 text-xs text-destructive">{validationErrors.schedule}</p>
            )}
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
            {validationErrors.notes && (
              <p className="mt-1 text-xs text-destructive">{validationErrors.notes}</p>
            )}
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
                      Balance: {storeInfo.currency}
                      {walletBalance.toFixed(2)}
                      {useWallet && creditsToApply > 0 && (
                        <>
                          {" "}
                          · Applying {storeInfo.currency}
                          {creditsToApply.toFixed(2)}
                        </>
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

          {/* Payment — single secure card checkout hosted by Yoco */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              💳 Payment Method
            </label>
            <div className="flex items-center gap-2.5 rounded-xl border-2 border-primary bg-primary/5 p-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">Pay securely with Yoco</p>
                <p className="text-[10px] text-muted-foreground">
                  Visa · Mastercard · card details never touch our servers
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              You'll be redirected to Yoco's secure checkout to complete payment.
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">🙏 Add a Tip</label>
            <div className="flex flex-wrap gap-2">
              {tipOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTip(t);
                    setCustomTip("");
                  }}
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
              onChange={(e) => {
                setCustomTip(e.target.value);
                setTip(0);
              }}
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
              <span>
                {storeInfo.currency}
                {subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Service Fee (5%)</span>
              <span>
                {storeInfo.currency}
                {tax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span>
                {storeInfo.currency}
                {(effectiveDelivery - peakSurcharge).toFixed(2)}
              </span>
            </div>
            {peakSurcharge > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Peak-time surcharge</span>
                <span>
                  +{storeInfo.currency}
                  {peakSurcharge.toFixed(2)}
                </span>
              </div>
            )}
            {actualTip > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tip</span>
                <span>
                  {storeInfo.currency}
                  {actualTip.toFixed(2)}
                </span>
              </div>
            )}
            {creditsToApply > 0 && (
              <div className="flex justify-between text-primary">
                <span>Wallet credit</span>
                <span>
                  −{storeInfo.currency}
                  {creditsToApply.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground">
              <span>Total</span>
              <span className="text-primary">
                {storeInfo.currency}
                {total.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">🍽️ {restaurants.join(", ")}</p>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                💳 Pay online
              </span>
            </div>
          </div>

          {/* Policy notice + required agreement */}
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              By placing this order, you confirm that you have read and agree to the Mfula Deliveries{" "}
              <Link
                to="/terms-and-conditions"
                target="_blank"
                className="font-semibold text-primary underline"
              >
                Terms and Conditions
              </Link>
              ,{" "}
              <Link
                to="/delivery-policy"
                target="_blank"
                className="font-semibold text-primary underline"
              >
                Delivery Policy
              </Link>
              , and{" "}
              <Link
                to="/refund-policy"
                target="_blank"
                className="font-semibold text-primary underline"
              >
                Refund and Cancellation Policy
              </Link>
              .
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={policiesAccepted}
                onChange={(e) => setPoliciesAccepted(e.target.checked)}
                data-testid="checkout-policy-agreement"
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                I agree to the Terms and Conditions, Delivery Policy, and Refund and Cancellation
                Policy.
              </span>
            </label>
          </div>

          <button
            onClick={handleCheckout}
            disabled={
              loading ||
              !policiesAccepted ||
              !name.trim() ||
              !contact.trim() ||
              !addressVerified ||
              !coords ||
              outOfRange ||
              (!!coverage && !coverage.covered)
            }
            data-testid="checkout-place-order-button"
            className="btn-glow flex w-full items-center justify-center gap-2 rounded-2xl gradient-maroon py-3.5 font-display font-bold text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-maroon"
          >
            <Package className="h-5 w-5" />
            {loading
              ? "Placing Order..."
              : `Confirm & Pay ${storeInfo.currency}${total.toFixed(2)}`}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Final amount you'll be charged:{" "}
            <span className="font-bold text-foreground">
              {storeInfo.currency}
              {total.toFixed(2)}
            </span>
          </p>

          <p className="text-center text-[10px] text-muted-foreground">{storeInfo.paymentNote}</p>
        </div>
      </div>

      <SavedAddressDialog
        open={showAddSaved}
        onClose={() => setShowAddSaved(false)}
        zones={zones}
        onSave={async (input) => {
          const created = await addSavedAddress(input);
          if (created) {
            toast.success("Address saved");
            handlePickSaved(created);
            refreshAddresses();
          } else {
            toast.error("Failed to save address");
          }
        }}
      />
    </>
  );
};

export default CheckoutDialog;
