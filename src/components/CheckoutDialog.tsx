import { useState, useEffect } from "react";
import { X, MessageCircle, MapPin, Phone, User, StickyNote } from "lucide-react";
import { CartItem } from "@/hooks/useCart";
import { storeInfo } from "@/data/menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const actualTip = customTip ? parseFloat(customTip) || 0 : tip;
  const total = subtotal + tax + delivery + actualTip;

  // Get unique restaurants from cart
  const restaurants = [...new Set(items.map((ci) => ci.item.category))];

  // Load saved profile
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
    if (!user || !name.trim() || !contact.trim() || !address.trim()) return;
    setLoading(true);

    // Save profile info
    await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        contact_number: contact.trim(),
        address: address.trim(),
      })
      .eq("user_id", user.id);

    // Generate 4-digit delivery verification code
    const deliveryCode = String(Math.floor(1000 + Math.random() * 9000));

    // Save order
    const orderItems = items.map((ci) => ({
      id: ci.item.id,
      name: ci.item.name,
      category: ci.item.category,
      price: ci.item.price,
      quantity: ci.quantity,
    }));

    const { data: order } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        items: orderItems,
        restaurant: restaurants.join(", "),
        subtotal,
        tax,
        delivery_fee: delivery,
        tip: actualTip,
        total,
        special_notes: notes.trim(),
        customer_name: name.trim(),
        customer_contact: contact.trim(),
        customer_address: address.trim(),
        delivery_code: deliveryCode,
      })
      .select("order_number")
      .single();

    // Send WhatsApp
    const orderNum = order?.order_number || "N/A";
    const lines = items.map(
      (ci) => `${ci.quantity}x ${ci.item.name} (${ci.item.category}) - R${ci.item.price * ci.quantity}`
    );
    const message = [
      `🛒 *New Order from ${storeInfo.name}*`,
      `📋 Order #${orderNum}`,
      `📅 ${new Date().toLocaleString("en-ZA")}`,
      ``,
      `👤 *Customer:* ${name}`,
      `📞 *Contact:* ${contact}`,
      `📍 *Address:* ${address}`,
      ``,
      `🍽️ *Restaurant(s):* ${restaurants.join(", ")}`,
      ``,
      ...lines,
      ``,
      `Subtotal: R${subtotal.toFixed(2)}`,
      `Tax (5%): R${tax.toFixed(2)}`,
      `Delivery: R${delivery}`,
      actualTip > 0 ? `Tip: R${actualTip.toFixed(2)}` : null,
      `*Total: R${total.toFixed(2)}*`,
      notes.trim() ? `\n📝 *Special Notes:* ${notes}` : null,
      ``,
      `💳 ${storeInfo.paymentNote}`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${storeInfo.whatsapp}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    setLoading(false);
    onOrderPlaced();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-[60] mx-auto max-w-lg -translate-y-1/2 rounded-2xl border border-border bg-background p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold text-foreground">Checkout</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer Details */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <User className="h-3.5 w-3.5 text-primary" /> Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Phone className="h-3.5 w-3.5 text-primary" /> Contact Number
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. 072 123 4567"
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
            </label>
            <div className="flex gap-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, area"
                className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <StickyNote className="h-3.5 w-3.5 text-primary" /> Special Notes / Instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests? e.g. extra sauce, no onions..."
              rows={2}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Tip */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">🙏 Add a Tip</label>
            <div className="flex flex-wrap gap-2">
              {tipOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTip(t); setCustomTip(""); }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    tip === t && !customTip
                      ? "bg-primary text-primary-foreground"
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
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1 rounded-xl border border-border bg-card p-4 text-sm">
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
            <p className="text-xs text-muted-foreground">
              🍽️ From: {restaurants.join(", ")}
            </p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || !name.trim() || !contact.trim() || !address.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(142,70%,45%)] py-3 font-display font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            <MessageCircle className="h-5 w-5" />
            {loading ? "Placing Order..." : "Place Order via WhatsApp"}
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
