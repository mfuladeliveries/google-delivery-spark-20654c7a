import { Link } from "react-router-dom";
import { Home, Truck, ChefHat, Shield, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "customer" | "restaurant" | "driver";

const APP_LINKS: Record<
  AppRole,
  { to: string; label: string; icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  customer: { to: "/", label: "Customer App", icon: Home, tint: "bg-primary/10 text-primary" },
  driver: {
    to: "/driver",
    label: "Driver App",
    icon: Truck,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  restaurant: {
    to: "/restaurant/dashboard",
    label: "Restaurant Dashboard",
    icon: ChefHat,
    tint: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  admin: {
    to: "/admin",
    label: "Admin Console",
    icon: Shield,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

const ORDER: AppRole[] = ["customer", "driver", "restaurant", "admin"];

const AppSwitcher = () => {
  const { roles } = useAuth();

  // Only render when the user has access to more than one app
  if (!roles || roles.length < 2) return null;

  const visible = ORDER.filter((r) => roles.includes(r));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-3 font-bold text-sm text-foreground">Switch App</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        You have access to multiple apps. Tap to jump to the one you need.
      </p>
      <div className="space-y-2">
        {visible.map((r) => {
          const { to, label, icon: Icon, tint } = APP_LINKS[r];
          return (
            <Link
              key={r}
              to={to}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AppSwitcher;
