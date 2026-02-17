import { Truck, Clock, CreditCard } from "lucide-react";
import { storeInfo } from "@/data/menu";

const HeroBanner = () => {
  return (
    <section className="gradient-hero border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          Delivering your <span className="text-primary">cravings</span>
          <br />
          straight to your door 🔥
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Order from KFC, McDonald's, Debonnairs, Pedros, Burger King & more — all delivered across {storeInfo.areas}.
        </p>

        <div className="mt-5 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 shadow-card">
            <Truck className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-card-foreground">
              Delivery: {storeInfo.currency}{storeInfo.deliveryCharge}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 shadow-card">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-card-foreground">
              Min: {storeInfo.currency}{storeInfo.minimumOrder}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 shadow-card">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-card-foreground">
              Delivery Only
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
