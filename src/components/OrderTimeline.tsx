import { Clock, Store, ChefHat, Package, UserCheck, Bike, Truck, CheckCircle, type LucideIcon } from "lucide-react";

interface OrderTimings {
  created_at?: string | null;
  accepted_at?: string | null;
  picking_up_at?: string | null;
  arrived_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
}

interface OrderTimelineProps {
  status: string;
  timings: OrderTimings;
}

interface Step {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Which order timestamp marks completion of this step. */
  ts: keyof OrderTimings | null;
}

// 8-stage flow exactly as requested
const steps: Step[] = [
  { key: "pending", label: "Order Placed", icon: Clock, ts: "created_at" },
  { key: "confirmed", label: "Accepted", icon: Store, ts: null },
  { key: "preparing", label: "Preparing", icon: ChefHat, ts: null },
  { key: "ready", label: "Ready", icon: Package, ts: null },
  { key: "driver_assigned", label: "Driver Assigned", icon: UserCheck, ts: "accepted_at" },
  { key: "picking_up", label: "Heading to Restaurant", icon: Bike, ts: "picking_up_at" },
  { key: "arrived_at_restaurant", label: "At Restaurant", icon: Store, ts: "arrived_at" },
  { key: "out_for_delivery", label: "On the Way", icon: Truck, ts: "picked_up_at" },
  { key: "delivered", label: "Delivered", icon: CheckCircle, ts: "delivered_at" },
];

const formatTs = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const OrderTimeline = ({ status, timings }: OrderTimelineProps) => {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === status));

  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const completed = i < currentIdx;
        const current = i === currentIdx;
        const ts = step.ts ? timings[step.ts] : null;

        return (
          <li key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                  current
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110"
                    : completed
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {i < steps.length - 1 && (
                <div className={`h-5 w-0.5 ${i < currentIdx ? "bg-primary/40" : "bg-muted"}`} />
              )}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold ${
                    current ? "text-primary" : completed ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                  {current && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  )}
                </span>
                {ts && (
                  <span className="font-mono text-[10px] text-muted-foreground">{formatTs(ts)}</span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderTimeline;
