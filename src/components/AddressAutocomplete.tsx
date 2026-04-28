import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, Trash2, X } from "lucide-react";

export interface ValidatedAddress {
  /** Full formatted address as returned by the geocoder. */
  address: string;
  lat: number;
  lng: number;
}

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

interface AddressAutocompleteProps {
  value: string;
  /** When the user picks a suggestion, this fires with full address + coords. */
  onSelect: (result: ValidatedAddress) => void;
  /** Fires whenever the raw text changes (e.g. user typing). Coords should be cleared by parent. */
  onTextChange: (text: string) => void;
  placeholder?: string;
  /** Whether a valid coords-bound address is currently selected. */
  hasValidSelection: boolean;
  disabled?: boolean;
  /** Bias suggestions to a country (ISO 3166-1 alpha-2). Defaults to "za". */
  countryCode?: string;
}

const CACHE_KEY = "mfula-addr-cache-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry = { ts: number; results: NominatimSuggestion[] };

function readCache(query: string): NominatimSuggestion[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = data[query.toLowerCase()];
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.results;
  } catch {
    return null;
  }
}

function writeCache(query: string, results: NominatimSuggestion[]) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
    data[query.toLowerCase()] = { ts: Date.now(), results };
    // Keep cache small — drop oldest if over 60 entries.
    const keys = Object.keys(data);
    if (keys.length > 60) {
      const sorted = keys.sort((a, b) => data[a].ts - data[b].ts);
      sorted.slice(0, keys.length - 60).forEach((k) => delete data[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Search the cache for any previously verified suggestions matching the query.
 * Used as a fallback when Nominatim is unavailable: matches by cache key
 * substring OR by result display_name substring, deduped by place_id.
 */
function searchCacheFallback(query: string): NominatimSuggestion[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Record<string, CacheEntry>;
    const needle = query.toLowerCase();
    const seen = new Set<number>();
    const out: NominatimSuggestion[] = [];
    const entries = Object.entries(data).sort((a, b) => b[1].ts - a[1].ts);
    for (const [key, entry] of entries) {
      if (Date.now() - entry.ts > CACHE_TTL_MS) continue;
      const keyMatch = key.includes(needle);
      for (const s of entry.results) {
        if (seen.has(s.place_id)) continue;
        if (keyMatch || s.display_name.toLowerCase().includes(needle)) {
          seen.add(s.place_id);
          out.push(s);
          if (out.length >= 5) return out;
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Count non-expired cache entries. */
function countCache(): number {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    return Object.values(data).filter((e) => now - e.ts <= CACHE_TTL_MS).length;
  } catch {
    return 0;
  }
}

/** Remove all cached suggestions. */
function clearAllCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Autocomplete delivery-address input backed by OpenStreetMap Nominatim.
 *
 * Critical contract: pure-text typing never produces coords — the parent must
 * clear coords whenever onTextChange fires, and only treat the address as valid
 * after onSelect provides {address, lat, lng}.
 */
export const AddressAutocomplete = ({
  value,
  onSelect,
  onTextChange,
  placeholder = "Start typing your delivery address…",
  hasValidSelection,
  disabled,
  countryCode = "za",
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [cacheCount, setCacheCount] = useState<number>(() => countCache());
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search.
  useEffect(() => {
    const q = value.trim();
    if (hasValidSelection || q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      setSearched(false);
      setFallback(false);
      return;
    }

    // Use cache first (exact-key hit).
    const cached = readCache(q);
    if (cached) {
      setSuggestions(cached);
      setOpen(true);
      setError(null);
      setSearched(true);
      setFallback(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFallback(false);
    setOpen(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const timer = window.setTimeout(() => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q,
      )}&format=json&limit=5&addressdetails=0&countrycodes=${encodeURIComponent(countryCode)}`;
      fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
        .then((r) => {
          if (!r.ok) throw new Error("Geocoder error");
          return r.json();
        })
        .then((data: NominatimSuggestion[]) => {
          const cleaned = Array.isArray(data) ? data.slice(0, 5) : [];
          setSuggestions(cleaned);
          setOpen(true);
          setSearched(true);
          setFallback(false);
          writeCache(q, cleaned);
          setCacheCount(countCache());
        })
        .catch((err: unknown) => {
          if ((err as Error).name === "AbortError") return;
          // Fallback: search across cached suggestions for any partial match.
          const cachedFallback = searchCacheFallback(q);
          setSearched(true);
          if (cachedFallback.length > 0) {
            setSuggestions(cachedFallback);
            setOpen(true);
            setFallback(true);
            setError(null);
          } else {
            setSuggestions([]);
            setOpen(false);
            setFallback(false);
            setError(
              err instanceof TypeError
                ? "Address lookup is offline and no saved matches were found. Check your connection and retry."
                : "Address lookup is temporarily unavailable. Please try again.",
            );
          }
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, hasValidSelection, countryCode, retryToken]);

  // Close suggestions on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePick = (s: NominatimSuggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setOpen(false);
    setSuggestions([]);
    onSelect({ address: s.display_name, lat, lng });
  };

  const handleClear = () => {
    onTextChange("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          className="w-full rounded-xl border border-border bg-card pl-9 pr-9 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Clear address"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && !hasValidSelection && (loading || suggestions.length > 0 || (searched && !error)) && (
        <div
          role="listbox"
          aria-busy={loading}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching addresses…</span>
            </div>
          )}
          {!loading && fallback && suggestions.length > 0 && (
            <div className="mx-1 mt-1 mb-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
              Live address lookup is unavailable. Showing saved matches from your recent searches.
            </div>
          )}
          {!loading && suggestions.length === 0 && searched && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matching addresses. Try adding a suburb or city.
            </div>
          )}
          {!loading &&
            suggestions.map((s) => (
              <button
                key={s.place_id}
                type="button"
                onClick={() => handlePick(s)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="break-words">{s.display_name}</span>
              </button>
            ))}
        </div>
      )}

      {loading && !open && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching addresses…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-1 flex items-start justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
        >
          <span className="break-words">{error}</span>
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            className="flex-shrink-0 font-medium underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
