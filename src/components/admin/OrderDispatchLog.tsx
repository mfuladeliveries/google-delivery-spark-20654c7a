import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  id: string;
  driver_id: string | null;
  round: number;
  event: string;
  created_at: string;
  driver_name?: string | null;
}

const eventStyles: Record<string, string> = {
  offered: "bg-blue-100 text-blue-700",
  timeout: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  accepted: "bg-emerald-100 text-emerald-700",
  round_complete: "bg-purple-100 text-purple-700",
  no_drivers: "bg-muted text-muted-foreground",
};

const eventLabels: Record<string, string> = {
  offered: "Offered",
  timeout: "Timed out",
  rejected: "Rejected",
  accepted: "Accepted",
  round_complete: "Round complete",
  no_drivers: "No drivers",
};

export const OrderDispatchLog = ({ orderId }: { orderId: string }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    const fetchRows = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("order_dispatch_log" as any)
        .select("id, driver_id, round, event, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      const logRows = ((data as any[]) || []) as LogRow[];

      const driverIds = Array.from(
        new Set(logRows.map((r) => r.driver_id).filter(Boolean)),
      ) as string[];
      let nameMap = new Map<string, string>();
      if (driverIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", driverIds);
        nameMap = new Map((profs || []).map((p) => [p.user_id, p.full_name || "Driver"]));
      }
      if (!alive) return;
      setRows(
        logRows.map((r) => ({
          ...r,
          driver_name: r.driver_id ? nameMap.get(r.driver_id) || "Driver" : null,
        })),
      );
      setLoading(false);
    };

    fetchRows();
    const ch = supabase
      .channel(`dispatch-log-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_dispatch_log", filter: `order_id=eq.${orderId}` },
        fetchRows,
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [open, orderId]);

  const rounds = rows.length > 0 ? Math.max(...rows.map((r) => r.round)) : 0;
  const accepted = rows.find((r) => r.event === "accepted");
  const rejectedCount = rows.filter((r) => r.event === "rejected").length;
  const offeredCount = rows.filter((r) => r.event === "offered").length;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-semibold text-primary hover:underline"
      >
        {open ? "Hide" : "View"} assignment log
        {rounds > 0 && (
          <span className="ml-1 text-muted-foreground">
            (round {rounds} · {offeredCount} offered · {rejectedCount} rejected
            {accepted ? " · accepted" : ""})
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 rounded-lg border border-border bg-background/60 p-2">
          {loading ? (
            <p className="text-[10px] text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">No dispatch events yet.</p>
          ) : (
            <ul className="space-y-0.5 text-[10px]">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(r.created_at).toLocaleTimeString("en-ZA", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold">R{r.round}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-bold ${eventStyles[r.event] || "bg-muted text-muted-foreground"}`}
                  >
                    {eventLabels[r.event] || r.event}
                  </span>
                  {r.driver_name && <span className="text-foreground">{r.driver_name}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderDispatchLog;
