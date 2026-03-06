import { DollarSign, Package, TrendingUp, Calendar } from "lucide-react";

interface Order {
  id: string;
  order_number: number;
  restaurant: string;
  delivery_fee: number;
  created_at: string;
  total: number;
  customer_address: string;
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
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const todaysOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfToday);
  const weekOrders = completedOrders.filter(o => new Date(o.created_at) >= startOfWeek);

  const todayEarnings = todaysOrders.reduce((sum, o) => sum + o.delivery_fee, 0);
  const weekEarnings = weekOrders.reduce((sum, o) => sum + o.delivery_fee, 0);

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
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--driver-warning)/0.1)] mb-2">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--driver-warning))]" />
          </div>
          <p className="text-2xl font-bold text-foreground">R{weekEarnings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground font-medium">This Week</p>
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
          <div className="rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground text-xs">Order</th>
                  <th className="py-2.5 px-3 text-left font-semibold text-muted-foreground text-xs">Restaurant</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground text-xs">Earned</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-muted-foreground text-xs hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.map(order => (
                  <tr key={order.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 px-3 font-bold text-foreground">#{order.order_number}</td>
                    <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">{order.restaurant}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[hsl(var(--driver-success))]">+R{order.delivery_fee}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground text-xs hidden sm:table-cell">
                      {new Date(order.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverEarnings;
