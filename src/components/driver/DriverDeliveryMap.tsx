import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097144.png",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const restaurantIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3448/3448609.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const customerIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const FitBounds = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(positions.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [positions, map]);
  return null;
};

const UpdateDriverMarker = ({ position }: { position: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    // Smoothly pan to keep driver in view
    if (!map.getBounds().contains(L.latLng(position[0], position[1]))) {
      map.panTo(L.latLng(position[0], position[1]), { animate: true });
    }
  }, [position, map]);
  return null;
};

interface DriverDeliveryMapProps {
  driverLocation: { lat: number; lng: number } | null;
  customerAddress: string;
  customerLat?: number | null;
  customerLng?: number | null;
  restaurantName?: string;
}

const DriverDeliveryMap = ({
  driverLocation,
  customerAddress,
  customerLat,
  customerLng,
  restaurantName,
}: DriverDeliveryMapProps) => {
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(
    typeof customerLat === "number" && typeof customerLng === "number"
      ? { lat: customerLat, lng: customerLng }
      : null,
  );

  useEffect(() => {
    // Prefer exact GPS coords stored on the order; only geocode the address as a fallback.
    if (typeof customerLat === "number" && typeof customerLng === "number") {
      setCustomerPos({ lat: customerLat, lng: customerLng });
      return;
    }
    const geocode = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(customerAddress)}&format=json&limit=1`,
        );
        const data = await res.json();
        if (data?.[0]) {
          setCustomerPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch {}
    };
    if (customerAddress) geocode();
  }, [customerAddress, customerLat, customerLng]);

  const center = driverLocation || customerPos || { lat: -29.12, lng: 26.22 };
  const positions: [number, number][] = [];
  if (driverLocation) positions.push([driverLocation.lat, driverLocation.lng]);
  if (customerPos) positions.push([customerPos.lat, customerPos.lng]);

  // Build a simple route line between driver → customer
  const routePositions: [number, number][] = [];
  if (driverLocation) routePositions.push([driverLocation.lat, driverLocation.lng]);
  if (customerPos) routePositions.push([customerPos.lat, customerPos.lng]);

  // Estimate times
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const distToCustomer =
    driverLocation && customerPos
      ? getDistance(driverLocation.lat, driverLocation.lng, customerPos.lat, customerPos.lng)
      : null;
  const etaMinutes = distToCustomer ? Math.round(distToCustomer * 2.5 + 5) : null;

  return (
    <div className="relative">
      <div className="h-56 w-full">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full rounded-t-2xl"
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {positions.length > 1 && <FitBounds positions={positions} />}

          {/* Route line */}
          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: "hsl(24, 100%, 50%)",
                weight: 4,
                opacity: 0.7,
                dashArray: "10, 8",
              }}
            />
          )}

          {driverLocation && (
            <>
              <UpdateDriverMarker position={[driverLocation.lat, driverLocation.lng]} />
              <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
                <Popup>🚗 Your location</Popup>
              </Marker>
            </>
          )}
          {customerPos && (
            <Marker position={[customerPos.lat, customerPos.lng]} icon={customerIcon}>
              <Popup>📍 {customerAddress}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ETA overlay */}
      {etaMinutes !== null && (
        <div className="absolute bottom-2 left-2 z-[1000] rounded-xl bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 shadow-lg">
          <p className="text-xs font-bold text-foreground">
            📍 {distToCustomer!.toFixed(1)} km · ~{etaMinutes} min
          </p>
        </div>
      )}
    </div>
  );
};

export default DriverDeliveryMap;
