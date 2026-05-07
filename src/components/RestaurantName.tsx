import { cn } from "@/lib/utils";

interface RestaurantNameProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
  className?: string;
  /** Force light text (used over dark image overlays) */
  onDark?: boolean;
}

// Sizes follow the spec:
// sm 16px → search results & order history
// md 18px → horizontal reorder cards
// lg 20px → standard home cards
// xl 24px → featured cards
// 2xl 28px → menu page hero header
const sizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
  "2xl": "text-[28px] leading-tight",
};

/**
 * Branded restaurant-name styling used everywhere a restaurant is named.
 * Orange Mfula primary, extra-bold, tightened letter-spacing, soft glow.
 */
export const RestaurantName = ({
  name,
  size = "lg",
  as: Tag = "h3",
  className,
  onDark = false,
}: RestaurantNameProps) => {
  return (
    <Tag
      className={cn(
        sizes[size],
        "font-extrabold tracking-[-0.3px]",
        onDark ? "text-gold" : "text-primary",
        "[text-shadow:0_1px_3px_hsl(345_100%_18%/0.2)]",
        className,
      )}
    >
      {name}
    </Tag>
  );
};

export default RestaurantName;
