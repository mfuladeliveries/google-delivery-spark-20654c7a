import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export default function SteersProductImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const illustrative = src.includes("illustrative-");
  return <div className="relative h-full w-full bg-muted">
    {src && !failed ? <img src={src} alt={`${name}${illustrative ? " — illustrative image, not actual product" : ""}`} width={512} height={512} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} /> : <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground"><ImageOff className="h-5 w-5" /><span className="text-[9px]">Photo pending</span></div>}
    {illustrative && !failed && <span className="absolute bottom-0 inset-x-0 bg-card/95 py-0.5 text-center text-[9px] text-muted-foreground">Illustration</span>}
  </div>;
}