import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_DELIVERY_AREAS, detectZone } from "@/lib/zones";

// Fix default marker icon paths (Leaflet + bundlers).
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
  shadowSize: [41, 41],
});

// Default centre = Mfuleni, Cape Town
const DEFAULT_CENTER: [number, number] = [-34.0233, 18.6781];

interface AddressMapPickerProps {
  /** Called when the user confirms a picked location. */
  onConfirm: (result: { address: string; lat: number; lng: number }) => void;
  /** Optional initial address to centre on. */
  initialAddress?: string;
}

const RecenterMap = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
  }, [map, position]);
  return null;
};

const ClickHandler = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const AddressMapPicker = ({ onConfirm, initialAddress }: AddressMapPickerProps) => {
  const [position, setPosition] = useState<[number, number]>(DEFAULT_CENTER);
  const [address, setAddress] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const reverseAbort = useRef<AbortController | null>(null);

  // Reverse-geocode whenever the pin moves
  useEffect(() => {
    reverseAbort.current?.abort();
    const ctrl = new AbortController();
    reverseAbort.current = ctrl;
    setLoadingAddress(true);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${position[0]}&lon=${position[1]}&format=json&zoom=18&addressdetails=1`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.display_name) setAddress(data.display_name);
      })
      .catch(() => {})
      .finally(() => setLoadingAddress(false));
    return () => ctrl.abort();
  }, [position]);

  // On first mount, try to centre on initial address
  useEffect(() => {
    const q = initialAddress?.trim();
    if (!q) return;
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { Accept: "application/json" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data[0]) {
          setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=za`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      }
    } finally {
      setSearching(false);
    }
  };

  const detectedZone = useMemo(() => detectZone(address), [address]);

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 px-4 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a place, e.g. Mfuleni Drive"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching || !search.trim()} size="sm" className="h-10 px-4">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
        </Button>
      </form>

      {/* Map */}
      <div className="relative mx-4 overflow-hidden rounded-2xl border border-border" style={{ height: 280 }}>
        <MapContainer
          center={position}
          zoom={16}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={position}
            icon={markerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                setPosition([ll.lat, ll.lng]);
              },
            }}
          />
          <ClickHandler onPick={(lat, lng) => setPosition([lat, lng])} />
          <RecenterMap position={position} />
        </MapContainer>

        {/* Use my location FAB */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="absolute right-3 top-3 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border hover:bg-accent disabled:opacity-60"
          aria-label="Use my location"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        </button>
      </div>

      <p className="px-4 pt-2 text-[11px] text-muted-foreground">
        Tap the map or drag the pin to your exact spot.
      </p>

      {/* Selected address */}
      <div className="mt-3 space-y-2 px-4 pb-4">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Selected location
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {loadingAddress ? "Finding address…" : address || "Move the pin to pick an address"}
              </p>
            </div>
          </div>
          {detectedZone && !loadingAddress && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              ✓ {detectedZone.name} · R{detectedZone.fee} delivery
            </p>
          )}
          {!detectedZone && address && !loadingAddress && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              ⚠️ Outside our delivery area
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => onConfirm({ address, lat: position[0], lng: position[1] })}
          disabled={!address || loadingAddress}
          className={cn("h-12 w-full rounded-full text-sm font-bold")}
        >
          Use this address
        </Button>
      </div>
    </div>
  );
};

export default AddressMapPicker;
