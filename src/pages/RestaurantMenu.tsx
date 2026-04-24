import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Clock, Plus, Minus, ShoppingCart, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { menuItems as staticMenuItems } from "@/data/menu";
import Cart from "@/components/Cart";
import CheckoutDialog from "@/components/CheckoutDialog";
import BottomNav from "@/components/BottomNav";
import { RestaurantName } from "@/components/RestaurantName";

interface Restaurant {
  id: string;
  name: string;
  description: string;
  logo: string;
  logo_url: string | null;
  banner_url: string | null;
  gallery_images: string[];
  rating: number;
  delivery_time: string;
  min_order: number;
  cuisine: string;
}

interface DbMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  is_available: boolean;
}

const foodImages: Record<string, string> = {
  'Kitchen': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=300&fit=crop',
  'KFC': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=300&fit=crop',
  'Debonnairs Pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=300&fit=crop',
  'McDonalds': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=300&fit=crop',
  'Pedros': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&h=300&fit=crop',
  'BURGER KING': 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=300&fit=crop',
  'Mdala Tshisanyama': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=300&fit=crop',
  'Fellos Fishery': 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&h=300&fit=crop',
};

const RestaurantMenu = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [foodNote, setFoodNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();
      
      if (!rest) { navigate("/"); return; }
      setRestaurant(rest as Restaurant);

      // Try DB menu items first, fall back to static data
      const { data: dbItems } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", id)
        .eq("is_available", true);

      if (dbItems && dbItems.length > 0) {
        setMenuItems(dbItems as DbMenuItem[]);
      } else {
        // Use static data filtered by restaurant name
        const staticItems = staticMenuItems
          .filter(i => i.available && i.price > 0 && i.category === rest.name)
          .map(i => ({
            id: i.id,
            name: i.name,
            description: i.caption,
            price: i.price,
            image: i.image || '',
            category: i.category,
            is_available: i.available,
          }));
        setMenuItems(staticItems);
      }
      setLoading(false);
    };
    if (id) fetchData();
  }, [id, navigate]);

  const categories = ["All", ...Array.from(new Set(menuItems.map(i => i.category)))];

  const filtered = menuItems.filter(item => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getItemQty = (itemId: string) => {
    const ci = cart.items.find(c => c.item.id === itemId);
    return ci?.quantity || 0;
  };

  const handleAddItem = (item: DbMenuItem) => {
    cart.addItem({
      id: item.id,
      name: item.name,
      category: restaurant?.name || item.category,
      caption: item.description,
      image: item.image,
      price: item.price,
      available: item.is_available,
    });
  };

  const handleCheckout = (note?: string) => {
    if (!user) { navigate("/auth"); return; }
    setFoodNote(note);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!restaurant) return null;

  const bannerImg = restaurant.banner_url || foodImages[restaurant.name] || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=300&fit=crop';

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="relative h-48 bg-muted">
        <img src={bannerImg} alt={restaurant.name} className="h-full w-full object-cover" />
        {/* Stronger bottom gradient so the orange name pops over photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 rounded-full bg-card p-2 shadow-card"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <RestaurantName as="h1" size="2xl" name={restaurant.name} />
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-white text-xs">
              <Star className="h-3 w-3 fill-primary text-primary" /> {restaurant.rating}
            </span>
            <span className="flex items-center gap-1 text-white/80 text-xs">
              <Clock className="h-3 w-3" /> {restaurant.delivery_time}
            </span>
            <span className="text-white/80 text-xs">Min R{restaurant.min_order}</span>
          </div>
        </div>
        {/* Cart button */}
        <button
          onClick={() => setCartOpen(true)}
          className="absolute top-4 right-4 relative rounded-full bg-primary p-2.5 shadow-orange"
        >
          <ShoppingCart className="h-5 w-5 text-primary-foreground" />
          {cart.totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] font-bold text-primary border border-border">
              {cart.totalItems}
            </span>
          )}
        </button>
      </div>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-nav md:pb-8">
        {/* Gallery */}
        {restaurant.gallery_images && restaurant.gallery_images.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Gallery</h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {restaurant.gallery_images.map((url, i) => (
                <div key={`${url}-${i}`} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={url}
                    alt={`${restaurant.name} ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <div className="text-4xl mb-3">😕</div>
            <p className="font-semibold">No items found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const qty = getItemQty(item.id);
              return (
                <div key={item.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop';
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl">🍽️</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground truncate">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-sm text-primary">R{item.price}</span>
                      {qty === 0 ? (
                        <button
                          onClick={() => handleAddItem(item)}
                          className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => cart.removeItem(item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary text-foreground"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold text-foreground">{qty}</span>
                          <button
                            onClick={() => handleAddItem(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating cart bar */}
      {cart.totalItems > 0 && (
        <div className="fixed bottom-16 left-4 right-4 z-40 md:bottom-4 mx-auto max-w-md">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-primary px-4 py-3 shadow-orange"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold text-primary-foreground">
              {cart.totalItems}
            </span>
            <span className="font-bold text-primary-foreground">View Cart</span>
            <span className="font-bold text-primary-foreground">R{cart.total.toFixed(2)}</span>
          </button>
        </div>
      )}

      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        total={cart.total}
        onAdd={(itemId) => {
          const item = menuItems.find(i => i.id === itemId);
          if (item) handleAddItem(item);
        }}
        onRemove={cart.removeItem}
        onClear={cart.clearCart}
        onCheckout={handleCheckout}
      />
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        initialFoodNote={foodNote}
        onOrderPlaced={cart.clearCart}
      />
      <BottomNav />
    </div>
  );
};

export default RestaurantMenu;
