import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { summarizeOrders, type PerformanceOrder } from "@/lib/performanceReports";
import { BarChart3, CheckCircle2, Clock3, Receipt, XCircle } from "lucide-react";

type Range = 7 | 30 | 90;
export default function RestaurantPerformance({ restaurantId }: { restaurantId: string }) {
  const [range, setRange] = useState<Range>(30);
  const [orders, setOrders] = useState<PerformanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - range * 86400000).toISOString();
      const { data } = await supabase.from("orders").select("id,total,subtotal,delivery_fee,tip,status,created_at,delivered_at,accepted_at,picked_up_at").eq("restaurant_id", restaurantId).gte("created_at", since);
      if (active) { setOrders((data ?? []) as PerformanceOrder[]); setLoading(false); }
    })();
    return () => { active = false; };
  }, [restaurantId, range]);
  const s = useMemo(() => summarizeOrders(orders), [orders]);
  const cards = [
    ["Orders", s.totalOrders, Receipt], ["Delivered", s.delivered, CheckCircle2],
    ["Revenue", `R${s.revenue.toFixed(2)}`, BarChart3], ["Avg order", `R${s.avgOrderValue.toFixed(2)}`, Receipt],
    ["Completion", `${s.completionRate.toFixed(0)}%`, CheckCircle2], ["Cancelled", `${s.cancellationRate.toFixed(0)}%`, XCircle],
    ["Avg delivery", s.avgDeliveryMinutes ? `${Math.round(s.avgDeliveryMinutes)} min` : "—", Clock3],
  ] as const;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Performance</h2><p className="text-sm text-muted-foreground">Restaurant results and service quality.</p></div><div className="flex gap-1">{([7,30,90] as Range[]).map(d => <Button key={d} size="sm" variant={range===d?"default":"outline"} onClick={()=>setRange(d)}>{d}d</Button>)}</div></div>
    {loading ? <p className="text-sm text-muted-foreground">Loading report…</p> : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map(([label,value,Icon]) => <Card key={label}><CardContent className="p-4"><Icon className="h-4 w-4 text-primary mb-2"/><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>)}</div>}
  </div>;
}
