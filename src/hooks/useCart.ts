import { useState, useCallback } from "react";
import { MenuItem, storeInfo } from "@/data/menu";
import { useDeliveryZone } from "@/hooks/useDeliveryZone";

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const { zone } = useDeliveryZone();

  const addItem = useCallback((item: MenuItem) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
        );
      }
      return prev.filter((ci) => ci.item.id !== itemId);
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  const tax = subtotal * storeInfo.tax;
  // Delivery fee is determined by the customer's zone. If unknown, fall back to
  // the lowest zone fee for display only — the server enforces the real fee.
  const deliveryFee = zone?.fee ?? 65;
  const delivery = items.length > 0 ? deliveryFee : 0;
  const total = subtotal + tax + delivery;
  const totalItems = items.reduce((sum, ci) => sum + ci.quantity, 0);

  return { items, addItem, removeItem, clearCart, subtotal, tax, delivery, total, totalItems, zone };
}

