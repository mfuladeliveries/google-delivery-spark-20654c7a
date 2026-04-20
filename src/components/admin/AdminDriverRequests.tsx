import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Check, X, Clock, MailOpen } from "lucide-react";
import { toast } from "sonner";

interface RequestRow {
  id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  profile?: { full_name: string; contact_number: string };
  email?: string;
}

const statusBadge: Record<RequestRow["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-secondary text-muted-foreground",
};

const AdminDriverRequests = () => {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("driver_access_requests")
      .select("id, user_id, message, status, admin_notes, created_at, reviewed_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set((rows || []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, contact_number")
          .in("user_id", userIds)
      : { data: [] as { user_id: string; full_name: string; contact_number: string }[] };

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const enriched = (rows || []).map((r) => ({
      ...r,
      profile: profileMap.get(r.user_id),
    })) as RequestRow[];

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel("admin-driver-access-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_access_requests" },
        () => fetchRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (req: RequestRow) => {
    const note = window.prompt("Optional note for the approval:", "") ?? undefined;
    setBusyId(req.id);
    const { error } = await supabase.rpc("admin_approve_driver_request", {
      p_request_id: req.id,
      p_notes: note?.trim() || null,
    });
    if (error) {
      setBusyId(null);
      toast.error(error.message);
      return;
    }
    // Best-effort push notification to the applicant
    supabase.functions
      .invoke("notify-driver-request-decision", {
        body: { request_id: req.id, decision: "approved", notes: note?.trim() || null },
      })
      .catch(() => {});
    setBusyId(null);
    toast.success("Driver access granted");
    fetchRequests();
  };

  const handleReject = async (req: RequestRow) => {
    const note = window.prompt("Reason for rejection (visible to user):", "");
    if (note === null) return;
    setBusyId(req.id);
    const { error } = await supabase.rpc("admin_reject_driver_request", {
      p_request_id: req.id,
      p_notes: note.trim() || null,
    });
    if (error) {
      setBusyId(null);
      toast.error(error.message);
      return;
    }
    supabase.functions
      .invoke("notify-driver-request-decision", {
        body: { request_id: req.id, decision: "rejected", notes: note.trim() || null },
      })
      .catch(() => {});
    setBusyId(null);
    toast.success("Request rejected");
    fetchRequests();
  };

  const visible = requests.filter((r) => (filter === "pending" ? r.status === "pending" : true));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-foreground flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          Driver Access Requests
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingCount} pending
            </span>
          )}
        </h2>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <MailOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "No pending requests" : "No requests yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-foreground truncate">
                      {req.profile?.full_name || "Unnamed user"}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </div>
                  {req.profile?.contact_number && (
                    <p className="text-xs text-muted-foreground">
                      📞 {req.profile.contact_number}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {req.message && (
                <div className="mb-3 rounded-xl bg-secondary/50 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    User's message
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.message}</p>
                </div>
              )}

              {req.admin_notes && req.status !== "pending" && (
                <div className="mb-3 rounded-xl bg-secondary/30 px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Admin note
                  </p>
                  <p className="text-sm text-foreground">{req.admin_notes}</p>
                </div>
              )}

              {req.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(req)}
                    disabled={busyId === req.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-sm font-bold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={busyId === req.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2 text-sm font-bold text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default AdminDriverRequests;
