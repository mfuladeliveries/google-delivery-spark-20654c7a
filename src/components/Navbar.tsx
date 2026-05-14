import {
  ShoppingCart,
  MapPin,
  User,
  LogOut,
  ClipboardList,
  ChefHat,
  Truck,
  Shield,
  Menu,
  X,
  Search,
} from "lucide-react";
import { storeInfo } from "@/data/menu";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

interface NavbarProps {
  cartCount?: number;
  onCartClick?: () => void;
}

const Navbar = ({ cartCount, onCartClick }: NavbarProps) => {
  const { user, signOut, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/search", label: "Search" },
    ...(user ? [{ to: "/orders", label: "My Orders" }] : []),
  ];

  const roleLinks: Record<string, { to: string; icon: any; label: string }> = {
    restaurant: { to: "/restaurant/dashboard", icon: ChefHat, label: "Dashboard" },
    driver: { to: "/driver", icon: Truck, label: "Driver" },
    admin: { to: "/admin", icon: Shield, label: "Admin" },
  };

  const roleLink = role && role !== "customer" ? roleLinks[role] : null;

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div>
            <h1 className="font-display text-base font-bold text-foreground leading-tight">
              {storeInfo.name}
            </h1>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              <span>{storeInfo.areas}</span>
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {roleLink && (
            <Link
              to={roleLink.to}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(roleLink.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <roleLink.icon className="h-4 w-4" />
              {roleLink.label}
            </Link>
          )}
          {user ? (
            <>
              <Link
                to="/profile"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive("/profile")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <User className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </nav>

        {/* Right side: cart + mobile menu */}
        <div className="flex items-center gap-2">
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {roleLink && (
            <Link
              to={roleLink.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(roleLink.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <roleLink.icon className="h-4 w-4" />
              {roleLink.label}
            </Link>
          )}
          {user ? (
            <>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={() => {
                  signOut();
                  setMobileOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <User className="h-4 w-4" />
              Sign In
            </Link>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
