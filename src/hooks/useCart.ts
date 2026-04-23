import { useState, useCallback } from "react";
import { MenuItem, storeInfo } from "@/data/menu";

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

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
  const delivery = items.length > 0 ? storeInfo.deliveryCharge : 0;
  const total = subtotal + tax + delivery;
  const totalItems = items.reduce((sum, ci) => sum + ci.quantity, 0);

  const sendWhatsApp = useCallback(() => {
    const lines = items.map(
      (ci) => `${ci.quantity}x ${ci.item.name} - R${ci.item.price * ci.quantity}`
    );
    const message = [
      `🛒 *New Order from Mfula Deliveries*`,
      ``,
      ...lines,
      ``,
      `Subtotal: R${subtotal.toFixed(2)}`,
      `Service Fee (5%): R${tax.toFixed(2)}`,
      `Delivery: R${delivery}`,
      `*Total: R${total.toFixed(2)}*`,
      ``,
      `💳 ${storeInfo.paymentNote}`,
    ].join("\n");

    window.open(
      `https://wa.me/${storeInfo.whatsapp}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }, [items, subtotal, tax, delivery, total]);

  return { items, addItem, removeItem, clearCart, subtotal, tax, delivery, total, totalItems, sendWhatsApp };
}
