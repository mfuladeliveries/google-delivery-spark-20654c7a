import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Status = "idle" | "checking" | "ok" | "fail" | "warn";

interface Check {
  status: Status;
  label: string;
  detail?: string;
  latencyMs?: number;
}

const initial: Check = { status: "idle", label: "Not checked yet" };

const StatusIcon = ({ status }: { status: Status }) => {
  if (status === "checking") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "fail") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "warn") return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
};

const Row = ({
  title,
  check,
  description,
}: {
  title: string;
  check: Check;
  description: string;
}) => (
  <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
    <div className="mt-0.5">
      <StatusIcon status={check.status} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {check.latencyMs !== undefined && (
          <span className="text-xs text-muted-foreground">{check.latencyMs} ms</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <p
        className={`mt-1 text-sm break-words ${
          check.status === "fail"
            ? "text-destructive"
            : check.status === "warn"
              ? "text-yellow-600 dark:text-yellow-400"
              : check.status === "ok"
                ? "text-green-600 dark:text-green-400"
                : "text-foreground"
        }`}
      >
        {check.label}
        {check.detail ? ` — ${check.detail}` : ""}
      </p>
    </div>
  </div>
);

export default function AdminDiagnostics() {
  const { user, session, role } = useAuth();

  const [auth, setAuth] = useState<Check>(initial);
  const [db, setDb] = useState<Check>(initial);
  const [edge, setEdge] = useState<Check>(initial);
  const [realtime, setRealtime] = useState<Check>(initial);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);

    // Auth
    setAuth({ status: "checking", label: "Checking session…" });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuth({ status: "fail", label: "Auth error", detail: error.message });
      } else if (!data.session) {
        setAuth({ status: "warn", label: "No active session" });
      } else {
        const expSec = data.session.expires_at ?? 0;
        const minsLeft = Math.round((expSec * 1000 - Date.now()) / 60000);
        setAuth({
          status: "ok",
          label: `Signed in as ${data.session.user.email ?? data.session.user.id}`,
          detail: `${role ?? "no role"} · token expires in ${minsLeft} min`,
        });
      }
    } catch (err) {
      setAuth({ status: "fail", label: "Auth call failed", detail: (err as Error).message });
    }

    // Database (public read on restaurants count via head request)
    setDb({ status: "checking", label: "Pinging database…" });
    try {
      const t0 = performance.now();
      const { error, count } = await supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true });
      const dt = Math.round(performance.now() - t0);
      if (error) {
        setDb({ status: "fail", label: "Database query failed", detail: error.message, latencyMs: dt });
      } else {
        setDb({
          status: "ok",
          label: "Database reachable",
          detail: `${count ?? 0} restaurants visible`,
          latencyMs: dt,
        });
      }
    } catch (err) {
      setDb({ status: "fail", label: "Database unreachable", detail: (err as Error).message });
    }

    // Edge function: get-catalog
    setEdge({ status: "checking", label: "Calling get-catalog…" });
    try {
      const t0 = performance.now();
      const { data, error } = await supabase.functions.invoke("get-catalog", {
        body: {},
      });
      const dt = Math.round(performance.now() - t0);
      if (error) {
        setEdge({
          status: "fail",
          label: "Edge function failed",
          detail: error.message,
          latencyMs: dt,
        });
      } else {
        const restaurantCount = Array.isArray((data as { restaurants?: unknown[] })?.restaurants)
          ? (data as { restaurants: unknown[] }).restaurants.length
          : 0;
        setEdge({
          status: "ok",
          label: "get-catalog responded",
          detail: `${restaurantCount} restaurants returned`,
          latencyMs: dt,
        });
      }
    } catch (err) {
      setEdge({ status: "fail", label: "Edge function unreachable", detail: (err as Error).message });
    }

    // Realtime
    setRealtime({ status: "checking", label: "Connecting to realtime…" });
    await new Promise<void>((resolve) => {
      const channel = supabase.channel(`diag-${Date.now()}`);
      const timeout = setTimeout(() => {
        setRealtime({ status: "fail", label: "Realtime timed out (5s)" });
        supabase.removeChannel(channel);
        resolve();
      }, 5000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          setRealtime({ status: "ok", label: "Realtime connected" });
          supabase.removeChannel(channel);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          clearTimeout(timeout);
          setRealtime({ status: "fail", label: `Realtime status: ${status}` });
          supabase.removeChannel(channel);
          resolve();
        }
      });
    });

    setRunning(false);
  }, [role]);

  useEffect(() => {
    runAll();
  }, [runAll]);

  const overallOk = [auth, db, edge, realtime].every((c) => c.status === "ok");
  const anyFail = [auth, db, edge, realtime].some((c) => c.status === "fail");

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="text-base font-bold text-foreground">Connection Diagnostics</h1>
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Running…" : "Re-run"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div
          className={`rounded-2xl border p-4 ${
            anyFail
              ? "border-destructive/30 bg-destructive/5"
              : overallOk
                ? "border-green-500/30 bg-green-500/5"
                : "border-border bg-card"
          }`}
        >
          <div className="flex items-center gap-3">
            <StatusIcon status={anyFail ? "fail" : overallOk ? "ok" : running ? "checking" : "warn"} />
            <div>
              <p className="font-bold text-foreground">
                {anyFail
                  ? "One or more checks failed"
                  : overallOk
                    ? "All systems operational"
                    : running
                      ? "Running diagnostics…"
                      : "Some checks need attention"}
              </p>
              <p className="text-xs text-muted-foreground">
                Signed in: {user?.email ?? "—"} · Role: {role ?? "—"} · Session:{" "}
                {session ? "active" : "none"}
              </p>
            </div>
          </div>
        </div>

        <Row
          title="Authentication"
          description="Validates the current Supabase auth session and role."
          check={auth}
        />
        <Row
          title="Database"
          description="Runs a read on the restaurants table via PostgREST."
          check={db}
        />
        <Row
          title="Edge Functions"
          description="Invokes the get-catalog edge function and measures latency."
          check={edge}
        />
        <Row
          title="Realtime"
          description="Subscribes to a temporary realtime channel and waits for confirmation."
          check={realtime}
        />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Run this page whenever the app feels slow or you suspect a backend outage.
        </p>
      </main>
    </div>
  );
}
