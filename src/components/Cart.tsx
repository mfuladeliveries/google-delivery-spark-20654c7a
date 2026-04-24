import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Plus, Minus, Package, Trash2, StickyNote, AlertTriangle, Truck } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";
import { useDeliveryZone } from "@/hooks/useDeliveryZone";
import { useAuth } from "@/hooks/useAuth";
import { ALL_DELIVERY_AREAS } from "@/lib/zones";
import { RestaurantName } from "@/components/RestaurantName";

interface CartProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
  onAdd: (lineKey: string) => void;
  onRemove: (lineKey: string) => void;
  onClear: () => void;
  onCheckout: (foodNote?: string) => void;
}

const Cart = ({
  open,
  onClose,
  items,
  subtotal,
  tax,
  delivery,
  total,
  onAdd,
  onRemove,
  onClear,
  onCheckout,
}: CartProps) => {
  const [foodNote, setFoodNote] = useState("");
  const { user } = useAuth();
  const { zone, outsideZone, needsAddress } = useDeliveryZone();
  const canCheckout = !!user && !!zone && !outsideZone && !needsAddress;
  // Cart items carry the restaurant name in `item.category` (set in RestaurantMenu)
  const restaurantName = items[0]?.item.category || "";
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-0 z-[60] flex w-full max-w-md flex-col border-l border-border bg-background">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Your Order</h2>
            <div className="flex gap-2">
              {items.length > 0 && (
                <button
                  onClick={onClear}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {restaurantName && (
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">
              Ordering from:{" "}
              <RestaurantName as="span" size="sm" name={restaurantName} className="!text-[14px]" />
            </p>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <span className="text-4xl">🛒</span>
              <p className="mt-3 font-display font-medium">Your cart is empty</p>
              <p className="text-sm">Add some delicious items!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((ci) => {
                const cutLabel = ci.selectedCut?.name;
                const sizeLabel = ci.selectedSize?.name;
                const addOnLabels = (ci.selectedAddOns || []).map(a => a.name);
                const titleSuffix = [cutLabel, sizeLabel].filter(Boolean).join(" · ");
                return (
                  <div
                    key={ci.lineKey}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    {ci.item.image && (
                      <img
                        src={ci.item.image}
                        alt={ci.item.name}
                        className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate text-sm font-semibold text-card-foreground">
                        {ci.item.name}
                        {titleSuffix ? ` — ${titleSuffix}` : ""}
                      </h4>
                      {addOnLabels.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {addOnLabels.map((label, i) => (
                            <span
                              key={`${ci.lineKey}-${i}`}
                              className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-sm font-bold text-primary">
                        {storeInfo.currency}{(ci.unitPrice * ci.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onRemove(ci.lineKey)}
                        aria-label="Decrease quantity"
                        className="rounded-lg bg-secondary p-1.5 text-secondary-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">
                        {ci.quantity}
                      </span>
                      <button
                        onClick={() => onAdd(ci.lineKey)}
                        aria-label="Increase quantity"
                        className="rounded-lg bg-primary p-1.5 text-primary-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{storeInfo.currency}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Service Fee (5%)</span>
                <span>{storeInfo.currency}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Delivery {zone ? `(${zone.name})` : ""}
                </span>
                <span>{storeInfo.currency}{delivery}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary">{storeInfo.currency}{total.toFixed(2)}</span>
              </div>
            </div>

            {subtotal < storeInfo.minimumOrder && (
              <p className="mt-2 text-xs text-destructive">
                Minimum order is {storeInfo.currency}{storeInfo.minimumOrder}
              </p>
            )}

            {/* Zone gating messages */}
            {!user && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                <Link to="/auth" className="font-bold text-primary hover:underline">Sign in</Link> to confirm your delivery zone & place this order.
              </div>
            )}
            {user && needsAddress && (
              <div className="mt-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3 text-xs text-foreground">
                <p className="font-bold">Add your delivery address first</p>
                <Link to="/profile" className="text-primary hover:underline">Update profile →</Link>
              </div>
            )}
            {user && outsideZone && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div>
                  <p className="font-bold">Outside our delivery area</p>
                  <p className="mt-0.5 text-muted-foreground">We deliver to: {ALL_DELIVERY_AREAS}.</p>
                  <Link to="/profile" className="mt-1 inline-block font-bold text-primary hover:underline">Update address →</Link>
                </div>
              </div>
            )}

            {/* Special note for food */}
            <div className="mt-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <StickyNote className="h-3.5 w-3.5 text-primary" /> Special note for your food
              </label>
              <textarea
                value={foodNote}
                onChange={(e) => setFoodNote(e.target.value)}
                placeholder="e.g. extra sauce, no onions, well done..."
                rows={2}
                maxLength={300}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
              />
            </div>

            <button
              onClick={() => onCheckout(foodNote.trim() || undefined)}
              disabled={subtotal < storeInfo.minimumOrder || (!!user && !canCheckout)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shadow-orange"
            >
              <Package className="h-5 w-5" />
              Place Order
            </button>

            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              {storeInfo.paymentNote}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default Cart;
