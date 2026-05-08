import { Plus } from "lucide-react";
import { MenuItem, storeInfo } from "@/data/menu";

interface MenuCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

const MenuCard = ({ item, onAdd }: MenuCardProps) => {
  return (
    <div data-testid="menu-card" data-menu-item-id={item.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:border-primary/30 hover:shadow-glow">
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.image ? (
          <img
            src={item.image}
            alt={item.caption}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-2xl text-muted-foreground/40">🍽️</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <span className="mb-1 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          {item.category}
        </span>
        <h3 className="font-display text-sm font-semibold leading-tight text-card-foreground">
          {item.name}
        </h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {item.caption}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-primary">
            {storeInfo.currency}{item.price}
          </span>
          <button
            onClick={() => onAdd(item)}
            data-testid="menu-add-button"
            className="btn-glow rounded-xl gradient-maroon p-2 text-primary-foreground transition-transform hover:scale-110 active:scale-95"
            aria-label={`Add ${item.name} to cart`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuCard;
