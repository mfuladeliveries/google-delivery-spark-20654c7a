import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export default function BurgerKingProductImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img src={src} alt={name} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground"><ImageOff className="h-5 w-5" /><span className="text-[9px]">Photo pending</span></div>
  );
}