import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { detectZone, type DeliveryZone } from "@/lib/zones";

interface UseDeliveryZoneResult {
  loading: boolean;
  address: string | null;
  zone: DeliveryZone | null;
  /** True when we've checked: user logged in, address is set, but it doesn't match any zone. */
  outsideZone: boolean;
  /** True when user is logged in but has no saved address yet. */
  needsAddress: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads the customer's saved delivery address and resolves it to a zone.
 * Used by the home page banner and to gate Add to Cart.
 */
export const useDeliveryZone = (): UseDeliveryZoneResult => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setAddress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("address")
      .eq("user_id", user.id)
      .maybeSingle();
    setAddress((data?.address ?? "").trim() || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const zone = detectZone(address);
  const needsAddress = !!user && !loading && !address;
  const outsideZone = !!user && !loading && !!address && !zone;

  return { loading: authLoading || loading, address, zone, outsideZone, needsAddress, refresh: load };
};
