import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search as SearchIcon, ArrowLeft, Star, Clock, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { storeInfo } from "@/data/menu";
import { useAuth } from "@/hooks/useAuth";
import { getHomeRouteForRoles } from "@/lib/homeRoute";
import { RestaurantName } from "@/components/RestaurantName";

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  delivery_time: string;
  min_order: number;
  description: string;
  image_url?: string | null;
}


interface MenuItemResult {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  restaurant_id: string;
  restaurant_name?: string;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop";


const Search = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const homeRoute = getHomeRouteForRoles(roles);
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"restaurants" | "items">("restaurants");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        doSearch(query.trim());
      } else {
        setRestaurants([]);
        setMenuItems([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = async (q: string) => {
    setLoading(true);
    const { getCatalog } = await import("@/lib/catalog");
    const [cat, itemsRes] = await Promise.all([
      getCatalog().catch(() => null),
      supabase
        .from("menu_items")
        .select("id, name, description, price, image, category, restaurant_id")
        .eq("is_available", true)
        .ilike("name", `%${q}%`)
        .limit(20),
    ]);
    const needle = q.toLowerCase();
    const rests = (cat?.restaurants ?? [])
      .filter((r) => r.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    setRestaurants(rests as unknown as Restaurant[]);

    const items = itemsRes.data;
    if (items && items.length > 0) {
      const restMap = Object.fromEntries((cat?.restaurants ?? []).map((r) => [r.id, r.name]));
      setMenuItems(items.map((i) => ({ ...i, restaurant_name: restMap[i.restaurant_id] || "" })));
    } else {
      setMenuItems([]);
    }
    setLoading(false);
  };


  const totalResults = restaurants.length + menuItems.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to={homeRoute}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants or dishes..."
              autoFocus
              className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 pb-nav md:pb-8">
        {query.length < 2 ? (
          <div className="py-20 text-center text-muted-foreground">
            <SearchIcon className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p className="font-semibold">Search for restaurants or dishes</p>
            <p className="text-sm mt-1">Type at least 2 characters to search</p>
          </div>
        ) : loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : totalResults === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <UtensilsCrossed className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p className="font-semibold">No results for "{query}"</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        ) : (
          <>
            {/* Tab toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab("restaurants")}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  tab === "restaurants"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                Restaurants ({restaurants.length})
              </button>
              <button
                onClick={() => setTab("items")}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
                  tab === "items"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                Dishes ({menuItems.length})
              </button>
            </div>

            {tab === "restaurants" ? (
              restaurants.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No restaurants found
                </p>
              ) : (
                <div className="space-y-3">
                  {restaurants.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/restaurant/${r.id}`)}
                      className="flex gap-3 rounded-2xl border border-border bg-card p-3 cursor-pointer hover:border-primary/30 transition-all hover:shadow-card shadow-card"
                    >
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                        <img
                          src={
                            restaurantImages[r.name] ||
                            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop"
                          }
                          alt={r.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <RestaurantName as="h3" size="md" name={r.name} className="truncate" />
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5 font-medium text-foreground">
                            <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {r.delivery_time}
                          </span>
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                            {r.cuisine}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : menuItems.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No dishes found</p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/restaurant/${item.restaurant_id}`)}
                    className="flex gap-3 rounded-2xl border border-border bg-card p-3 cursor-pointer hover:border-primary/30 transition-all shadow-card"
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-bold text-sm text-primary">
                          {storeInfo.currency}
                          {item.price}
                        </span>
                        {item.restaurant_name && (
                          <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                            @ {item.restaurant_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Search;
