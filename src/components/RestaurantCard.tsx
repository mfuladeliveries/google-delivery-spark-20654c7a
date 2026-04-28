import { Star, Clock, MapPin, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isRestaurantOpen, formatOpensAt } from "@/lib/restaurantHours";
import { RestaurantName } from "@/components/RestaurantName";

export interface RestaurantCardData {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  location: string;
  cuisine: string;
  rating: number;
  delivery_time: string;
  min_order: number;
  opens_at?: string | null;
  closes_at?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const FALLBACK_IMG = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop";

const restaurantImages: Record<string, string> = {
  Kitchen: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=400&fit=crop",
  "Mdala Tshisanyama": "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop",
  KFC: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=400&fit=crop",
  "Debonnairs Pizza": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=400&fit=crop",
  McDonalds: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop",
  Pedros: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&h=400&fit=crop",
  "BURGER KING": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=800&h=400&fit=crop",
  "Hungry Lion": "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=400&fit=crop",
  "Fellos Fishery": "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&h=400&fit=crop",
  Shop: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&h=400&fit=crop",
  Liquor: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop",
  Steers: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop",
};

const getImage = (r: RestaurantCardData) =>
  r.banner_url || restaurantImages[r.name] || FALLBACK_IMG;

interface Props {
  restaurant: RestaurantCardData;
  variant?: "featured" | "standard" | "horizontal";
  /** Distance from customer in km. If provided, shown on the card. */
  distanceKm?: number | null;
  /** True when within delivery radius — shows a "Within delivery range" badge. */
  nearby?: boolean;
}

const RestaurantCard = ({ restaurant: r, variant = "standard", distanceKm, nearby }: Props) => {
  const navigate = useNavigate();
  const open = isRestaurantOpen(r.opens_at, r.closes_at);
  const imgUrl = getImage(r);

  const handleClick = () => {
    if (!open) {
      toast(`${r.name} is currently closed.`, {
        description: r.opens_at ? `Opens at ${formatOpensAt(r.opens_at)}` : "Please check back later.",
      });
      return;
    }
    navigate(`/restaurant/${r.id}`);
  };

  // ───────────────────────── Horizontal compact row ─────────────────────────
  if (variant === "horizontal") {
    return (
      <button
        onClick={handleClick}
        data-testid="restaurant-card"
        data-restaurant-id={r.id}
        data-restaurant-open={open ? "true" : "false"}
        aria-label={`Open ${r.name}`}
        className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left transition-all hover:shadow-card shadow-card ${!open ? "opacity-60" : "hover:-translate-y-0.5"}`}
      >
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
          <img
            src={imgUrl}
            alt={r.name}
            className="h-full w-full object-cover"
            onError={(e) => ((e.target as HTMLImageElement).src = FALLBACK_IMG)}
          />
          {!open && <div className="absolute inset-0 bg-black/50" />}
        </div>
        <div className="min-w-0 flex-1">
          <RestaurantName as="h4" size="md" name={r.name} className="truncate" />
          <p className="truncate text-xs text-muted-foreground">{r.description}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5 font-semibold text-foreground">
              <Star className="h-3 w-3 fill-primary text-primary" /> {r.rating}
            </span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {r.delivery_time}
            </span>
          </div>
        </div>
      </button>
    );
  }

  const isFeatured = variant === "featured";
  const imgHeightClass = isFeatured ? "h-52" : "h-40";

  return (
    <div
      onClick={handleClick}
      role="link"
      data-testid="restaurant-card"
      data-restaurant-id={r.id}
      data-restaurant-open={open ? "true" : "false"}
      aria-label={`Open ${r.name}`}
      className={`group relative cursor-pointer overflow-hidden rounded-[20px] border border-border bg-card shadow-card transition-all ${open ? "hover:-translate-y-0.5 hover:shadow-orange/30" : "opacity-70"}`}
      style={{ boxShadow: "0 2px 16px hsl(0 0% 0% / 0.08)" }}
    >
      {/* Image */}
      <div className={`relative ${imgHeightClass} w-full bg-muted`}>
        <img
          src={imgUrl}
          alt={r.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => ((e.target as HTMLImageElement).src = FALLBACK_IMG)}
        />
        {/* gradient overlay so badges stay readable */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        {!open && <div className="absolute inset-0 bg-black/50" />}

        {/* Min order — top right with cut radius */}
        <span
          className="absolute right-0 top-0 bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white"
          style={{ borderRadius: "0 20px 0 12px" }}
        >
          Min R{r.min_order}
        </span>

        {/* Cuisine — top left */}
        <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-orange">
          {r.cuisine}
        </span>

        {/* Open / Closed — bottom left */}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-medium text-white">
          <span className={`h-2 w-2 rounded-full ${open ? "bg-emerald-400" : "bg-red-400"}`} />
          {open ? "Open" : "Closed"}
        </span>

        {/* Logo bubble — bottom right (only on featured to avoid clutter) */}
        {isFeatured && r.logo_url && (
          <img
            src={r.logo_url}
            alt=""
            className="absolute bottom-3 right-3 h-12 w-12 rounded-full border-2 border-card object-cover shadow-card"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        )}
      </div>

      {/* Body */}
      <div className={isFeatured ? "p-5" : "p-4"}>
        <div className="flex items-start justify-between gap-2">
          <RestaurantName
            as="h4"
            size={isFeatured ? "xl" : "lg"}
            name={r.name}
            className="truncate"
          />
        </div>

        <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">{r.description}</p>

        {/* Stats row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-0.5 font-semibold text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {r.rating}
          </span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3.5 w-3.5" /> {r.delivery_time}
          </span>
          {r.location && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3.5 w-3.5" /> {r.location}
              </span>
            </>
          )}
        </div>

        {/* Tag pill + nearby/distance */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
            {r.cuisine}
          </span>
          {nearby && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              ✓ Within delivery range
            </span>
          )}
          {typeof distanceKm === "number" && (
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {distanceKm.toFixed(1)} km away
            </span>
          )}
        </div>

        {/* Featured CTA */}
        {isFeatured && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            disabled={!open}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-orange transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {open ? (
              <>
                Order Now <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>Closed{r.opens_at ? ` · Opens ${formatOpensAt(r.opens_at)}` : ""}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default RestaurantCard;

// ───────────────────────── Skeleton ─────────────────────────
export const RestaurantCardSkeleton = ({ featured = false }: { featured?: boolean }) => (
  <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-card">
    <div className={`shimmer ${featured ? "h-52" : "h-40"} w-full`} />
    <div className="space-y-2 p-4">
      <div className="shimmer h-4 w-3/4 rounded" />
      <div className="shimmer h-3 w-1/2 rounded" />
      <div className="flex gap-2 pt-1">
        <div className="shimmer h-3 w-10 rounded" />
        <div className="shimmer h-3 w-14 rounded" />
        <div className="shimmer h-3 w-12 rounded" />
      </div>
    </div>
  </div>
);
