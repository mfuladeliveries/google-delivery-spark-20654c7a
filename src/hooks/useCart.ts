import { useState, useCallback, useEffect } from "react";
import { MenuItem, SizeOption, AddOnOption, CutOption, storeInfo } from "@/data/menu";
import { useCustomerLocation } from "@/hooks/useCustomerLocation";

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
  pieces?: number
): string {
  const cutPart = cut?.name ? `c:${cut.name}` : "c:-";
  const piecesPart = pieces && pieces > 1 ? `p:${pieces}` : "p:1";
  const sizePart = size?.name ? `s:${size.name}` : "s:-";
  const addPart = addOns && addOns.length
    ? `a:${[...addOns].map(a => a.name).sort().join("|")}`
    : "a:-";
  return `${itemId}::${cutPart}::${piecesPart}::${sizePart}::${addPart}`;
}

export function computeUnitPrice(
  item: MenuItem,
  cut?: CutOption,
  size?: SizeOption,
  addOns?: AddOnOption[],
  pieces?: number
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

const CART_STORAGE_KEY = "mfula-cart-v1";

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
  const { service } = useCustomerLocation();

  // Persist cart on every change. localStorage is synchronous but tiny here.
  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [items]);

  /** Add a fully-configured line. If an identical line exists, increment qty. */
  const addItemWithOptions = useCallback(
    (
      item: MenuItem,
      cut?: CutOption,
      size?: SizeOption,
      addOns?: AddOnOption[],
      pieces?: number
    ) => {
      const lineKey = buildLineKey(item.id, cut, size, addOns, pieces);
      const unitPrice = computeUnitPrice(item, cut, size, addOns, pieces);
      setItems(prev => {
        const existing = prev.find(ci => ci.lineKey === lineKey);
        if (existing) {
          return prev.map(ci =>
            ci.lineKey === lineKey ? { ...ci, quantity: ci.quantity + 1 } : ci
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
    },
    []
  );

  /** Quick-add for items with no options (back-compat). */
  const addItem = useCallback(
    (item: MenuItem) => {
      addItemWithOptions(item, undefined, undefined, undefined, undefined);
    },
    [addItemWithOptions]
  );

  /** Increment quantity for an existing line by lineKey. */
  const incrementLine = useCallback((lineKey: string) => {
    setItems(prev =>
      prev.map(ci => (ci.lineKey === lineKey ? { ...ci, quantity: ci.quantity + 1 } : ci))
    );
  }, []);

  /** Remove one unit from a specific line. Falls back to first line for legacy callers passing item.id. */
  const removeItem = useCallback((lineKeyOrItemId: string) => {
    setItems(prev => {
      const target =
        prev.find(ci => ci.lineKey === lineKeyOrItemId) ||
        prev.find(ci => ci.item.id === lineKeyOrItemId);
      if (!target) return prev;
      if (target.quantity > 1) {
        return prev.map(ci =>
          ci.lineKey === target.lineKey ? { ...ci, quantity: ci.quantity - 1 } : ci
        );
      }
      return prev.filter(ci => ci.lineKey !== target.lineKey);
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, ci) => sum + ci.unitPrice * ci.quantity, 0);
  const tax = subtotal * storeInfo.tax;
  const deliveryFee = service?.fee ?? 65;
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
  };
}
