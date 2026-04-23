import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/data/menu";

const MAX_RESENDS = 3;
const RESEND_COOLDOWN = 60;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [secondsLeft]);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const sendLink = async (isResend = false) => {
    setError("");
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (sbError) {
      const msg = sbError.message?.toLowerCase() ?? "";
      if (msg.includes("not found") || msg.includes("user")) {
        setError("No account found with this email address.");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setError("Connection failed. Please check your internet and try again.");
      } else {
        setError(sbError.message || "Something went wrong. Please try again.");
      }
      return;
    }
    setSent(true);
    setSecondsLeft(RESEND_COOLDOWN);
    if (isResend) setResendCount((c) => c + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendLink(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const resendsExhausted = resendCount >= MAX_RESENDS;

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

        {!sent ? (
          <>
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">Reset your password</h2>
              <div className="mt-2 h-px bg-border" />
              <p className="mt-4 text-sm text-muted-foreground">
                Enter the email address linked to your account and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <Link
              to="/auth"
              className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mt-5 font-display text-xl font-bold text-foreground">Check your email!</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              We sent a password reset link to:
            </p>
            <p className="mt-1 break-all text-sm font-semibold text-foreground">{email}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Tap the link in the email to reset your password. The link expires in 1 hour.
            </p>

            <a
              href="mailto:"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Open Email App
            </a>

            <div className="mt-5 text-sm">
              <p className="text-muted-foreground">Didn't receive it?</p>
              {resendsExhausted ? (
                <p className="mt-1 text-destructive">Too many attempts. Please try again later.</p>
              ) : secondsLeft > 0 ? (
                <p className="mt-1 text-muted-foreground">Resend in {formatTime(secondsLeft)}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => sendLink(true)}
                  disabled={loading}
                  className="mt-1 font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Resend email"}
                </button>
              )}
              {error && <p className="mt-2 text-destructive">{error}</p>}
            </div>

            <Link
              to="/auth"
              className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
