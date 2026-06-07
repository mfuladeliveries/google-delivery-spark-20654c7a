import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { placeAutocomplete, placeDetails, type PlaceSuggestion } from "@/lib/geocode";

export interface ValidatedAddress {
  /** Full formatted address as returned by the geocoder. */
  address: string;
  lat: number;
  lng: number;
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

/**
 * Autocomplete delivery-address input backed by Google Places API (New),
 * routed through our `maps-geocode` edge function.
 *
 * Critical contract: pure-text typing never produces coords — the parent must
 * clear coords whenever onTextChange fires, and only treat the address as
 * valid after onSelect provides {address, lat, lng}.
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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reqIdRef = useRef(0);

  // One Places session token per typing session — Google bills autocomplete +
  // details together when both share a token.
  const sessionToken = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    // Reset whenever a fresh selection happens or the input is cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasValidSelection ? "selected" : "typing"],
  );

  // Debounced autocomplete
  useEffect(() => {
    const q = value.trim();
    if (hasValidSelection || q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError(null);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);
    const myId = ++reqIdRef.current;

    const timer = window.setTimeout(async () => {
      try {
        const results = await placeAutocomplete(q, sessionToken);
        if (myId !== reqIdRef.current) return;
        setSuggestions(results);
        setSearched(true);
        setOpen(true);
      } catch {
        if (myId !== reqIdRef.current) return;
        setError("Address lookup is temporarily unavailable. Please try again.");
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [value, hasValidSelection, countryCode, sessionToken]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePick = async (s: PlaceSuggestion) => {
    setResolving(true);
    setOpen(false);
    try {
      const details = await placeDetails(s.place_id, sessionToken);
      if (!details) {
        setError("Couldn't resolve that address. Please try another.");
        setOpen(true);
        return;
      }
      onSelect({ address: details.address, lat: details.lat, lng: details.lng });
    } finally {
      setResolving(false);
    }
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
          disabled={disabled || resolving}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          className="w-full rounded-xl border border-border bg-card pl-9 pr-9 py-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
        />
        {(loading || resolving) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!loading && !resolving && value && (
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

      {open &&
        !hasValidSelection &&
        (loading || suggestions.length > 0 || (searched && !error)) && (
          <div
            role="listbox"
            aria-busy={loading}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Searching addresses…</span>
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
                  <span className="flex-1 break-words">
                    <span className="block font-medium">{s.main}</span>
                    {s.secondary && (
                      <span className="block text-xs text-muted-foreground">{s.secondary}</span>
                    )}
                  </span>
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
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
