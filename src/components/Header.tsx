import { ShoppingCart, MapPin, User, LogOut, ClipboardList, ChefHat, Truck, Shield, Menu, Wallet } from "lucide-react";
import { storeInfo } from "@/data/menu";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerCredits } from "@/hooks/useCustomerCredits";
import { Link, useNavigate } from "react-router-dom";

interface HeaderProps {
  cartCount?: number;
  onCartClick?: () => void;
  title?: string;
}

const Header = ({ cartCount, onCartClick, title }: HeaderProps) => {
  const { user, signOut, role } = useAuth();
  const { balance: walletBalance } = useCustomerCredits();
  const navigate = useNavigate();

  const roleLinks = {
    restaurant: { to: "/restaurant/dashboard", icon: ChefHat, label: "Dashboard" },
    driver: { to: "/driver", icon: Truck, label: "Job Board" },
    admin: { to: "/admin", icon: Shield, label: "Admin" },
  };

  const roleLink = role && role !== 'customer' ? roleLinks[role as keyof typeof roleLinks] : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div>
            <h1 className="font-display text-base font-bold text-foreground leading-tight">
              {title || storeInfo.name}
            </h1>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              <span>{storeInfo.areas}</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {roleLink && (
              <Link
                to={roleLink.to}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <roleLink.icon className="h-4 w-4" />
                {roleLink.label}
              </Link>
            )}
            {user && (
              <Link
                to="/orders"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                My Orders
              </Link>
            )}
            {user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <User className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>

          {user && walletBalance > 0 && (
            <Link
              to="/profile"
              className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-2 text-xs font-bold text-primary transition-transform hover:scale-105 active:scale-95"
              title="Wallet balance"
            >
              <Wallet className="h-4 w-4" />
              <span>{storeInfo.currency}{walletBalance.toFixed(0)}</span>
            </Link>
          )}

          {onCartClick !== undefined && (
            <button
              onClick={onCartClick}
              className="relative rounded-xl bg-primary px-3 py-2 text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-orange flex items-center gap-1.5"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount !== undefined && cartCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] font-bold text-primary">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
