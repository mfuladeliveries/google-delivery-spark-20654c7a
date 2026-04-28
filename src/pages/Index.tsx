import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Flame, Utensils, Pizza, Fish, ShoppingBasket, Trophy, UtensilsCrossed, MapPin, MapPinOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import Cart from "@/components/Cart";
import CheckoutDialog from "@/components/CheckoutDialog";
import RestaurantCard, { RestaurantCardSkeleton, type RestaurantCardData } from "@/components/RestaurantCard";
import { useGeoLocation, DELIVERY_RADIUS_KM } from "@/hooks/useGeoLocation";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { menuItems } from "@/data/menu";
import mfulaLogo from "@/assets/mfula-logo.png";

interface Restaurant extends RestaurantCardData {
  is_active: boolean;
}

const cuisineCategories = [
  { label: "All", icon: Utensils },
  { label: "Fast Food", icon: Flame },
  { label: "Chicken", icon: Utensils },
  { label: "Burgers", icon: Utensils },
  { label: "Pizza", icon: Pizza },
  { label: "Traditional", icon: Utensils },
  { label: "Seafood", icon: Fish },
  { label: "Groceries", icon: ShoppingBasket },
];

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
  const geo = useGeoLocation();

  // Auth/role gating + redirect to the right dashboard is handled by
  // <RoleGuard allow={["customer"]}> in App.tsx. This page only renders
  // once the viewer is confirmed to be a guest or a customer.

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

  // Annotate every restaurant with distance + nearby flag (live GPS).
  // Restaurants without coords are treated as out of range.
  const annotated = useMemo(() => {
    return restaurants.map((r) => {
      const d = geo.distanceTo(r.lat ?? null, r.lng ?? null);
      const nearby = d != null && d <= DELIVERY_RADIUS_KM;
      return { ...r, _distance: d, _nearby: nearby };
    });
  }, [restaurants, geo.lat, geo.lng]);

  const filtered = annotated.filter((r) => {
    const matchesCuisine = selectedCuisine === "All" || r.cuisine === selectedCuisine;
    const matchesSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase());
    return matchesCuisine && matchesSearch;
  });

  // Sort: nearby first, then by distance asc, then by rating desc as tiebreaker.
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (a._nearby !== b._nearby) return a._nearby ? -1 : 1;
      const da = a._distance ?? Number.POSITIVE_INFINITY;
      const db = b._distance ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
    return arr;
  }, [filtered]);

  // Featured = closest open nearby restaurant (or highest-rated if no GPS).
  const featuredOne = sorted[0];
  const topRated = sorted.filter((r) => r.rating >= 4.5 && r.id !== featuredOne?.id).slice(0, 6);

  const [foodNote, setFoodNote] = useState<string | undefined>(undefined);
  const handleCheckout = (note?: string) => {
    if (!user) {navigate("/auth");return;}
    setFoodNote(note);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  // While auth is resolving, or if a provider-only user briefly lands here,
  // show a consistent loading screen so the customer UI never flashes
  // before the redirect to the right dashboard completes.
  // Loading screen is now rendered by <RoleGuard> in App.tsx.

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartCount={cart.totalItems} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 pb-nav pt-4 md:pb-8">
        {/* Hero */}
        <div className="mb-6 rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, hsl(21 100% 50%), hsl(35 100% 55%))' }}>
          <div className="px-6 py-8 relative">
            <p className="text-primary-foreground/80 text-sm font-medium mb-1">
            </p>
            <div className="relative flex items-center justify-center mb-1">
              <img
                src={mfulaLogo}
                alt=""
                aria-hidden="true"
                width={512}
                height={512}
                className="absolute h-40 w-40 sm:h-48 sm:w-48 opacity-20 pointer-events-none select-none"
              />
              <h2 className="relative font-bold text-primary-foreground font-[serif] text-center text-5xl drop-shadow-lg">
                MFULA DELIVERIES
              </h2>
            </div>
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

        {/* Location banner */}
        {geo.ready && (geo.status === "denied" || geo.status === "unsupported") && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4">
            <MapPinOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Location is off</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Please enable location services to see restaurants available near you. Ordering is disabled until location is enabled.
              </p>
              <button
                onClick={() => geo.refresh()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-orange"
              >
                <MapPin className="h-3.5 w-3.5" /> Enable location
              </button>
            </div>
          </div>
        )}
        {geo.ready && geo.status === "fallback" && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div className="flex-1 text-xs text-foreground">
              <span className="font-bold">Using your saved address.</span>{" "}
              <button onClick={() => geo.refresh()} className="font-bold text-primary hover:underline">
                Use live location
              </button>{" "}
              for more accurate nearby restaurants.
            </div>
          </div>
        )}

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

        {/* Featured Today (large card) */}
        {!search && selectedCuisine === "All" && featuredOne && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">⭐ Featured Today</h3>
            </div>
            <RestaurantCard
              restaurant={featuredOne}
              variant="featured"
              distanceKm={featuredOne._distance ?? null}
              nearby={featuredOne._nearby}
            />
          </section>
        )}

        {/* All Restaurants */}
        <section className="mb-6">
          <h3 className="mb-3 text-base font-bold text-foreground">
            {search
              ? `Results for "${search}"`
              : selectedCuisine !== "All"
                ? `${selectedCuisine} Restaurants`
                : geo.hasCoords
                  ? "📍 Restaurants near you"
                  : "🍽️ All Restaurants"}
          </h3>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <RestaurantCardSkeleton key={i} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card py-16 text-center shadow-card">
              <UtensilsCrossed className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No restaurants found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or check back later
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCuisine("All");
                }}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-orange transition-transform hover:scale-105"
              >
                Browse All Restaurants
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  variant="standard"
                  distanceKm={r._distance ?? null}
                  nearby={r._nearby}
                />
              ))}
            </div>
          )}
        </section>

        {/* Top Rated horizontal scroll */}
        {!search && selectedCuisine === "All" && topRated.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-base font-bold text-foreground">
                <Trophy className="h-4 w-4 text-primary" /> Top Rated in Mfuleni
              </h3>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                See all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {topRated.map((r) => (
                <div key={r.id} className="w-72 flex-shrink-0">
                  <RestaurantCard
                    restaurant={r}
                    variant="standard"
                    distanceKm={r._distance ?? null}
                    nearby={r._nearby}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        tax={cart.tax}
        delivery={cart.delivery}
        total={cart.total}
        onAdd={(lineKey) => cart.incrementLine(lineKey)}
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
        initialFoodNote={foodNote}
        onOrderPlaced={cart.clearCart} />

      <Footer />
      <BottomNav />
    </div>);

};

export default Index;