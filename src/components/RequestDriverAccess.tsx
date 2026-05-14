import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Clock, CheckCircle2, XCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

type RequestRow = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

interface Props {
  userEmail: string;
  /** Called when the user gains driver access (so the parent can refresh roles). */
  onApproved?: () => void;
}

const RequestDriverAccess = ({ userEmail, onApproved }: Props) => {
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchLatest = async () => {
    const { data } = await supabase
      .from("driver_access_requests")
      .select("id, status, message, admin_notes, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data?.[0] as RequestRow | undefined) ?? null;
    setRequest(row);
    setLoading(false);
    if (row?.status === "approved") onApproved?.();
  };

  useEffect(() => {
    fetchLatest();
    // Realtime: refresh when admin updates this user's request
    const channel = supabase
      .channel("driver-access-requests-self")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_access_requests" },
        () => fetchLatest(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase
      .from("driver_access_requests")
      .insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        message: message.trim(),
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message || "Could not submit request");
      setSubmitting(false);
      return;
    }

    // Best-effort admin push notification
    try {
      await supabase.functions.invoke("notify-driver-access-request", {
        body: { request_id: data.id },
      });
    } catch {
      // ignore — request still recorded
    }

    toast.success("Request sent! Admins will review it shortly.");
    setMessage("");
    setSubmitting(false);
    fetchLatest();
  };

  const handleCancel = async () => {
    if (!request) return;
    const { error } = await supabase
      .from("driver_access_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", request.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request cancelled");
    fetchLatest();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Active pending request — show status card
  if (request?.status === "pending") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--driver-info)/0.15)]">
              <Clock className="h-5 w-5 text-[hsl(var(--driver-info))]" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Request submitted</h3>
              <p className="text-xs text-muted-foreground">
                Sent {new Date(request.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            An admin has been notified and will review your request shortly. You'll get a
            notification when it's been approved or rejected.
          </p>
          {request.message && (
            <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Your note
              </p>
              <p className="text-sm text-foreground">{request.message}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleCancel}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" /> Cancel request
        </button>
      </div>
    );
  }

  // Rejected — allow re-submitting
  const wasRejected = request?.status === "rejected";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--driver-info)/0.15)]">
            <Truck className="h-5 w-5 text-[hsl(var(--driver-info))]" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Become a driver</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[240px]">{userEmail}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          You're already signed in. Send a request to admin and we'll set up your driver account —
          no need to register again.
        </p>

        {wasRejected && request?.admin_notes && (
          <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">
                Previous request rejected
              </p>
            </div>
            <p className="text-sm text-foreground">{request.admin_notes}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tell admin why (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. I have a motorbike and want to deliver in Soweto evenings & weekends."
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)] resize-none"
          />
          <p className="mt-1 text-[10px] text-muted-foreground text-right">{message.length}/500</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-[hsl(var(--driver-info))] py-3.5 font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Sending…" : wasRejected ? "Request Again" : "Request Driver Access"}
        </button>
      </form>

      {request?.status === "approved" && (
        <div className="rounded-2xl border border-[hsl(var(--driver-success)/0.3)] bg-[hsl(var(--driver-success)/0.1)] p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--driver-success))]" />
          <p className="text-sm text-[hsl(var(--driver-success))] font-semibold">
            You're approved! Reload to access the driver dashboard.
          </p>
        </div>
      )}
    </div>
  );
};

export default RequestDriverAccess;
