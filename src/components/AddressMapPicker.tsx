import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

// Approximate delivery-zone footprints (suburb centroids + radius in meters).
// These are used to draw a visible boundary overlay so customers can see where
// they're allowed to drop the pin. Final zone match still uses detectZone().
const ZONE_AREAS: Array<{
  zoneId: 1 | 2;
  name: string;
  center: [number, number];
  radius: number;
}> = [
  // Zone 1 — R65
  { zoneId: 1, name: "Mfuleni", center: [-34.0233, 18.6781], radius: 1800 },
  { zoneId: 1, name: "Bluedowns", center: [-34.0058, 18.6622], radius: 1500 },
  { zoneId: 1, name: "Bardale Village", center: [-34.0285, 18.6605], radius: 1200 },
  { zoneId: 1, name: "Bosasa", center: [-34.0156, 18.6712], radius: 900 },
  { zoneId: 1, name: "Belladonna", center: [-34.0192, 18.6892], radius: 900 },
  // Zone 2 — R75
  { zoneId: 2, name: "Eerste River", center: [-34.0233, 18.7244], radius: 2000 },
  { zoneId: 2, name: "Summerville", center: [-34.0148, 18.7058], radius: 1100 },
  { zoneId: 2, name: "Blackheath", center: [-33.9933, 18.6917], radius: 1700 },
];

const ZONE_STYLES: Record<1 | 2, { color: string; fill: string }> = {
  1: { color: "hsl(24 95% 53%)", fill: "hsl(24 95% 53% / 0.15)" }, // primary orange
  2: { color: "hsl(217 91% 60%)", fill: "hsl(217 91% 60% / 0.15)" }, // blue
};

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

  // Geographically determine which circle the pin is currently inside.
  // Picks the area whose centre is closest to the pin AND within its radius.
  const activeArea = useMemo(() => {
    const [lat, lng] = position;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const distM = (a: [number, number], b: [number, number]) => {
      const R = 6371000;
      const dLat = toRad(b[0] - a[0]);
      const dLng = toRad(b[1] - a[1]);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    let best: { area: (typeof ZONE_AREAS)[number]; d: number } | null = null;
    for (const a of ZONE_AREAS) {
      const d = distM([lat, lng], a.center);
      if (d <= a.radius && (!best || d < best.d)) best = { area: a, d };
    }
    return best?.area ?? null;
  }, [position]);

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
          {ZONE_AREAS.map((z) => {
            const style = ZONE_STYLES[z.zoneId];
            const isActive = activeArea?.name === z.name;
            return (
              <Circle
                key={z.name}
                center={z.center}
                radius={z.radius}
                pathOptions={{
                  color: style.color,
                  weight: isActive ? 4 : 2,
                  fillColor: style.color,
                  fillOpacity: isActive ? 0.35 : 0.15,
                  dashArray: isActive ? undefined : "4 4",
                }}
              >
                <Popup>
                  <strong>{z.name}</strong>
                  <br />
                  Zone {z.zoneId} · R{z.zoneId === 1 ? 65 : 75} delivery
                </Popup>
              </Circle>
            );
          })}
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

        {/* Live zone badge */}
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[60%]">
          {activeArea ? (
            <div
              key={activeArea.name}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg ring-2 ring-white/70 animate-in fade-in slide-in-from-top-1"
              style={{ background: ZONE_STYLES[activeArea.zoneId].color }}
            >
              <span aria-hidden>📍</span>
              <span className="truncate">
                You're in: {activeArea.name} · R{activeArea.zoneId === 1 ? 65 : 75}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-bold text-destructive shadow-lg ring-1 ring-destructive/40 backdrop-blur">
              <span aria-hidden>⚠️</span>
              Outside delivery zones
            </div>
          )}
        </div>

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

      <div className="flex items-center justify-between gap-3 px-4 pt-2">
        <p className="text-[11px] text-muted-foreground">
          Tap the map or drag the pin to your exact spot.
        </p>
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: ZONE_STYLES[1].color, opacity: 0.6 }}
              aria-hidden
            />
            R65
          </span>
          <span className="inline-flex items-center gap-1 text-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: ZONE_STYLES[2].color, opacity: 0.6 }}
              aria-hidden
            />
            R75
          </span>
        </div>
      </div>

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
        </div>

        {!detectedZone && address && !loadingAddress && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 animate-in fade-in slide-in-from-top-1"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-destructive">Outside our delivery area</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-foreground">
                We can't deliver to this pin yet. Move it to one of our zones:{" "}
                <span className="font-semibold">{ALL_DELIVERY_AREAS}</span>.
              </p>
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={() => onConfirm({ address, lat: position[0], lng: position[1] })}
          disabled={!address || loadingAddress || !detectedZone}
          className={cn("h-12 w-full rounded-full text-sm font-bold")}
        >
          {!detectedZone && address && !loadingAddress ? "Pick a spot inside our zones" : "Use this address"}
        </Button>
      </div>
    </div>
  );
};

export default AddressMapPicker;
