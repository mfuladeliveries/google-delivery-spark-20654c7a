import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

const FitBounds = ({ positions }: { positions: [number, number][] }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (positions.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [positions, map]);
  return null;
};

interface DriverDeliveryMapProps {
  driverLocation: { lat: number; lng: number } | null;
  customerAddress: string;
  restaurantName?: string;
}

const DriverDeliveryMap = ({ driverLocation, customerAddress, restaurantName }: DriverDeliveryMapProps) => {
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const geocode = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(customerAddress)}&format=json&limit=1`
        );
        const data = await res.json();
        if (data?.[0]) {
          setCustomerPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch {}
    };
    if (customerAddress) geocode();
  }, [customerAddress]);

  const center = driverLocation || customerPos || { lat: -29.12, lng: 26.22 };
  const positions: [number, number][] = [];
  if (driverLocation) positions.push([driverLocation.lat, driverLocation.lng]);
  if (customerPos) positions.push([customerPos.lat, customerPos.lng]);

  return (
    <div className="h-52 w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {positions.length > 1 && <FitBounds positions={positions} />}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
            <Popup>🚗 Your location</Popup>
          </Marker>
        )}
        {customerPos && (
          <Marker position={[customerPos.lat, customerPos.lng]}>
            <Popup>📍 {customerAddress}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default DriverDeliveryMap;
