import { Link } from "react-router-dom";
import { ShoppingBag, Truck, ArrowRight } from "lucide-react";
import { storeInfo } from "@/data/menu";

const GetApp = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary px-6 py-10">
      {/* Logo */}
      <div className="mb-6 text-center">
        <img
          src={storeInfo.logo}
          alt={storeInfo.name}
          className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-[hsl(var(--gold))] shadow-gold"
        />
        <h1 className="mt-4 font-display text-2xl font-bold text-primary">
          {storeInfo.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get the app on your phone
        </p>
      </div>

      {/* Role cards */}
      <div className="w-full max-w-sm space-y-4">
        <Link
          to="/install/customer"
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">I want to order food</p>
            <p className="text-xs text-muted-foreground">Customer App</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>

        <Link
          to="/install/driver"
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">I want to deliver orders</p>
            <p className="text-xs text-muted-foreground">Driver App</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs">
        Tap your option above and follow the steps to add the app to your home screen.
      </p>
    </div>
  );
};

export default GetApp;
