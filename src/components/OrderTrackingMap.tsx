import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

// Fix default marker icons for leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const driverIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3097/3097144.png",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

interface RecenterProps {
  lat: number;
  lng: number;
}

const Recenter = ({ lat, lng }: RecenterProps) => {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!hasCentered.current) {
      map.setView([lat, lng], 15);
      hasCentered.current = true;
    }
  }, [lat, lng, map]);
  return null;
};

interface OrderTrackingMapProps {
  orderId: string;
  customerAddress: string;
}

const OrderTrackingMap = ({ orderId, customerAddress }: OrderTrackingMapProps) => {
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [customerPos, setCustomerPos] = useState<{ lat: number; lng: number } | null>(null);

  // Geocode customer address
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

  // Subscribe to driver location updates
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("orders")
        .select("driver_lat, driver_lng")
        .eq("id", orderId)
        .single();
      if (data?.driver_lat && data?.driver_lng) {
        setDriverPos({ lat: data.driver_lat, lng: data.driver_lng });
      }
    };
    fetchInitial();

    const channel = supabase
      .channel(`track-${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${orderId}`,
      }, (payload: any) => {
        if (payload.new.driver_lat && payload.new.driver_lng) {
          setDriverPos({ lat: payload.new.driver_lat, lng: payload.new.driver_lng });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const center = driverPos || customerPos || { lat: -29.12, lng: 26.22 };

  return (
    <div className="h-48 w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter lat={center.lat} lng={center.lng} />
        {driverPos && (
          <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon}>
            <Popup>🚗 Driver location</Popup>
          </Marker>
        )}
        {customerPos && (
          <Marker position={[customerPos.lat, customerPos.lng]}>
            <Popup>📍 Delivery address</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default OrderTrackingMap;
