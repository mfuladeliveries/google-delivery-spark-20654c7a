import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldAlert,
  Webhook,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WebhookFailure {
  id: string;
  stage: string;
  event_id: string | null;
  event_type: string | null;
  order_id: string | null;
  order_number: number | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  source_ip: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

const TABLE = "yoco_webhook_failures" as never;

const STAGE_LABELS: Record<string, string> = {
  signature_rejected: "Signature rejected",
  order_unresolved: "Order not found",
  ledger_insert_failed: "Event ledger error",
  refund_confirmation_failed: "Refund confirmation failed",
  failure_mark_failed: "Payment-failure update failed",
  handler_error: "Handler error",
};

const STAGE_TONE: Record<string, string> = {
  signature_rejected: "bg-destructive/15 text-destructive border-destructive/30",
  order_unresolved: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  ledger_insert_failed: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  refund_confirmation_failed: "bg-destructive/15 text-destructive border-destructive/30",
  failure_mark_failed: "bg-destructive/15 text-destructive border-destructive/30",
  handler_error: "bg-destructive/15 text-destructive border-destructive/30",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminYocoFailures = () => {
  const [rows, setRows] = useState<WebhookFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Could not load webhook failures.");
    setRows((data ?? []) as unknown as WebhookFailure[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Real-time: new failures pop in immediately with an alert sound-free toast.
    const channel = supabase
      .channel("admin-yoco-webhook-failures")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "yoco_webhook_failures" },
        (payload) => {
          const row = payload.new as WebhookFailure;
          setRows((prev) => [row, ...prev]);
          toast.error(
            `Yoco webhook failure: ${STAGE_LABELS[row.stage] ?? row.stage}`,
            { description: row.error_message ?? undefined },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "yoco_webhook_failures" },
        (payload) => {
          const row = payload.new as WebhookFailure;
          setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const visible = useMemo(
    () => (showResolved ? rows : rows.filter((r) => !r.resolved)),
    [rows, showResolved],
  );
  const unresolvedCount = rows.filter((r) => !r.resolved).length;

  const markResolved = async (row: WebhookFailure) => {
    setBusyId(row.id);
    const { error } = await supabase
      .from(TABLE)
      .update({ resolved: true, resolved_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message || "Could not mark resolved.");
    } else {
      toast.success("Marked as resolved.");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, resolved: true, resolved_at: new Date().toISOString() } : r,
        ),
      );
    }
    setBusyId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-xl shadow-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/admin"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Webhook className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">Yoco Webhook Failures</h1>
              <p className="text-[10px] text-muted-foreground">
                Live log of failed payment confirmations & refunds
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {unresolvedCount > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                {unresolvedCount} unresolved
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setShowResolved(false)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border ${
              !showResolved
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Unresolved ({unresolvedCount})
          </button>
          <button
            onClick={() => setShowResolved(true)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border ${
              showResolved
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            All ({rows.length})
          </button>
        </div>

        {!loading && visible.length === 0 && (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-sm font-bold text-foreground">No webhook failures</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every Yoco payment confirmation and refund is being processed normally.
            </p>
          </Card>
        )}

        {visible.map((row) => {
          const isOpen = expanded[row.id];
          return (
            <Card key={row.id} className={`p-4 ${row.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STAGE_TONE[row.stage] ?? "bg-muted text-muted-foreground border-border"}>
                      {STAGE_LABELS[row.stage] ?? row.stage}
                    </Badge>
                    {row.event_type && (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {row.event_type}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {fmtTime(row.created_at)}
                    </span>
                  </div>
                  {row.error_message && (
                    <p className="mt-1.5 text-xs text-foreground break-words">{row.error_message}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {row.order_number != null && <span>Order #{row.order_number}</span>}
                    {row.event_id && <span className="truncate">Event {row.event_id}</span>}
                    {row.source_ip && <span>IP {row.source_ip}</span>}
                    {row.resolved && row.resolved_at && (
                      <span className="text-primary">Resolved {fmtTime(row.resolved_at)}</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.order_id && (
                      <Link
                        to={`/admin/support?q=${row.order_number ?? row.order_id}`}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-secondary"
                      >
                        Open in Support
                      </Link>
                    )}
                    {row.payload && (
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-secondary"
                      >
                        {isOpen ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        Payload
                      </button>
                    )}
                    {!row.resolved && (
                      <button
                        onClick={() => markResolved(row)}
                        disabled={busyId === row.id}
                        className="rounded-lg gradient-maroon px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-60"
                      >
                        {busyId === row.id ? "Saving…" : "Mark resolved"}
                      </button>
                    )}
                  </div>
                  {isOpen && row.payload && (
                    <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-muted p-3 text-[10px] text-muted-foreground">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </main>
    </div>
  );
};

export default AdminYocoFailures;
