import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft, MessageCircle, AlertCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/data/menu";
import { getPasswordResetRedirect } from "@/lib/passwordReset";

const SUPPORT_WHATSAPP = "27686768409";
const buildSupportLink = (email: string) =>
  `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Hi Mfula Deliveries, I can't receive the password reset email for "${email}". Please help me recover my account.`
  )}`;

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
  const [unverified, setUnverified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");

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

  const checkAndSend = async (isResend = false) => {
    setError("");
    setUnverified(false);
    setVerifyMsg("");
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);

    // Pre-check: does the account exist and is the email confirmed?
    const { data: checkData, error: checkErr } = await supabase.rpc(
      "check_email_verified",
      { p_email: email.trim() }
    );

    if (checkErr) {
      setLoading(false);
      setError("Unable to check account status. Please try again.");
      return;
    }

    const result = checkData as { exists?: boolean; confirmed?: boolean } | null;
    if (result?.exists === true && result?.confirmed === false) {
      setLoading(false);
      setUnverified(true);
      return;
    }

    const { error: sbError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirect(),
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
    try {
      sessionStorage.setItem("mfula:reset-email", email.trim());
    } catch {}
    if (isResend) setResendCount((c) => c + 1);
  };

  const resendVerification = async () => {
    setVerifyLoading(true);
    setVerifyMsg("");
    const { error: sbError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    setVerifyLoading(false);
    if (sbError) {
      setVerifyMsg(sbError.message || "Could not resend verification email.");
      return;
    }
    setVerifyMsg("Verification email resent! Check your inbox (and Spam folder).");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkAndSend(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const resendsExhausted = resendCount >= MAX_RESENDS;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-[hsl(var(--gold))] shadow-gold"
          />
          <h1 className="mt-4 font-display text-3xl font-bold text-primary tracking-tight">
            {storeInfo.name}
          </h1>
        </div>

        <div className="glass shadow-luxury rounded-3xl p-6 sm:p-7">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-foreground">
                  Reset your password
                </h2>
                <div className="mt-2 h-px bg-border" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
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
                  className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl gradient-maroon py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Used a different email?{" "}
                <a
                  href={buildSupportLink(email || "my account")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp support
                </a>
              </p>

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
              <h2 className="mt-5 font-display text-xl font-bold text-foreground">
                Check your email
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                If an account exists for:
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-foreground">{email}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                we've sent a reset link from{" "}
                <span className="font-semibold text-foreground">notify.mfuladeliveries.online</span>.
                The link expires in 1 hour.
              </p>

              <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Haven't received it yet?
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Emails can take up to <span className="font-medium text-foreground">2 minutes</span> to arrive.
                  Please wait, then check your <span className="font-medium text-foreground">Spam</span>,{" "}
                  <span className="font-medium text-foreground">Promotions</span> and{" "}
                  <span className="font-medium text-foreground">Updates</span> folders.
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Make sure you typed the same email you signed up with, and add{" "}
                  <span className="font-medium text-foreground">notify.mfuladeliveries.online</span>{" "}
                  to your contacts.
                </p>
              </div>

              <div className="mt-5">
                {resendsExhausted ? (
                  <p className="text-sm text-destructive">
                    Too many attempts. Please try again later.
                  </p>
                ) : secondsLeft > 0 ? (
                  <button
                    type="button"
                    disabled
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    Resend email in {formatTime(secondsLeft)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendLink(true)}
                    disabled={loading}
                    className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl gradient-maroon py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Sending..." : "Resend email"}
                  </button>
                )}
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </div>

              <a
                href={buildSupportLink(email)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <MessageCircle className="h-4 w-4 text-[#25D366]" />
                Still stuck? Chat with support
              </a>

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
    </div>
  );
};

export default ForgotPassword;
