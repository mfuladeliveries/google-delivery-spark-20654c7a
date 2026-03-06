import { useState, useEffect } from "react";
import { X, Package, MapPin, Phone, User, StickyNote, Banknote, CreditCard } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { toast } from "sonner";


const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  contact: z.string().trim().min(7, "Contact number is too short").max(20, "Contact number is too long").regex(/^[0-9\s+()-]+$/, "Invalid phone number format"),
  address: z.string().trim().min(5, "Address must be at least 5 characters").max(300, "Address must be less than 300 characters"),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
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
}

const tipOptions = [0, 5, 10, 15, 20, 30];

const CheckoutDialog = ({
  open,
  onClose,
  items,
  subtotal,
  tax,
  delivery,
  onOrderPlaced,
}: CheckoutDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const actualTip = customTip ? parseFloat(customTip) || 0 : tip;
  const total = subtotal + tax + delivery + actualTip;

  const restaurants = [...new Set(items.map((ci) => ci.item.category))];

  useEffect(() => {
    if (!user || profileLoaded) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, contact_number, address")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setName(data.full_name || "");
        setContact(data.contact_number || "");
        setAddress(data.address || "");
      }
      setProfileLoaded(true);
    };
    loadProfile();
  }, [user, profileLoaded]);

  const handleCheckout = async () => {
    if (!user) return;

    const result = checkoutSchema.safeParse({
      name, contact, address, notes, tip: actualTip,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setLoading(true);

    await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        contact_number: contact.trim(),
        address: address.trim(),
      })
      .eq("user_id", user.id);

    const deliveryCode = String(Math.floor(1000 + Math.random() * 9000));

    const orderItems = items.map((ci) => ({
      id: ci.item.id,
      quantity: ci.quantity,
    }));

    const { data: order, error: orderError } = await supabase.rpc("create_verified_order", {
      p_items: orderItems,
      p_restaurant_name: restaurants[0] || "",
      p_customer_name: name.trim(),
      p_customer_contact: contact.trim(),
      p_customer_address: address.trim(),
      p_special_notes: notes.trim(),
      p_tip: actualTip,
      p_delivery_code: deliveryCode,
      p_payment_method: paymentMethod,
    });

    if (orderError) {
      toast.error("Failed to place order. Please try again.");
      setLoading(false);
      return;
    }

    const orderResult = order as Record<string, unknown> | null;
    const orderNum = orderResult?.order_number || "N/A";

    toast.success(`🎉 Order #${orderNum} placed!`, {
      description: `Your delivery code is ${deliveryCode}. We'll notify you as your order progresses.`,
      duration: 6000,
    });
    setLoading(false);
    onOrderPlaced();
    onClose();
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
            <div className="flex gap-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, area"
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!navigator.geolocation) return;
                  setLocating(true);
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                        const data = await res.json();
                        if (data.display_name) setAddress(data.display_name);
                      } catch { /* ignore */ }
                      setLocating(false);
                    },
                    () => setLocating(false),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                disabled={locating}
                className="flex items-center justify-center rounded-xl border border-border bg-card px-3 text-primary hover:bg-secondary transition-colors disabled:opacity-50"
                title="Use my location"
              >
                {locating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            </div>
            {validationErrors.address && <p className="mt-1 text-xs text-destructive">{validationErrors.address}</p>}
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <StickyNote className="h-3.5 w-3.5 text-primary" /> Special Notes
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

          {/* Payment Method */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">💳 Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center gap-2.5 rounded-xl border-2 p-3.5 text-sm font-semibold transition-all ${
                  paymentMethod === "cash"
                    ? "border-primary bg-primary/5 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  paymentMethod === "cash" ? "bg-primary/10" : "bg-secondary"
                }`}>
                  <Banknote className={`h-4.5 w-4.5 ${paymentMethod === "cash" ? "text-primary" : ""}`} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs">Cash</p>
                  <p className="text-[10px] text-muted-foreground">Pay on delivery</p>
                </div>
              </button>
              <button
                onClick={() => setPaymentMethod("online")}
                className={`flex items-center gap-2.5 rounded-xl border-2 p-3.5 text-sm font-semibold transition-all ${
                  paymentMethod === "online"
                    ? "border-primary bg-primary/5 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  paymentMethod === "online" ? "bg-primary/10" : "bg-secondary"
                }`}>
                  <CreditCard className={`h-4.5 w-4.5 ${paymentMethod === "online" ? "text-primary" : ""}`} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-xs">Online</p>
                  <p className="text-[10px] text-muted-foreground">Pay now</p>
                </div>
              </button>
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
              <span>Tax (5%)</span>
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
            <div className="flex justify-between border-t border-border pt-2 text-lg font-bold text-foreground">
              <span>Total</span>
              <span className="text-primary">{storeInfo.currency}{total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">🍽️ {restaurants.join(", ")}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                paymentMethod === "cash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>
                {paymentMethod === "cash" ? "💵 Cash" : "💳 Online"}
              </span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || !name.trim() || !contact.trim() || !address.trim()}
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
