import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { summarizeDriver, type PerformanceOrder } from "@/lib/performanceReports";
import { Banknote, CheckCircle2, Clock3, PackageCheck, XCircle } from "lucide-react";
type Range = 7 | 30 | 90;
export default function DriverPerformance({ driverId }: { driverId: string }) {
  const [range,setRange]=useState<Range>(30); const [orders,setOrders]=useState<PerformanceOrder[]>([]); const [payouts,setPayouts]=useState<number[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ let active=true; (async()=>{setLoading(true); const since=new Date(Date.now()-range*86400000).toISOString(); const [{data:o},{data:e}] = await Promise.all([
    supabase.from("orders").select("id,total,subtotal,delivery_fee,tip,status,created_at,delivered_at,accepted_at,picked_up_at").eq("driver_id",driverId).gte("created_at",since),
    supabase.from("driver_earnings").select("driver_payout,created_at").eq("driver_id",driverId).gte("created_at",since)
  ]); if(active){setOrders((o??[]) as PerformanceOrder[]); setPayouts((e??[]).map((x:any)=>Number(x.driver_payout||0))); setLoading(false);}})(); return()=>{active=false};},[driverId,range]);
  const s=useMemo(()=>summarizeDriver(orders,payouts),[orders,payouts]);
  const cards=[["Deliveries",s.delivered,PackageCheck],["Earnings",`R${s.earnings.toFixed(2)}`,Banknote],["Completion",`${s.completionRate.toFixed(0)}%`,CheckCircle2],["Cancelled/rejected",`${s.cancellationRate.toFixed(0)}%`,XCircle],["Avg order time",s.avgDeliveryMinutes?`${Math.round(s.avgDeliveryMinutes)} min`:"—",Clock3]] as const;
  return <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-lg">My performance</h2><p className="text-sm text-muted-foreground">Delivery activity and earnings.</p></div><div className="flex gap-1">{([7,30,90] as Range[]).map(d=><Button key={d} size="sm" variant={range===d?"default":"outline"} onClick={()=>setRange(d)}>{d}d</Button>)}</div></div>{loading?<p className="text-sm text-muted-foreground">Loading report…</p>:<div className="grid grid-cols-2 gap-3">{cards.map(([l,v,I])=><Card key={l}><CardContent className="p-4"><I className="h-4 w-4 text-primary mb-2"/><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></CardContent></Card>)}</div>}</div>
}
