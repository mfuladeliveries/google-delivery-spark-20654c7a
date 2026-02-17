import { ShoppingCart, MapPin, User, LogOut, ClipboardList } from "lucide-react";
import { storeInfo } from "@/data/menu";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface HeaderProps {
  cartCount: number;
  onCartClick: () => void;
}

const Header = ({ cartCount, onCartClick }: HeaderProps) => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30"
          />
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">
              {storeInfo.name}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{storeInfo.areas}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                to="/orders"
                className="rounded-xl bg-secondary p-2.5 text-secondary-foreground transition-transform hover:scale-105 active:scale-95"
                title="My Orders"
              >
                <ClipboardList className="h-5 w-5" />
              </Link>
              <button
                onClick={signOut}
                className="rounded-xl bg-secondary p-2.5 text-secondary-foreground transition-transform hover:scale-105 active:scale-95"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-xl bg-secondary p-2.5 text-secondary-foreground transition-transform hover:scale-105 active:scale-95"
              title="Sign In"
            >
              <User className="h-5 w-5" />
            </Link>
          )}
          <button
            onClick={onCartClick}
            className="relative rounded-xl bg-primary p-2.5 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
