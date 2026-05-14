import { storeInfo } from "@/data/menu";

interface AuthLoadingScreenProps {
  label?: string;
}

const AuthLoadingScreen = ({ label }: AuthLoadingScreenProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="rounded-3xl bg-primary/10 p-3 ring-2 ring-gold/20 shadow-luxury">
          <img
            src={storeInfo.logo}
            alt=""
            aria-hidden="true"
            className="h-16 w-16 rounded-2xl object-cover"
          />
        </div>
        <div className="h-8 w-8 luxury-pulse rounded-full border-[3px] border-primary border-t-gold" />
        {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
};

export default AuthLoadingScreen;
