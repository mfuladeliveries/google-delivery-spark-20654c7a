import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { MenuItem, SizeOption, AddOnOption, CutOption, storeInfo } from "@/data/menu";
import { useCustomerLocation } from "@/hooks/useCustomerLocation";
import { supabase } from "@/integrations/supabase/client";
import { calcZoneFee, distanceKm } from "@/lib/serviceArea";

/** General store that may always be combined with one restaurant's order. */
export const COMPANION_STORE = "Mfula Shop";

export function isCompanionStore(name?: string | null): boolean {
  return (name || "").trim().toLowerCase() === COMPANION_STORE.toLowerCase();
}

function itemRestaurant(item: MenuItem): string {
  return (item.restaurantName || "").trim();
}



export interface CartItem {
  /** Stable per-line key — same dish with different cut/size/sauces/pieces becomes a separate line. */
  lineKey: string;
  item: MenuItem;
  quantity: number;
  selectedCut?: CutOption;
  /** Number of pieces inside the chosen cut (e.g. 4 drumsticks). Defaults to 1. */
  selectedPieces?: number;
  selectedSize?: SizeOption;
  selectedAddOns?: AddOnOption[];
  /** Final per-unit price (cut*pieces OR size base + paid add-ons). */
  unitPrice: number;
}

export function buildLineKey(
  itemId: string,
  cut?: CutOption,
  size?: SizeOption,
  addOns?: AddOnOption[],
  pieces?: number,
): string {
  const cutPart = cut?.name ? `c:${cut.name}` : "c:-";
  const piecesPart = pieces && pieces > 1 ? `p:${pieces}` : "p:1";
  const sizePart = size?.name ? `s:${size.name}` : "s:-";
  const addPart =
    addOns && addOns.length
      ? `a:${[...addOns]
          .map((a) => a.name)
          .sort()
          .join("|")}`
      : "a:-";
  return `${itemId}::${cutPart}::${piecesPart}::${sizePart}::${addPart}`;
}

export function computeUnitPrice(
  item: MenuItem,
  cut?: CutOption,
  size?: SizeOption,
  addOns?: AddOnOption[],
  pieces?: number,
): number {
  // Base price priority: cut > size > item.price. When a cut has a piece-range,
  // the cut price is per-piece and multiplied by the chosen piece count.
  let base: number;
  if (cut) {
    const max = Number(cut.max_pieces ?? 1);
    const p = pieces && pieces > 0 ? pieces : 1;
    base = Number(cut.price) * (max > 1 ? p : 1);
  } else if (size) {
    base = Number(size.price);
  } else {
    base = Number(item.price);
  }
  const extras = (addOns || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
  return base + extras;
}

export const CART_STORAGE_KEY = "mfula-cart-v1";

export function clearPersistedCart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]));
  } catch {
    /* ignore storage failures */
  }
}

function loadPersistedCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCart() {
  // Lazy initializer rehydrates the cart from localStorage so the user's
  // selections survive minimize/relaunch and full app restarts.
  const [items, setItems] = useState<CartItem[]>(() => loadPersistedCart());
  const { zone, lat, lng } = useCustomerLocation();

  // Persist cart on every change. localStorage is synchronous but tiny here.
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [items]);

  // Look up the primary restaurant's coords so we can compute the dynamic
  // delivery fee = base + (km from restaurant × per-km), clamped by min/max.
  const primaryRestaurantName = useMemo(() => {
    const names = items
      .map((ci) => ci.item.restaurantName || ci.item.category)
      .filter(Boolean) as string[];
    // Prefer the actual restaurant over the companion store for fee pricing.
    return names.find((n) => !isCompanionStore(n)) || names[0] || "";

  }, [items]);

  const [restaurantCoords, setRestaurantCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  useEffect(() => {
    if (!primaryRestaurantName) {
      setRestaurantCoords(null);
      return;
    }
    let alive = true;
    import("@/lib/catalog").then(({ getCatalog }) => {
      getCatalog()
        .then((cat) => {
          if (!alive) return;
          const r = cat.restaurants.find(
            (x) => x.name === primaryRestaurantName && x.is_active,
          );
          if (r && typeof r.lat === "number" && typeof r.lng === "number") {
            setRestaurantCoords({ lat: r.lat, lng: r.lng });
          } else {
            setRestaurantCoords(null);
          }
        })
        .catch(() => {
          if (alive) setRestaurantCoords(null);
        });
    });
    return () => {
      alive = false;
    };
  }, [primaryRestaurantName]);


  /**
   * Add a fully-configured line. If an identical line exists, increment qty.
   * Business rule: a cart may hold items from ONE restaurant, plus items from
   * the Mfula Shop (a general store that always rides along with any order).
   * Returns false when the item was rejected.
   */
  const addItemWithOptions = useCallback(
    (
      item: MenuItem,
      cut?: CutOption,
      size?: SizeOption,
      addOns?: AddOnOption[],
      pieces?: number,
    ): boolean => {
      const incomingRestaurant = itemRestaurant(item);
      const blocker = items
        .map((ci) => itemRestaurant(ci.item))
        .find((name) => name && !isCompanionStore(name) && name !== incomingRestaurant);

      if (blocker && !isCompanionStore(incomingRestaurant)) {
        toast.error(`Your cart already has items from ${blocker}.`, {
          description: `You can only order from one restaurant at a time (plus ${COMPANION_STORE}). Clear your cart to order from ${incomingRestaurant || "this restaurant"}.`,
          duration: 6000,
        });
        return false;
      }

      const lineKey = buildLineKey(item.id, cut, size, addOns, pieces);
      const unitPrice = computeUnitPrice(item, cut, size, addOns, pieces);
      setItems((prev) => {
        const existing = prev.find((ci) => ci.lineKey === lineKey);
        if (existing) {
          return prev.map((ci) =>
            ci.lineKey === lineKey ? { ...ci, quantity: ci.quantity + 1 } : ci,
          );
        }
        return [
          ...prev,
          {
            lineKey,
            item,
            quantity: 1,
            selectedCut: cut,
            selectedPieces: pieces && pieces > 1 ? pieces : undefined,
            selectedSize: size,
            selectedAddOns: addOns,
            unitPrice,
          },
        ];
      });
      return true;
    },
    [items],
  );


  /** Quick-add for items with no options (back-compat). */
  const addItem = useCallback(
    (item: MenuItem): boolean =>
      addItemWithOptions(item, undefined, undefined, undefined, undefined),
    [addItemWithOptions],
  );

  /** Restaurant currently locked in by the cart (companion store excluded). */
  const activeRestaurantName = useMemo(
    () =>
      items
        .map((ci) => (ci.item.restaurantName || "").trim())
        .find((n) => n && !isCompanionStore(n)) || null,
    [items],
  );


  /** Increment quantity for an existing line by lineKey. */
  const incrementLine = useCallback((lineKey: string) => {
    setItems((prev) =>
      prev.map((ci) => (ci.lineKey === lineKey ? { ...ci, quantity: ci.quantity + 1 } : ci)),
    );
  }, []);

  /** Remove one unit from a specific line. Falls back to first line for legacy callers passing item.id. */
  const removeItem = useCallback((lineKeyOrItemId: string) => {
    setItems((prev) => {
      const target =
        prev.find((ci) => ci.lineKey === lineKeyOrItemId) ||
        prev.find((ci) => ci.item.id === lineKeyOrItemId);
      if (!target) return prev;
      if (target.quantity > 1) {
        return prev.map((ci) =>
          ci.lineKey === target.lineKey ? { ...ci, quantity: ci.quantity - 1 } : ci,
        );
      }
      return prev.filter((ci) => ci.lineKey !== target.lineKey);
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, ci) => sum + ci.unitPrice * ci.quantity, 0);
  const tax = subtotal * storeInfo.tax;

  // Dynamic per-zone fee: base + per-km × distance(restaurant, customer), clamped.
  // Falls back to zone-centre distance when restaurant coords aren't loaded yet.
  let deliveryFee = 65;
  if (zone) {
    const pricingDistance =
      restaurantCoords && lat != null && lng != null
        ? distanceKm(restaurantCoords.lat, restaurantCoords.lng, lat, lng)
        : zone.pricing_distance_km;
    deliveryFee = calcZoneFee(zone.zone, pricingDistance);
  }
  const delivery = items.length > 0 ? deliveryFee : 0;
  const total = subtotal + tax + delivery;
  const totalItems = items.reduce((sum, ci) => sum + ci.quantity, 0);

  return {
    items,
    addItem,
    addItemWithOptions,
    incrementLine,
    removeItem,
    clearCart,
    subtotal,
    tax,
    delivery,
    total,
    totalItems,
    activeRestaurantName,
    zoneName: zone?.zone.name ?? null,

  };
}
