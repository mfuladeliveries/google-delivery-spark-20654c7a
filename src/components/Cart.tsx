import { X, Plus, Minus, Package, Trash2 } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";

interface CartProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  tax: number;
  delivery: number;
  total: number;
  onAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
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
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
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
              {items.map((ci) => (
                <div
                  key={ci.item.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  {ci.item.image && (
                    <img
                      src={ci.item.image}
                      alt={ci.item.name}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="truncate text-sm font-semibold text-card-foreground">
                      {ci.item.name}
                    </h4>
                    <p className="text-sm font-bold text-primary">
                      {storeInfo.currency}{ci.item.price * ci.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onRemove(ci.item.id)}
                      className="rounded-lg bg-secondary p-1.5 text-secondary-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {ci.quantity}
                    </span>
                    <button
                      onClick={() => onAdd(ci.item.id)}
                      className="rounded-lg bg-primary p-1.5 text-primary-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
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
                <span>Tax (5%)</span>
                <span>{storeInfo.currency}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
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

            <button
              onClick={onCheckout}
              disabled={subtotal < storeInfo.minimumOrder}
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
