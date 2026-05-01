import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SavedAddress {
  id: string;
  user_id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  area_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedAddressInput {
  label: string;
  address: string;
  lat: number;
  lng: number;
  area_id?: string | null;
  is_default?: boolean;
}

interface UseCustomerAddressesResult {
  addresses: SavedAddress[];
  defaultAddress: SavedAddress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  add: (input: SavedAddressInput) => Promise<SavedAddress | null>;
  update: (id: string, patch: Partial<SavedAddressInput>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  setDefault: (id: string) => Promise<boolean>;
}

/**
 * Saved delivery-address book for the signed-in customer.
 * One default per user is enforced by a DB trigger.
 */
export const useCustomerAddresses = (): UseCustomerAddressesResult => {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setAddresses((data ?? []) as SavedAddress[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const add = useCallback(
    async (input: SavedAddressInput) => {
      if (!user) return null;
      const { data, error: err } = await supabase
        .from("customer_addresses")
        .insert({
          user_id: user.id,
          label: input.label.trim() || "Home",
          address: input.address.trim(),
          lat: input.lat,
          lng: input.lng,
          area_id: input.area_id ?? null,
          is_default: input.is_default ?? false,
        })
        .select("*")
        .single();
      if (err) {
        setError(err.message);
        return null;
      }
      await refresh();
      return data as SavedAddress;
    },
    [user, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<SavedAddressInput>) => {
      if (!user) return false;
      const { error: err } = await supabase
        .from("customer_addresses")
        .update({
          ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
          ...(patch.address !== undefined ? { address: patch.address.trim() } : {}),
          ...(patch.lat !== undefined ? { lat: patch.lat } : {}),
          ...(patch.lng !== undefined ? { lng: patch.lng } : {}),
          ...(patch.area_id !== undefined ? { area_id: patch.area_id } : {}),
          ...(patch.is_default !== undefined ? { is_default: patch.is_default } : {}),
        })
        .eq("id", id)
        .eq("user_id", user.id);
      if (err) {
        setError(err.message);
        return false;
      }
      await refresh();
      return true;
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!user) return false;
      const { error: err } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (err) {
        setError(err.message);
        return false;
      }
      await refresh();
      return true;
    },
    [user, refresh],
  );

  const setDefault = useCallback(
    async (id: string) => update(id, { is_default: true }),
    [update],
  );

  const defaultAddress = addresses.find((a) => a.is_default) ?? null;

  return {
    addresses,
    defaultAddress,
    loading: authLoading || loading,
    error,
    refresh,
    add,
    update,
    remove,
    setDefault,
  };
};
