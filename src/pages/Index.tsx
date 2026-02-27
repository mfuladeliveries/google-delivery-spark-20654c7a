import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Clock, ChevronRight, Flame, Utensils, Pizza, Coffee, Fish, ShoppingBasket, Beer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Cart from "@/components/Cart";
import CheckoutDialog from "@/components/CheckoutDialog";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { menuItems, storeInfo } from "@/data/menu";

interface Restaurant {
  id: string;
  name: string;
  description: string;
  logo: string;
  location: string;
  cuisine: string;
  rating: number;
  delivery_time: string;
  min_order: number;
  is_active: boolean;
}

const cuisineIcons: Record<string, any> = {
  'Traditional': Utensils,
  'Braai': Flame,
  'Fast Food': Flame,
  'Pizza': Pizza,
  'Chicken': Utensils,
  'Burgers': Utensils,
  'Seafood': Fish,
  'Groceries': ShoppingBasket,
  'Liquor': Beer
};

const cuisineCategories = [
{ label: "All", icon: Utensils },
{ label: "Fast Food", icon: Flame },
{ label: "Chicken", icon: Utensils },
{ label: "Burgers", icon: Utensils },
{ label: "Pizza", icon: Pizza },
{ label: "Traditional", icon: Utensils },
{ label: "Seafood", icon: Fish },
{ label: "Groceries", icon: ShoppingBasket }];


const restaurantImages: Record<string, string> = {
  'Kitchen': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop',
  'Mdala Tshisanyama': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=300&fit=crop',
  'KFC': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=300&fit=crop',
  'Debonnairs Pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=300&fit=crop',
  'McDonalds': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=300&fit=crop',
  'Pedros': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&h=300&fit=crop',
  'BURGER KING': 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&h=300&fit=crop',
  'Hungry Lion': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=300&fit=crop',
  'Fellos Fishery': 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&h=300&fit=crop',
  'Shop': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&h=300&fit=crop',
  'Liquor': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop',
  'Steers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=300&fit=crop'
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRestaurants = async () => {
      const { data } = await supabase.
      from("restaurants").
      select("*").
      eq("is_active", true).
      order("rating", { ascending: false });
      if (data) setRestaurants(data as Restaurant[]);
      setLoading(false);
    };
    fetchRestaurants();
  }, []);

  const filtered = restaurants.filter((r) => {
    const matchesCuisine = selectedCuisine === "All" || r.cuisine === selectedCuisine;
    const matchesSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase());
    return matchesCuisine && matchesSearch;
  });

  const featured = restaurants.filter((r) => r.rating >= 4.5).slice(0, 4);

  const handleCheckout = () => {
    if (!user) {navigate("/auth");return;}
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 pb-nav pt-4 md:pb-8">
        {/* Hero */}
        <div className="mb-6 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, hsl(21 100% 50%), hsl(35 100% 55%))' }}>
          <div className="px-6 py-8">
            <p className="text-primary-foreground/80 text-sm font-medium mb-1">
            </p>
            <h2 className="font-bold text-primary-foreground mb-1 font-[serif] text-center text-5xl">
              MFULA DELIVERIES
            </h2>
            <h2 className="text-2xl font-bold text-primary-foreground mb-5">What you would like to order?</h2>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search restaurants or cuisines..."
                className="w-full rounded-xl border-0 bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-card" />

            </div>
          </div>
          <div className="absolute right-4 bottom-0 text-6xl opacity-20">🍽️</div>
        </div>

        {/* Cuisine Categories */}
        <section className="mb-6">
          <h3 className="mb-3 text-base font-bold text-foreground">Cuisines</h3>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {cuisineCategories.map(({ label, icon: Icon }) =>
            <button
              key={label}
              onClick={() => setSelectedCuisine(label)}
              className={`flex flex-shrink-0 flex-col items-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-semibold transition-all ${
              selectedCuisine === label ?
              "bg-primary text-primary-foreground shadow-orange scale-105" :
              "bg-card text-muted-foreground hover:bg-secondary border border-border shadow-card"}`
              }>

                <Icon className="h-5 w-5" />
                {label}
              </button>
            )}
          </div>
        </section>

        {/* Featured */}
        {!search && selectedCuisine === "All" && featured.length > 0 &&
        <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground">⭐ Featured Restaurants</h3>
              <button className="flex items-center gap-1 text-xs font-medium text-primary">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {featured.map((r) =>
            <div
              key={r.id}
              onClick={() => navigate(`/restaurant/${r.id}`)}
              className="flex-shrink-0 w-56 rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow shadow-card">

                  <div className="relative h-32 bg-muted">
                    <img
                  src={restaurantImages[r.name] || `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop`}
                  alt={r.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop';}} />

                    <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {r.cuisine}
                    </span>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm text-foreground truncate">{r.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {r.delivery_time}
                      </span>
                    </div>
                  </div>
                </div>
            )}
            </div>
          </section>
        }

        {/* All Restaurants */}
        <section>
          <h3 className="mb-3 text-base font-bold text-foreground">
            {search ? `Results for "${search}"` : selectedCuisine !== "All" ? `${selectedCuisine} Restaurants` : "All Restaurants"}
          </h3>

          {loading ?
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) =>
            <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
                  <div className="h-40 bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
            )}
            </div> :
          filtered.length === 0 ?
          <div className="py-16 text-center text-muted-foreground">
              <div className="text-5xl mb-3">😕</div>
              <p className="font-semibold">No restaurants found</p>
            </div> :

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((r) =>
            <div
              key={r.id}
              onClick={() => navigate(`/restaurant/${r.id}`)}
              className="rounded-2xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 shadow-card">

                  <div className="relative h-40 bg-muted">
                    <img
                  src={restaurantImages[r.name] || `https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop`}
                  alt={r.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=300&fit=crop';}} />

                    <span className="absolute top-2 right-2 rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-foreground border border-border">
                      Min R{r.min_order}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">{r.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5 text-foreground font-medium">
                        <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" /> {r.delivery_time}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">{r.cuisine}</span>
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </section>
      </main>

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
        onCheckout={handleCheckout} />

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        onOrderPlaced={cart.clearCart} />

      <BottomNav />
    </div>);

};

export default Index;