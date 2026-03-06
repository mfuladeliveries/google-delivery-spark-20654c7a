import { DollarSign, Package, TrendingUp, Calendar, MapPin, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Order {
  id: string;
  order_number: number;
  restaurant: string;
  delivery_fee: number;
  created_at: string;
  total: number;
  customer_address: string;
  status?: string;
}

interface DriverProfile {
  is_online: boolean;
  total_earnings: number;
  total_deliveries: number;
}

interface DriverEarningsProps {
  driverProfile: DriverProfile | null;
  completedOrders: Order[];
}

const DriverEarnings = ({ driverProfile, completedOrders }: DriverEarningsProps) => {
  const [showAll, setShowAll] = useState(false);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const todaysOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfToday);
  const weekOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfWeek);

  const todayEarnings = todaysOrders.reduce((sum, o) => sum + o.delivery_fee, 0);
  const weekEarnings = weekOrders.reduce((sum, o) => sum + o.delivery_fee, 0);

  const displayedOrders = showAll ? completedOrders : completedOrders.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--driver-success)/0.1)] mb-2">
            <DollarSign className="h-5 w-5 text-[hsl(var(--driver-success))]" />
          </div>
          <p className="text-2xl font-bold text-foreground">R{todayEarnings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground font-medium">Today's Earnings</p>
          <p className="text-[10px] text-muted-foreground">{todaysOrders.length} deliveries</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--driver-warning)/0.1)] mb-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--driver-warning))]" />
          </div>
          <p className="text-2xl font-bold text-foreground">R{weekEarnings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground font-medium">This Week</p>
          <p className="text-[10px] text-muted-foreground">{weekOrders.length} deliveries</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-2">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">R{(driverProfile?.total_earnings || 0).toFixed(0)}</p>
          <p className="text-xs text-muted-foreground font-medium">Total Earnings</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--driver-info)/0.1)] mb-2">
            <Package className="h-5 w-5 text-[hsl(var(--driver-info))]" />
          </div>
          <p className="text-2xl font-bold text-foreground">{driverProfile?.total_deliveries || 0}</p>
          <p className="text-xs text-muted-foreground font-medium">Total Deliveries</p>
        </div>
      </div>

      {/* Earnings rate info */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3">
        <p className="text-xs text-muted-foreground">
          💡 <span className="font-semibold text-foreground">Earnings rate:</span> R30/km base + bonus for urgent deliveries
        </p>
      </div>

      {/* Delivery history */}
      <div>
        <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Delivery History
        </h3>

        {completedOrders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="font-semibold">No completed deliveries yet</p>
            <p className="text-sm mt-1">Complete deliveries to see your history</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {displayedOrders.map(order => (
                <div key={order.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--driver-success)/0.1)] shrink-0">
                    <Package className="h-4 w-4 text-[hsl(var(--driver-success))]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                      <span className="text-sm font-bold text-[hsl(var(--driver-success))]">+R{order.delivery_fee}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">{order.restaurant}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5 flex items-center gap-0.5">
                      <MapPin className="h-3 w-3 shrink-0" /> {order.customer_address}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {completedOrders.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-3 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-1"
              >
                {showAll ? <><ChevronUp className="h-3 w-3" /> Show Less</> : <><ChevronDown className="h-3 w-3" /> Show All ({completedOrders.length})</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverEarnings;
