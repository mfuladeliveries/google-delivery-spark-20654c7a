import { Home, Search, ShoppingBag, User, ChefHat, Truck, Shield } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const BottomNav = () => {
  const location = useLocation();
  const { user, role } = useAuth();
  const path = location.pathname;

  const customerLinks = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/orders", icon: ShoppingBag, label: "Orders" },
    { to: user ? "/profile" : "/auth", icon: User, label: user ? "Profile" : "Login" },
  ];

  const restaurantLinks = [
    { to: "/restaurant/dashboard", icon: ChefHat, label: "Dashboard" },
    { to: "/restaurant/orders", icon: ShoppingBag, label: "Orders" },
    { to: "/restaurant/menu", icon: Home, label: "Menu" },
    { to: user ? "/profile" : "/auth", icon: User, label: "Profile" },
  ];

  const driverLinks = [
    { to: "/driver", icon: Truck, label: "Driver" },
    { to: user ? "/profile" : "/auth", icon: User, label: "Profile" },
  ];

  const adminLinks = [
    { to: "/admin", icon: Shield, label: "Admin" },
    { to: user ? "/profile" : "/auth", icon: User, label: "Profile" },
  ];

  let links = customerLinks;
  if (role === 'restaurant') links = restaurantLinks;
  else if (role === 'driver') links = driverLinks;
  else if (role === 'admin') links = adminLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 glass-dark shadow-lg md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {links.map(({ to, icon: Icon, label }) => {
          const active = path === to || (to !== "/" && path.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                active
                  ? "text-gold scale-105"
                  : "text-muted-foreground hover:text-primary-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
