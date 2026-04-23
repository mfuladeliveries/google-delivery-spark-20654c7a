import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/data/menu";

type Strength = { score: number; label: string; barClass: string };

const evaluateStrength = (pw: string): Strength => {
  const checks = [pw.length >= 8, /\d/.test(pw), /[A-Z]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = checks.filter(Boolean).length;
  if (score <= 1) return { score, label: "Weak", barClass: "bg-destructive" };
  if (score <= 3) return { score, label: "Fair", barClass: "bg-primary" };
  return { score, label: "Strong", barClass: "bg-[hsl(var(--success,142_76%_45%))]" };
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Detect recovery session
  useEffect(() => {
    const hash = window.location.hash || "";
    const hasRecovery = hash.includes("type=recovery");
    const hasError = hash.includes("error=") || hash.includes("error_code=");

    if (hasError) {
      setLinkInvalid(true);
      return;
    }

    if (hasRecovery) {
      setReady(true);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // If no recovery indicator after a moment, treat as invalid
    const t = window.setTimeout(() => {
      setReady((r) => {
        if (!r) setLinkInvalid(true);
        return r;
      });
    }, 1500);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  // Countdown after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate("/auth", { replace: true });
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [success, countdown, navigate]);

  const checks = {
    length: password.length >= 8,
    number: /\d/.test(password),
    capital: /[A-Z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const strength = evaluateStrength(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = checks.length && checks.number && checks.capital && matches && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!matches) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error: sbError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (sbError) {
      const msg = sbError.message?.toLowerCase() ?? "";
      if (msg.includes("network") || msg.includes("fetch")) {
        setError("Connection failed. Please check your internet and try again.");
      } else {
        setError(sbError.message);
      }
      return;
    }
    setSuccess(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-primary/30"
          />
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">{storeInfo.name}</h1>
        </div>

        {success ? (
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 animate-in zoom-in fade-in items-center justify-center rounded-full bg-[hsl(142_76%_45%/0.15)] duration-500">
              <CheckCircle2 className="h-12 w-12 text-[hsl(142_76%_45%)]" />
            </div>
            <h2 className="mt-5 font-display text-xl font-bold text-foreground">Password Updated!</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="mt-6 w-full rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In Now
            </button>
            <p className="mt-3 text-xs text-muted-foreground">Redirecting in {countdown}…</p>
          </div>
        ) : linkInvalid ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="mt-5 font-display text-xl font-bold text-foreground">Link Expired</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              This password reset link has expired or already been used.
            </p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Request New Link
            </Link>
          </div>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">Create new password</h2>
              <div className="mt-2 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 pr-10 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 pr-10 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm.length > 0 && !matches && (
                  <p className="mt-2 text-sm text-destructive">Passwords do not match</p>
                )}
              </div>

              {/* Strength bar */}
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Password strength</span>
                  <span className="font-semibold text-foreground">{password ? strength.label : "—"}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${password ? strength.barClass : ""}`}
                    style={{ width: `${(strength.score / 4) * 100}%` }}
                  />
                </div>
              </div>

              {/* Checklist */}
              <ul className="space-y-1 text-sm">
                <ChecklistItem ok={checks.length} label="At least 8 characters" />
                <ChecklistItem ok={checks.number} label="One number" />
                <ChecklistItem ok={checks.capital} label="One capital letter" />
                <ChecklistItem ok={checks.special} label="One special character" />
              </ul>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const ChecklistItem = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className="flex items-center gap-2">
    <span className={ok ? "text-[hsl(142_76%_45%)]" : "text-muted-foreground"}>
      {ok ? "✅" : "⭕"}
    </span>
    <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </li>
);

export default ResetPassword;
