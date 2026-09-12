import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  detectOrderIncidents,
  countBySeverity,
  type Incident,
  type IncidentOrder,
} from "@/lib/incidents";

const tone: Record<Incident["severity"], string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  medium: "bg-muted text-muted-foreground border-border",
};

/** Live alert strip for launch-critical order problems, shown on the admin dashboard. */
const AdminAlertsBanner = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
    const { data } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,payment_method,created_at,picked_up_at,cancelled_at,driver_id,restaurant,total,subtotal,tax,delivery_fee,tip,discount_amount,refund_status,refund_method,refund_amount",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    setIncidents(detectOrderIncidents((data ?? []) as IncidentOrder[]));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const counts = countBySeverity(incidents);
  const top = incidents.slice(0, 4);

  if (!incidents.length) {
    return (
      <Card className="mb-4 flex items-center gap-2 border-emerald-500/30 bg-emerald-500/10 p-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <p className="text-xs font-bold text-emerald-500">No order problems right now</p>
        <Button size="sm" variant="ghost" className="ml-auto" asChild>
          <Link to="/admin/incidents">Open recovery</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-4 space-y-2 border-destructive/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <p className="text-xs font-bold">Order alerts</p>
        {counts.critical > 0 && (
          <Badge variant="outline" className={`text-[10px] ${tone.critical}`}>
            {counts.critical} critical
          </Badge>
        )}
        {counts.high > 0 && (
          <Badge variant="outline" className={`text-[10px] ${tone.high}`}>
            {counts.high} high
          </Badge>
        )}
        {counts.medium > 0 && (
          <Badge variant="outline" className={`text-[10px] ${tone.medium}`}>
            {counts.medium} watch
          </Badge>
        )}
        <Button size="sm" variant="outline" className="ml-auto" asChild>
          <Link to="/admin/incidents">View all</Link>
        </Button>
      </div>
      <ul className="space-y-1">
        {top.map((i) => (
          <li key={i.key} className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="outline" className={`text-[9px] ${tone[i.severity]}`}>
              {i.severity}
            </Badge>
            <span className="font-medium">{i.title}</span>
            <span className="text-muted-foreground">{i.detail}</span>
            {i.orderNumber != null && (
              <Link
                to={`/admin/support?q=${i.orderNumber}`}
                className="ml-auto font-bold text-primary hover:underline"
              >
                Open order
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default AdminAlertsBanner;
