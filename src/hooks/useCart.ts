import { useState, useCallback } from "react";
import { MenuItem, SizeOption, AddOnOption, storeInfo } from "@/data/menu";
import { useDeliveryZone } from "@/hooks/useDeliveryZone";

export interface CartItem {
  /** Stable per-line key — same dish with different size/sauces becomes a separate line. */
  lineKey: string;
  item: MenuItem;
  quantity: number;
  selectedSize?: SizeOption;
  selectedAddOns?: AddOnOption[];
  /** Final per-unit price (base/size price + paid add-ons). */
  unitPrice: number;
}

export function buildLineKey(
  itemId: string,
  size?: SizeOption,
  addOns?: AddOnOption[]
): string {
  const sizePart = size?.name ? `s:${size.name}` : "s:-";
  const addPart = addOns && addOns.length
    ? `a:${[...addOns].map(a => a.name).sort().join("|")}`
    : "a:-";
  return `${itemId}::${sizePart}::${addPart}`;
}

export function computeUnitPrice(
  item: MenuItem,
  size?: SizeOption,
  addOns?: AddOnOption[]
): number {
  const base = size ? Number(size.price) : Number(item.price);
  const extras = (addOns || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
  return base + extras;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const { zone } = useDeliveryZone();

  /** Add a fully-configured line. If an identical line exists, increment qty. */
  const addItemWithOptions = useCallback(
    (item: MenuItem, size?: SizeOption, addOns?: AddOnOption[]) => {
      const lineKey = buildLineKey(item.id, size, addOns);
      const unitPrice = computeUnitPrice(item, size, addOns);
      setItems(prev => {
        const existing = prev.find(ci => ci.lineKey === lineKey);
        if (existing) {
          return prev.map(ci =>
            ci.lineKey === lineKey ? { ...ci, quantity: ci.quantity + 1 } : ci
          );
        }
        return [
          ...prev,
          { lineKey, item, quantity: 1, selectedSize: size, selectedAddOns: addOns, unitPrice },
        ];
      });
    },
    []
  );

  /** Quick-add for items with no options (back-compat). */
  const addItem = useCallback(
    (item: MenuItem) => {
      addItemWithOptions(item, undefined, undefined);
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
  const deliveryFee = zone?.fee ?? 65;
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
    zone,
  };
}
