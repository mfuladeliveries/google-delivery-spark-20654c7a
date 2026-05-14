import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { storeInfo } from "@/data/menu";
import { ArrowDownLeft, ArrowUpRight, History, ChevronDown, ChevronUp } from "lucide-react";

interface Tx {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  order_id: string | null;
  created_at: string;
}

interface OrderRef {
  id: string;
  order_number: number;
}

const kindLabel: Record<string, string> = {
  refund: "Refund credited",
  spend: "Applied to order",
  adjustment: "Adjustment",
};

const WalletHistory = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [orderMap, setOrderMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, kind, note, order_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data || []) as Tx[];
      setTxs(list);

      const ids = list.map((t) => t.order_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_number")
          .in("id", ids);
        const map: Record<string, number> = {};
        (orders as OrderRef[] | null)?.forEach((o) => {
          map[o.id] = o.order_number;
        });
        setOrderMap(map);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`wallet-tx-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const visible = expanded ? txs : txs.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 font-bold text-sm text-foreground">
          <History className="h-4 w-4 text-primary" /> Wallet History
        </h2>
        {txs.length > 5 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show all ({txs.length}) <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : txs.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground">
          <History className="mx-auto h-7 w-7 opacity-40 mb-2" />
          <p className="text-xs">No wallet activity yet</p>
          <p className="text-[10px] mt-0.5">Refunds and credit usage will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((tx) => {
            const credit = tx.amount > 0;
            const orderNum = tx.order_id ? orderMap[tx.order_id] : null;
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      credit ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {credit ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {kindLabel[tx.kind] || tx.kind}
                      {orderNum && (
                        <span className="text-muted-foreground font-normal"> · #{orderNum}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {new Date(tx.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-bold shrink-0 ${credit ? "text-green-600" : "text-foreground"}`}
                >
                  {credit ? "+" : "−"}
                  {storeInfo.currency}
                  {Math.abs(tx.amount).toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WalletHistory;
