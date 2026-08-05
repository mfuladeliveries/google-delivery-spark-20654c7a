import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Radio,
  Clock,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SchedulerRun {
  id: number;
  created: string;
  status_code: number | null;
  content: string | null;
  error_msg: string | null;
}

interface DispatchLogRow {
  id: string;
  order_id: string;
  driver_id: string | null;
  round: number;
  event: string;
  created_at: string;
}

interface OrderMeta {
  id: string;
  order_number: number;
  restaurant: string;
  status: string;
  dispatch_phase: string | null;
}

const eventMeta: Record<string, { label: string; tone: string }> = {
  offer: { label: "Offered", tone: "bg-primary/15 text-primary border-primary/30" },
  offered: { label: "Offered", tone: "bg-primary/15 text-primary border-primary/30" },
  accepted: {
    label: "Accepted",
    tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  rejected: { label: "Rejected", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  timeout: { label: "Timed out", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  round_complete: { label: "Round complete", tone: "bg-muted text-muted-foreground border-border" },
  no_drivers: {
    label: "No drivers",
    tone: "bg-destructive/15 text-destructive border-destructive/30",
  },
  broadcast: { label: "Broadcast", tone: "bg-accent/20 text-accent-foreground border-border" },
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const AdminDispatchMonitor = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<SchedulerRun[]>([]);
  const [logs, setLogs] = useState<DispatchLogRow[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderMeta>>({});
  const [drivers, setDrivers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [runsRes, logsRes] = await Promise.all([
      supabase.rpc("admin_dispatch_runs", { p_limit: 60 }),
      supabase
        .from("order_dispatch_log")
        .select("id, order_id, driver_id, round, event, created_at")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    if (runsRes.error) setRunsError(runsRes.error.message);
    else {
      setRunsError(null);
      setRuns((runsRes.data as SchedulerRun[]) || []);
    }

    const logRows = (logsRes.data as DispatchLogRow[]) || [];
    setLogs(logRows);

    const orderIds = Array.from(new Set(logRows.map((l) => l.order_id)));
    if (orderIds.length) {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, restaurant, status, dispatch_phase")
        .in("id", orderIds);
      const map: Record<string, OrderMeta> = {};
      ((data as OrderMeta[]) || []).forEach((o) => (map[o.id] = o));
      setOrders(map);
    }

    const driverIds = Array.from(
      new Set(logRows.map((l) => l.driver_id).filter(Boolean) as string[]),
    );
    if (driverIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", driverIds);
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((p) => (map[p.user_id] = p.full_name));
      setDrivers(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const runTick = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("dispatch-tick", { body: {} });
    setRunning(false);
    if (error) toast.error("Scheduler run failed", { description: error.message });
    else
      toast.success("Scheduler run complete", {
        description: `Advanced ${(data as any)?.advanced ?? 0} · Broadcast ${(data as any)?.broadcasted ?? 0}`,
      });
    load();
  };

  const dispatchRuns = runs.filter((r) => !r.content || !r.content.includes("Not Found"));
  const authFailures = dispatchRuns.filter((r) => r.status_code === 401 || r.status_code === 403);
  const serverFailures = dispatchRuns.filter((r) => (r.status_code ?? 0) >= 500 || r.error_msg);
  const okRuns = dispatchRuns.filter((r) => r.status_code === 200);

  const offerLogs = logs.filter((l) => l.event === "offer" || l.event === "offered");

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Dispatch Monitor</h1>
            <p className="text-xs text-muted-foreground">
              Scheduler health, auth errors and per-tick driver offers
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={runTick} disabled={running}>
            <Play className="mr-1.5 h-4 w-4" />
            {running ? "Running…" : "Run tick"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        {/* Health summary */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Successful runs
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{okRuns.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-destructive" /> Auth errors (401/403)
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{authFailures.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-4 w-4 text-amber-400" /> Server errors
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{serverFailures.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-4 w-4 text-primary" /> Offers logged
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{offerLogs.length}</p>
          </Card>
        </section>

        {authFailures.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <ShieldAlert className="h-4 w-4" /> The scheduler is being rejected
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {authFailures.length} recent scheduled call(s) returned 401/403. Orders will not be
              offered to drivers automatically until this is resolved.
            </p>
          </Card>
        )}

        {/* Scheduler runs */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-foreground">Scheduler runs</h2>
          {runsError ? (
            <Card className="p-4 text-sm text-muted-foreground">
              Could not load scheduler runs: {runsError}
            </Card>
          ) : dispatchRuns.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">No scheduled runs recorded yet.</Card>
          ) : (
            <Card className="divide-y divide-border">
              {dispatchRuns.map((r) => {
                const isAuth = r.status_code === 401 || r.status_code === 403;
                const isErr = (r.status_code ?? 0) >= 400 || !!r.error_msg;
                return (
                  <div key={r.id} className="flex items-start gap-3 p-3">
                    <Badge
                      variant="outline"
                      className={
                        isAuth
                          ? "border-destructive/40 bg-destructive/15 text-destructive"
                          : isErr
                            ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                            : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      }
                    >
                      {r.error_msg ? "ERR" : (r.status_code ?? "—")}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {r.error_msg || r.content || "No response body"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(r.created).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </section>

        {/* Offers per tick */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-foreground">Dispatch activity</h2>
          {logs.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No dispatch events recorded yet.
            </Card>
          ) : (
            <Card className="divide-y divide-border">
              {logs.map((l) => {
                const o = orders[l.order_id];
                const meta =
                  eventMeta[l.event] || {
                    label: l.event,
                    tone: "bg-muted text-muted-foreground border-border",
                  };
                return (
                  <div key={l.id} className="flex items-center gap-3 p-3">
                    <Badge variant="outline" className={meta.tone}>
                      {meta.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {o ? `Order #${o.order_number} — ${o.restaurant}` : "Order"}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          round {l.round}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {l.driver_id
                          ? `Driver: ${drivers[l.driver_id] || l.driver_id.slice(0, 8)}`
                          : "No driver targeted"}
                        {o?.dispatch_phase ? ` · phase ${o.dispatch_phase}` : ""}
                        {o?.status ? ` · ${o.status}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {fmtTime(l.created_at)}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminDispatchMonitor;
