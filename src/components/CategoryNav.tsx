import { categories } from "@/data/menu";

interface CategoryNavProps {
  selected: string;
  onSelect: (cat: string) => void;
}

const CategoryNav = ({ selected, onSelect }: CategoryNavProps) => {
  return (
    <div className="sticky top-[61px] z-40 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="scrollbar-hide mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              selected === cat
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryNav;
