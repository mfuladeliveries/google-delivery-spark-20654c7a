import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import HeroBanner from "@/components/HeroBanner";
import CategoryNav from "@/components/CategoryNav";
import MenuCard from "@/components/MenuCard";
import Cart from "@/components/Cart";
import CheckoutDialog from "@/components/CheckoutDialog";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { menuItems } from "@/data/menu";
import { Search } from "lucide-react";

const Index = () => {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let items = menuItems.filter((i) => i.available && i.price > 0);
    if (category !== "All") {
      items = items.filter((i) => i.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.caption.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [category, search]);

  const handleCheckout = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />
      <HeroBanner />
      <CategoryNav selected={category} onSelect={setCategory} />

      {/* Search */}
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Menu Grid */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <span className="text-4xl">😕</span>
            <p className="mt-3 font-display font-medium">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={cart.addItem} />
            ))}
          </div>
        )}
      </main>

      {/* Cart */}
      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        total={cart.total}
        onAdd={(id) => {
          const item = menuItems.find((i) => i.id === id);
          if (item) cart.addItem(item);
        }}
        onRemove={cart.removeItem}
        onClear={cart.clearCart}
        onCheckout={handleCheckout}
      />

      {/* Checkout */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        onOrderPlaced={cart.clearCart}
      />
    </div>
  );
};

export default Index;
