import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";

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
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Debounced search.
  useEffect(() => {
    const q = value.trim();
    if (hasValidSelection || q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    // Use cache first.
    const cached = readCache(q);
    if (cached) {
      setSuggestions(cached);
      setOpen(cached.length > 0);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
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
          setOpen(cleaned.length > 0);
          writeCache(q, cleaned);
        })
        .catch((err: unknown) => {
          if ((err as Error).name === "AbortError") return;
          setSuggestions([]);
          setOpen(false);
          setError("Unable to verify address. Please try again.");
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, hasValidSelection, countryCode]);

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

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onClick={() => handlePick(s)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="break-words">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default AddressAutocomplete;
