import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Phone, User } from "lucide-react";

interface DriverInfoCardProps {
  driverId: string;
}

interface DriverInfo {
  full_name: string;
  contact_number: string;
  vehicle_type: string;
  license_plate: string;
}

const DriverInfoCard = ({ driverId }: DriverInfoCardProps) => {
  const [info, setInfo] = useState<DriverInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [{ data: prof }, { data: drv }] = await Promise.all([
        supabase.from("profiles").select("full_name, contact_number").eq("user_id", driverId).maybeSingle(),
        supabase.from("driver_profiles").select("vehicle_type, license_plate").eq("user_id", driverId).maybeSingle(),
      ]);
      if (!mounted) return;
      setInfo({
        full_name: prof?.full_name || "Your driver",
        contact_number: prof?.contact_number || "",
        vehicle_type: drv?.vehicle_type || "",
        license_plate: drv?.license_plate || "",
      });
    };
    load();
    return () => {
      mounted = false;
    };
  }, [driverId]);

  if (!info) return null;

  const initials =
    info.full_name
      .split(" ")
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "D";

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-primary" />
          <p className="truncate text-sm font-bold text-foreground">{info.full_name}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {info.vehicle_type && (
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3 w-3" />
              {info.vehicle_type}
              {info.license_plate && ` · ${info.license_plate}`}
            </span>
          )}
        </div>
      </div>
      {info.contact_number && (
        <a
          href={`tel:${info.contact_number}`}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          aria-label="Call driver"
        >
          <Phone className="h-3.5 w-3.5" />
          Call
        </a>
      )}
    </div>
  );
};

export default DriverInfoCard;
