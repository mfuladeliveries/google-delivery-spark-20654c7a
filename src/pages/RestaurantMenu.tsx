import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Star,
  Clock,
  Plus,
  Minus,
  ShoppingCart,
  Search,
  ChevronRight,
  MapPinOff,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, COMPANION_STORE, isCompanionStore } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import {
  useGeoLocation,
  DELIVERY_RADIUS_KM,
  DELIVERY_RADIUS_LABEL_KM,
} from "@/hooks/useGeoLocation";
import { menuItems as staticMenuItems, SizeOption, AddOnOption, CutOption } from "@/data/menu";
import Cart from "@/components/Cart";
import CheckoutDialog from "@/components/CheckoutDialog";
import BottomNav from "@/components/BottomNav";
import ProductCustomizeModal from "@/components/ProductCustomizeModal";
import { RestaurantName } from "@/components/RestaurantName";
import { popReorder } from "@/lib/reorder";
import { toast } from "sonner";

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
  lat: number | null;
  lng: number | null;
}

interface DbMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  is_available: boolean;
  has_sizes?: boolean;
  sizes?: SizeOption[];
  has_add_ons?: boolean;
  add_ons?: AddOnOption[];
  has_cuts?: boolean;
  cuts?: CutOption[];
}

const foodImages: Record<string, string> = {
  Kitchen: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=300&fit=crop",
  KFC: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=300&fit=crop",
  "Debonnairs Pizza":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=300&fit=crop",
  McDonalds: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=300&fit=crop",
  Pedros: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&h=300&fit=crop",
  "BURGER KING":
    "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=300&fit=crop",
  "Mdala Tshisanyama":
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=300&fit=crop",
  "Fellos Fishery":
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&h=300&fit=crop",
};

const RestaurantMenu = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const geo = useGeoLocation();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [foodNote, setFoodNote] = useState<string | undefined>(undefined);

  // Distance gating: customer must be within DELIVERY_RADIUS_KM of this
  // restaurant's saved coordinates. Restaurants with no coords are blocked.
  const distance = restaurant ? geo.distanceTo(restaurant.lat, restaurant.lng) : null;
  const restaurantHasCoords = !!restaurant && restaurant.lat != null && restaurant.lng != null;
  const locationBlocked = !geo.ready || !geo.hasCoords;
  const outOfRange =
    !locationBlocked &&
    (!restaurantHasCoords || (distance != null && distance > DELIVERY_RADIUS_KM));

  // Driver-coverage check for the customer's current coords.
  // null = unknown/loading; otherwise tells us whether any online driver covers this area.
  const [coverage, setCoverage] = useState<{
    covered: boolean;
    online_in_area: number;
    address_tag: string | null;
  } | null>(null);
  useEffect(() => {
    if (locationBlocked || outOfRange || geo.lat == null || geo.lng == null) {
      setCoverage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("check_area_coverage", {
        p_lat: geo.lat as number,
        p_lng: geo.lng as number,
      });
      if (!cancelled && data) setCoverage(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [geo.lat, geo.lng, locationBlocked, outOfRange]);

  const noDrivers = !!coverage && !coverage.covered;
  const canOrder = !locationBlocked && !outOfRange && !noDrivers;

  useEffect(() => {
    const fetchData = async () => {
      const { data: rest } = await supabase.from("restaurants").select("*").eq("id", id).single();

      if (!rest) {
        navigate("/");
        return;
      }
      setRestaurant(rest as Restaurant);

      // Try DB menu items first, fall back to static data
      const { data: dbItems } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", id)
        .eq("is_available", true);

      if (dbItems && dbItems.length > 0) {
        const normalized: DbMenuItem[] = dbItems.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description ?? "",
          price: Number(row.price ?? 0),
          image: row.image_url || row.image || "",
          category: row.category ?? "",
          is_available: !!row.is_available,
          has_sizes: !!row.has_sizes,
          sizes: Array.isArray(row.sizes) ? (row.sizes as SizeOption[]) : [],
          has_add_ons: !!row.has_add_ons,
          add_ons: Array.isArray(row.add_ons) ? (row.add_ons as AddOnOption[]) : [],
          has_cuts: !!row.has_cuts,
          cuts: Array.isArray(row.cuts) ? (row.cuts as CutOption[]) : [],
        }));
        setMenuItems(normalized);
      } else {
        // Use static data filtered by restaurant name
        const staticItems: DbMenuItem[] = staticMenuItems
          .filter((i) => i.available && i.price > 0 && i.category === rest.name)
          .map((i) => ({
            id: i.id,
            name: i.name,
            description: i.caption,
            price: i.price,
            image: i.image || "",
            category: i.category,
            is_available: i.available,
          }));
        setMenuItems(staticItems);
      }
      setLoading(false);
    };
    if (id) fetchData();
  }, [id, navigate]);

  // One-tap reorder: if a handoff was stashed from the Orders page,
  // pre-fill the cart once this restaurant's menu has loaded. Items not
  // currently available are silently skipped (and reported via toast).
  useEffect(() => {
    if (!id || loading || menuItems.length === 0) return;
    const seeds = popReorder(id);
    if (!seeds || seeds.length === 0) return;

    let added = 0;
    let skipped = 0;
    seeds.forEach(({ id: seedId, quantity }) => {
      const match = menuItems.find((m) => m.id === seedId);
      if (!match) {
        skipped += 1;
        return;
      }
      const qty = Math.max(1, Math.min(20, Math.floor(quantity || 1)));
      // Only auto-add items without required customisation.
      // Items with cuts/sizes/add-ons need a fresh selection.
      if (
        (match.has_cuts && (match.cuts?.length ?? 0) > 0) ||
        (match.has_sizes && (match.sizes?.length ?? 0) > 0)
      ) {
        skipped += 1;
        return;
      }
      for (let i = 0; i < qty; i++) cart.addItem(toMenuItem(match));
      added += 1;
    });

    if (added > 0) {
      setCartOpen(true);
      toast.success(
        `${added} item${added > 1 ? "s" : ""} added to your cart`,
        skipped > 0
          ? {
              description: `${skipped} item${skipped > 1 ? "s" : ""} need${skipped === 1 ? "s" : ""} customisation — please add ${skipped === 1 ? "it" : "them"} manually.`,
              duration: 5000,
            }
          : { description: "Review your order, then check out.", duration: 4000 },
      );
    } else if (skipped > 0) {
      toast.info("Couldn't auto-add items", {
        description: "Please re-select your options on the menu.",
      });
    }
    // We intentionally only run this after the menu is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loading, menuItems.length]);

  const categories = ["All", ...Array.from(new Set(menuItems.map((i) => i.category)))];

  const filtered = menuItems.filter((item) => {
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getItemQty = (itemId: string) => {
    // Sum across all cart lines that refer to this base item (different size/sauce variants)
    return cart.items.filter((c) => c.item.id === itemId).reduce((sum, c) => sum + c.quantity, 0);
  };

  const itemHasOptions = (item: DbMenuItem) =>
    (!!item.has_cuts && (item.cuts?.length ?? 0) > 0) ||
    (!!item.has_sizes && (item.sizes?.length ?? 0) > 0) ||
    (!!item.has_add_ons && (item.add_ons?.length ?? 0) > 0);

  const toMenuItem = (item: DbMenuItem) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    restaurantId: restaurant?.id,
    restaurantName: restaurant?.name || "",
    caption: item.description,
    image: item.image,
    price: item.price,
    available: item.is_available,
    has_sizes: item.has_sizes,
    sizes: item.sizes,
    has_add_ons: item.has_add_ons,
    add_ons: item.add_ons,
    has_cuts: item.has_cuts,
    cuts: item.cuts,
  });

  const [customizeItem, setCustomizeItem] = useState<DbMenuItem | null>(null);

  const handleAddItem = (item: DbMenuItem) => {
    if (locationBlocked) {
      toast.error("Please enable location services to see restaurants available near you.");
      return;
    }
    if (outOfRange) {
      toast.error(
        `This restaurant is outside your delivery range (${DELIVERY_RADIUS_LABEL_KM} km).`,
        {
          description: "Please choose a closer restaurant.",
        },
      );
      return;
    }
    if (noDrivers) {
      toast.error("No drivers are online in your area right now.", {
        description: "Please try again in a few minutes.",
      });
      return;
    }
    if (itemHasOptions(item)) {
      setCustomizeItem(item);
      return;
    }
    cart.addItem(toMenuItem(item));
  };

  const handleCheckout = (note?: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!canOrder) {
      toast.error(
        locationBlocked
          ? "Please enable location services to place an order."
          : `This restaurant is outside your delivery range (${DELIVERY_RADIUS_LABEL_KM} km).`,
      );
      return;
    }
    setFoodNote(note);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  if (!restaurant) return null;

  const bannerImg =
    restaurant.banner_url ||
    foodImages[restaurant.name] ||
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=300&fit=crop";

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
          className="btn-glow absolute top-4 right-4 relative rounded-full gradient-maroon p-2.5 shadow-maroon"
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
        {/* Location gating banner */}
        {geo.ready && locationBlocked && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4">
            <MapPinOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Location is off</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Please enable location services to see restaurants available near you. Ordering is
                disabled until location is enabled.
              </p>
              <button
                onClick={() => geo.refresh()}
                className="btn-glow mt-2 inline-flex items-center gap-1.5 rounded-full gradient-maroon px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-maroon"
              >
                <MapPin className="h-3.5 w-3.5" /> Enable location
              </button>
            </div>
          </div>
        )}
        {geo.ready && outOfRange && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4">
            <MapPinOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1 text-sm text-foreground">
              <p className="font-bold">
                This restaurant is outside your delivery range ({DELIVERY_RADIUS_LABEL_KM} km).
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {restaurantHasCoords && distance != null
                  ? `You're about ${distance.toFixed(1)} km away. Please choose a closer restaurant.`
                  : "Please choose a closer restaurant."}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn-glow mt-2 inline-flex items-center gap-1.5 rounded-full gradient-maroon px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-maroon"
              >
                See nearby restaurants
              </button>
            </div>
          </div>
        )}
        {cartLockedElsewhere && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="flex-1 text-sm text-foreground">
              <p className="font-bold">Your cart is from {cart.activeRestaurantName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You can only order from one restaurant at a time (plus {COMPANION_STORE}). Clear
                your cart to order from {restaurant.name}.
              </p>
              <button
                onClick={() => {
                  cart.clearCart();
                  toast.success("Cart cleared — you can now order from this restaurant.");
                }}
                className="btn-glow mt-2 inline-flex items-center gap-1.5 rounded-full gradient-maroon px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-maroon"
              >
                Clear cart
              </button>
            </div>
          </div>
        )}
        {geo.ready && canOrder && distance != null && (

          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <MapPin className="h-3 w-3" /> {distance.toFixed(1)} km away · within delivery range
            {coverage?.address_tag ? ` · ${coverage.address_tag}` : ""}
          </div>
        )}
        {geo.ready && !locationBlocked && !outOfRange && noDrivers && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            <div className="flex-1 text-sm text-foreground">
              <p className="font-bold">No drivers online in your area</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {coverage?.address_tag
                  ? `We can't accept orders for ${coverage.address_tag} right now because no driver is online nearby. `
                  : "We can't accept orders for your location right now because no driver is online nearby. "}
                Please try again in a few minutes.
              </p>
            </div>
          </div>
        )}
        {/* Gallery */}
        {restaurant.gallery_images && restaurant.gallery_images.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Gallery
            </h3>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {restaurant.gallery_images.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <img
                    src={url}
                    alt={`${restaurant.name} ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
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
            {categories.map((cat) => (
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
            {filtered.map((item) => {
              const qty = getItemQty(item.id);
              const hasOptions = itemHasOptions(item);
              const fromPrice =
                item.has_cuts && (item.cuts?.length ?? 0) > 0
                  ? Math.min(
                      ...item.cuts!.map(
                        (c) => Number(c.price) * Math.max(1, Number(c.min_pieces ?? 1)),
                      ),
                    )
                  : item.has_sizes && (item.sizes?.length ?? 0) > 0
                    ? Math.min(...item.sizes!.map((s) => Number(s.price)))
                    : Number(item.price);
              return (
                <div
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className="flex cursor-pointer gap-3 rounded-2xl border border-border bg-card p-3 shadow-card transition-colors hover:border-primary/40"
                >
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop";
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {item.name}
                        </h4>
                        {hasOptions && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                            Options
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-sm text-primary">
                        {item.has_cuts || item.has_sizes ? "From " : ""}R{fromPrice}
                      </span>
                      {qty === 0 ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddItem(item);
                          }}
                          disabled={!canOrder}
                          data-testid="menu-add-button"
                          className="btn-glow flex items-center gap-1 rounded-xl gradient-maroon px-3 py-1.5 text-xs font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          {hasOptions ? (
                            <>
                              Customize <ChevronRight className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" /> Add
                            </>
                          )}
                        </button>
                      ) : (
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!hasOptions && (
                            <button
                              onClick={() => cart.removeItem(item.id)}
                              aria-label="Remove one"
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary text-foreground"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                            {qty} in cart
                          </span>
                          <button
                            onClick={() => handleAddItem(item)}
                            disabled={!canOrder}
                            aria-label={hasOptions ? "Add another with options" : "Add one"}
                            className="btn-glow flex h-7 w-7 items-center justify-center rounded-full gradient-maroon text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="btn-glow flex w-full items-center justify-between rounded-2xl gradient-maroon px-4 py-3 shadow-maroon"
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
        onAdd={(lineKey) => cart.incrementLine(lineKey)}
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
      <ProductCustomizeModal
        open={!!customizeItem}
        item={customizeItem ? toMenuItem(customizeItem) : null}
        onClose={() => setCustomizeItem(null)}
        onAdd={(menuItem, qty, cut, size, addOns, pieces) => {
          for (let i = 0; i < qty; i++)
            cart.addItemWithOptions(menuItem, cut, size, addOns, pieces);
        }}
      />
      <BottomNav />
    </div>
  );
};

export default RestaurantMenu;
