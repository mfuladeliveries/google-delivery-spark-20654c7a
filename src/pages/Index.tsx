import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight, Flame, Utensils, Pizza, Fish, ShoppingBasket, Trophy, UtensilsCrossed, MapPin, MapPinOff, RefreshCw, Pencil, X } from "lucide-react";
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
import AddressAutocomplete, { type ValidatedAddress } from "@/components/AddressAutocomplete";
import { distanceKm } from "@/lib/serviceArea";
import { toast } from "sonner";

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

  // Manual address override — when set, restaurants are filtered/sorted from
  // these coords instead of the live GPS / saved-address fallback.
  const [manualAddress, setManualAddress] = useState<ValidatedAddress | null>(() => {
    try {
      const raw = localStorage.getItem("mfula-manual-area-v1");
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v?.lat === "number" && typeof v?.lng === "number" && typeof v?.address === "string") return v;
    } catch {/* ignore */}
    return null;
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualUpdatedAt, setManualUpdatedAt] = useState<number | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Escape key closes the manual address panel — but if the user has typed
  // something they haven't picked yet, surface the same discard-changes
  // confirmation as the Cancel button instead of dropping their edits.
  useEffect(() => {
    if (!manualOpen) return;
    const handler = (e: KeyboardEvent) => {
      const baseline = manualAddress ? manualAddress.address : "";
      const trimmed = manualText.trim();
      const isDirty = trimmed !== baseline.trim() && trimmed.length > 0;

      if (e.key === "Escape") {
        e.preventDefault();
        if (isDirty) {
          setConfirmingCancel(true);
        } else {
          setManualOpen(false);
          setManualText(baseline);
          setConfirmingCancel(false);
        }
        return;
      }

      if (e.key === "Enter") {
        // If the autocomplete dropdown is open, let it handle Enter
        // (it has its own list selection). Otherwise, if the text matches
        // the saved address, treat Enter as "confirm" and close the panel.
        const target = e.target as HTMLElement | null;
        const insideAutocomplete = target?.closest('[role="listbox"]');
        if (insideAutocomplete) return;
        if (manualAddress && trimmed === baseline.trim() && trimmed.length > 0) {
          e.preventDefault();
          setManualOpen(false);
          setConfirmingCancel(false);
          setManualUpdatedAt(Date.now());
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [manualOpen, manualText, manualAddress]);

  const persistManual = (val: ValidatedAddress | null) => {
    try {
      if (val) localStorage.setItem("mfula-manual-area-v1", JSON.stringify(val));
      else localStorage.removeItem("mfula-manual-area-v1");
    } catch {/* ignore */}
  };

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

  // Effective coords: manual address override wins, else GPS/profile fallback.
  const effectiveCoords = manualAddress
    ? { lat: manualAddress.lat, lng: manualAddress.lng }
    : geo.hasCoords ? { lat: geo.lat as number, lng: geo.lng as number } : null;
  const hasEffectiveCoords = effectiveCoords != null;

  // Annotate every restaurant with distance + nearby flag.
  // Restaurants without coords are treated as out of range.
  const annotated = useMemo(() => {
    return restaurants.map((r) => {
      const d =
        effectiveCoords && r.lat != null && r.lng != null
          ? distanceKm(effectiveCoords.lat, effectiveCoords.lng, r.lat, r.lng)
          : null;
      const nearby = d != null && d <= DELIVERY_RADIUS_KM;
      return { ...r, _distance: d, _nearby: nearby };
    });
  }, [restaurants, effectiveCoords?.lat, effectiveCoords?.lng]);

  const filtered = annotated.filter((r) => {
    const matchesCuisine = selectedCuisine === "All" || r.cuisine === selectedCuisine;
    const matchesSearch = !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase());
    // Hide restaurants outside the delivery radius once we know where the
    // customer is. Without coords (denied/unsupported) we show everything so
    // the user isn't left with an empty list.
    const withinRange = !hasEffectiveCoords || r._nearby;
    return matchesCuisine && matchesSearch && withinRange;
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

        {/* Location source pill — shows GPS vs saved-address sanity-check fallback */}
        {geo.ready && geo.hasCoords && (
          <div className="mb-3 flex items-center gap-2">
            {geo.source === "gps" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-3 w-3" /> Live GPS location
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                title={
                  geo.gpsDiscrepancyKm != null
                    ? `GPS reported a location ${geo.gpsDiscrepancyKm.toFixed(1)} km from your saved address (limit ${8} km). Using your saved address instead.`
                    : "GPS reported a location far from your saved address, so we're using the saved address instead."
                }
              >
                <MapPin className="h-3 w-3" /> Saved address
                {geo.gpsDiscrepancyKm != null && (
                  <span className="opacity-80">· GPS off by {geo.gpsDiscrepancyKm.toFixed(1)} km</span>
                )}
              </span>
            )}
            {geo.source === "gps" && geo.accuracyM != null && (
              <span
                title={
                  geo.accuracyM <= 30
                    ? `Excellent GPS accuracy (~${Math.round(geo.accuracyM)} m). Trustworthy.`
                    : geo.accuracyM <= 100
                      ? `Decent GPS accuracy (~${Math.round(geo.accuracyM)} m). Usually fine.`
                      : `Low GPS accuracy (~${Math.round(geo.accuracyM)} m). Likely wifi/IP based — may be unreliable.`
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  geo.accuracyM <= 30
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : geo.accuracyM <= 100
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                ±{Math.round(geo.accuracyM)} m
              </span>
            )}
            <button
              type="button"
              onClick={() => geo.refresh()}
              disabled={geo.status === "prompt"}
              title="Retry GPS permission and re-run the 8 km sanity check"
              aria-label="Retry GPS location"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${geo.status === "prompt" ? "animate-spin" : ""}`} />
              {geo.status === "prompt" ? "Checking…" : "Retry GPS"}
            </button>
            {geo.source === "profile" && geo.gpsDiscrepancyKm != null && (
              <button
                type="button"
                onClick={() => geo.trustGps()}
                title="I've travelled away from my saved address — trust GPS for this session"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                Use my GPS anyway
              </button>
            )}
          </div>
        )}

        {/* Manual area picker — type an address to browse restaurants in that area */}
        <div className="mb-4">
          {manualAddress ? (
            <div className="flex flex-wrap items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">Browsing area</p>
                <p className="truncate text-xs text-muted-foreground" title={manualAddress.address}>
                  {manualAddress.address}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setManualText(manualAddress.address);
                    setManualOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                >
                  <Pencil className="h-3 w-3" /> Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualAddress(null);
                    persistManual(null);
                    setManualText("");
                    setManualOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3 w-3" /> Use my location
                </button>
              </div>
            </div>
          ) : !manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <Pencil className="h-3 w-3" /> Enter an address manually
            </button>
          ) : null}

          {manualOpen && (() => {
            const baseline = manualAddress ? manualAddress.address : "";
            const isDirty = manualText.trim() !== baseline.trim() && manualText.trim().length > 0;
            const closeWithoutSaving = () => {
              setManualOpen(false);
              setManualText(baseline);
              setConfirmingCancel(false);
            };
            const requestCancel = () => {
              if (isDirty) setConfirmingCancel(true);
              else closeWithoutSaving();
            };
            const handlePanelBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
              // Only fire when focus leaves the panel entirely (not when it
              // just moves between children like input → suggestion button).
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              const trimmed = manualText.trim();
              if (
                manualAddress &&
                trimmed === baseline.trim() &&
                trimmed.length > 0 &&
                !confirmingCancel
              ) {
                setManualOpen(false);
                setManualUpdatedAt(Date.now());
                toast.success("Address confirmed", {
                  description: "Restaurant list refreshed for your saved area.",
                });
              }
            };
            return (
              <div
                className="mt-2 rounded-2xl border border-border bg-card p-3 shadow-card"
                onBlur={handlePanelBlur}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground">
                    {manualAddress ? "Update your saved address" : "Type your delivery area"}
                  </p>
                  <button
                    type="button"
                    onClick={requestCancel}
                    className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {manualAddress && (
                  <p className="mb-2 truncate text-[11px] text-muted-foreground" title={manualAddress.address}>
                    Current: <span className="font-medium text-foreground">{manualAddress.address}</span>
                  </p>
                )}
                <AddressAutocomplete
                  value={manualText}
                  hasValidSelection={false}
                  onTextChange={(t) => {
                    setManualText(t);
                    if (confirmingCancel) setConfirmingCancel(false);
                  }}
                  onSelect={(addr) => {
                    setManualAddress(addr);
                    persistManual(addr);
                    setManualText(addr.address);
                    setManualOpen(false);
                    setManualUpdatedAt(Date.now());
                    setConfirmingCancel(false);
                  }}
                  placeholder={manualAddress ? "Search a new address…" : "Start typing a suburb or street…"}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Pick a suggestion to {manualAddress ? "replace your saved address" : "see restaurants"} within {DELIVERY_RADIUS_KM} km.
                </p>
                {confirmingCancel ? (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Discard your changes? You haven't picked a suggestion yet, so nothing will be saved.
                    </p>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmingCancel(false)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-secondary"
                      >
                        Keep editing
                      </button>
                      <button
                        type="button"
                        onClick={closeWithoutSaving}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground hover:bg-destructive/90"
                      >
                        Discard changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={requestCancel}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {manualUpdatedAt && Date.now() - manualUpdatedAt < 3500 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <MapPin className="h-3 w-3" /> Address updated — restaurant list refreshed
            </div>
          )}
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
                : hasEffectiveCoords
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
            (() => {
              // "Out of range" = we know where the user is, the underlying
              // restaurant list isn't empty, and at least one restaurant
              // would have matched the search/cuisine filters but was hidden
              // because it's farther than DELIVERY_RADIUS_KM.
              const matchesFilters = annotated.filter((r) => {
                const matchesCuisine = selectedCuisine === "All" || r.cuisine === selectedCuisine;
                const matchesSearch = !search.trim()
                  || r.name.toLowerCase().includes(search.toLowerCase())
                  || r.cuisine.toLowerCase().includes(search.toLowerCase());
                return matchesCuisine && matchesSearch;
              });
              const outOfRange = hasEffectiveCoords && matchesFilters.length > 0;
              const nearest = outOfRange
                ? matchesFilters.reduce<number | null>((min, r) => {
                    if (r._distance == null) return min;
                    return min == null || r._distance < min ? r._distance : min;
                  }, null)
                : null;

              if (outOfRange) {
                return (
                  <div className="rounded-2xl border border-border bg-card py-16 text-center shadow-card">
                    <MapPinOff className="mx-auto mb-3 h-12 w-12 text-primary/60" />
                    <p className="font-semibold text-foreground">No restaurants within {DELIVERY_RADIUS_KM} km</p>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                      {nearest != null
                        ? `The closest restaurant is about ${nearest.toFixed(1)} km away — just outside our delivery range.`
                        : "We couldn't find any restaurants close enough to deliver to your current location."}
                      {" "}If your location looks wrong, try refreshing your GPS.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => geo.refresh()}
                        disabled={geo.status === "prompt"}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-orange transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw className={`h-4 w-4 ${geo.status === "prompt" ? "animate-spin" : ""}`} />
                        {geo.status === "prompt" ? "Checking…" : "Retry GPS"}
                      </button>
                      <button
                        onClick={() => navigate("/profile")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                      >
                        Update saved address
                      </button>
                    </div>
                  </div>
                );
              }

              return (
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
              );
            })()
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