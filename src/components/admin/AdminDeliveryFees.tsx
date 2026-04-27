import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Truck, Save } from "lucide-react";
import { refreshServiceArea } from "@/lib/serviceArea";

interface DeliveryFees {
  inner_fee: number;
  outer_fee: number;
  inner_driver_payout: number;
  outer_driver_payout: number;
}

interface ServiceArea {
  center_lat: number;
  center_lng: number;
  inner_radius_km: number;
  outer_radius_km: number;
  inner_fee: number;
  outer_fee: number;
}

const DEFAULTS: DeliveryFees = {
  inner_fee: 65,
  outer_fee: 75,
  inner_driver_payout: 45,
  outer_driver_payout: 55,
};

const AdminDeliveryFees = () => {
  const [fees, setFees] = useState<DeliveryFees>(DEFAULTS);
  const [serviceArea, setServiceArea] = useState<ServiceArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["delivery_fees", "service_area"]);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    const df = (map["delivery_fees"] ?? {}) as Partial<DeliveryFees>;
    setFees({ ...DEFAULTS, ...df });
    setServiceArea((map["service_area"] ?? null) as unknown as ServiceArea | null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (k: keyof DeliveryFees, v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setFees((f) => ({ ...f, [k]: n }));
  };

  const save = async () => {
    if (fees.inner_driver_payout > fees.inner_fee) {
      toast.error("Inner driver payout can't exceed customer fee");
      return;
    }
    if (fees.outer_driver_payout > fees.outer_fee) {
      toast.error("Outer driver payout can't exceed customer fee");
      return;
    }
    if (fees.outer_fee < fees.inner_fee) {
      toast.error("Outer (further) fee should be ≥ inner fee");
      return;
    }
    setSaving(true);

    // 1. Save delivery_fees row (used by earnings trigger + reference)
    const { error: e1 } = await supabase
      .from("app_settings")
      .upsert({ key: "delivery_fees", value: fees as any, updated_at: new Date().toISOString() }, { onConflict: "key" });

    // 2. Keep service_area in sync (customer-facing fee comes from here at checkout)
    let e2: any = null;
    if (serviceArea) {
      const next = { ...serviceArea, inner_fee: fees.inner_fee, outer_fee: fees.outer_fee };
      const res = await supabase
        .from("app_settings")
        .upsert({ key: "service_area", value: next as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
      e2 = res.error;
      setServiceArea(next);
    }

    setSaving(false);
    if (e1 || e2) {
      toast.error(e1?.message || e2?.message || "Failed to save");
      return;
    }
    refreshServiceArea();
    toast.success("Delivery fees updated");
  };

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const innerPlatform = Math.max(0, fees.inner_fee - fees.inner_driver_payout);
  const outerPlatform = Math.max(0, fees.outer_fee - fees.outer_driver_payout);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-foreground">Delivery Fees</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Set what the customer pays and what the driver earns per zone. Driver payout is locked in
          at the moment an order is delivered.
        </p>
      </div>

      {/* Inner zone */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-foreground">Inner zone (closer)</h4>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Platform: R{innerPlatform}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Customer fee (R)</Label>
            <Input
              type="number"
              min={0}
              value={fees.inner_fee}
              onChange={(e) => update("inner_fee", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Driver payout (R)</Label>
            <Input
              type="number"
              min={0}
              value={fees.inner_driver_payout}
              onChange={(e) => update("inner_driver_payout", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Outer zone */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-foreground">Outer zone (further)</h4>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            Platform: R{outerPlatform}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Customer fee (R)</Label>
            <Input
              type="number"
              min={0}
              value={fees.outer_fee}
              onChange={(e) => update("outer_fee", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Driver payout (R)</Label>
            <Input
              type="number"
              min={0}
              value={fees.outer_driver_payout}
              onChange={(e) => update("outer_driver_payout", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save delivery fees"}
      </Button>
    </div>
  );
};

export default AdminDeliveryFees;
