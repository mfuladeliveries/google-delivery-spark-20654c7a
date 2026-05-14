import { Truck, Clock, CreditCard } from "lucide-react";
import { storeInfo } from "@/data/menu";

const HeroBanner = () => {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Maroon gradient background */}
      <div className="absolute inset-0 gradient-maroon opacity-[0.06]" />
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <h2 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          Delivering your <span className="text-primary">cravings</span>
          <br />
          straight to your door <span className="text-gold">✦</span>
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Order from KFC, McDonald's, Debonnairs, Pedros, Burger King & more — all delivered across{" "}
          {storeInfo.areas}.
        </p>

        <div className="mt-5 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-xl glass px-4 py-2 shadow-luxury">
            <Truck className="h-4 w-4 text-gold" />
            <span className="text-xs font-medium text-card-foreground">
              Delivery: {storeInfo.currency}
              {storeInfo.deliveryCharge}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl glass px-4 py-2 shadow-luxury">
            <CreditCard className="h-4 w-4 text-gold" />
            <span className="text-xs font-medium text-card-foreground">
              Min: {storeInfo.currency}
              {storeInfo.minimumOrder}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl glass px-4 py-2 shadow-luxury">
            <Clock className="h-4 w-4 text-gold" />
            <span className="text-xs font-medium text-card-foreground">Delivery Only</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
