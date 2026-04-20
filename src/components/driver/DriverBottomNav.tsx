import { Briefcase, DollarSign, UserCircle, Wallet } from "lucide-react";

type DriverTab = "orders" | "earnings" | "withdraw" | "profile";

interface DriverBottomNavProps {
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  jobCount?: number;
  activeCount?: number;
}

const tabs = [
  { id: "orders" as DriverTab, icon: Briefcase, label: "Orders" },
  { id: "earnings" as DriverTab, icon: DollarSign, label: "Earnings" },
  { id: "withdraw" as DriverTab, icon: Wallet, label: "Withdraw" },
  { id: "profile" as DriverTab, icon: UserCircle, label: "Profile" },
];

const DriverBottomNav = ({ activeTab, onTabChange, jobCount = 0, activeCount = 0 }: DriverBottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl shadow-lg md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          const badge = id === "orders" ? jobCount + activeCount : 0;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-semibold">{label}</span>
              {badge > 0 && (
                <span className="absolute -top-0.5 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default DriverBottomNav;
