import { useEffect, useState } from "react";
import placeholder from "@/assets/kfc-menu-placeholder.jpg";

interface KfcProductImageProps {
  src: string;
  name: string;
}

/** KFC-only image presentation; never substitute a different food product. */
export default function KfcProductImage({ src, name }: KfcProductImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const isPlaceholder = failed || !src || src.includes("menu-placeholder-v1.jpg");

  return (
    <img
      src={isPlaceholder ? placeholder : src}
      alt={isPlaceholder ? `${name} — product photo unavailable` : name}
      width={768}
      height={768}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}