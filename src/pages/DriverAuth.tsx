import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Truck, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { shouldNudgeInstall, markInstallNudged } from "@/lib/installRedirect";
import RequestDriverAccess from "@/components/RequestDriverAccess";

type View = "login" | "signup" | "otp" | "forgot";

const DriverAuth = () => {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  useEffect(() => {
    // Only auto-redirect users who already have driver/admin access into the
    // driver dashboard. Users without access (e.g. restaurant owners or
    // not-yet-driver customers) should stay on this page so they can read
    // the info and sign up — otherwise clicking "Become a Driver" silently
    // bounces them back to whatever role-home they came from.
    if (authLoading) return;
    if (!user) return;
    if (roles.length === 0) return;

    const hasAccess = roles.includes("driver") || roles.includes("admin");
    if (!hasAccess) return;

    const installPath = shouldNudgeInstall(roles);
    if (installPath) {
      markInstallNudged();
      navigate(installPath, { replace: true });
      return;
    }
    navigate("/driver", { replace: true });
  }, [user, roles, authLoading, navigate]);

  const resetState = () => {
    setError("");
    setMessage("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setView("otp");
      setMessage("We sent a 6-digit verification code to your email.");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    if (!email) {
      setError("Enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setMessage("Check your email for a password reset link!");
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Driver-themed header */}
      <div
        className="relative overflow-hidden px-6 pb-10 pt-12"
        style={{
          background: "linear-gradient(135deg, hsl(217 91% 25%), hsl(217 91% 40%))",
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Driver Portal</h1>
          <p className="mt-1 text-sm text-white/70">
            {user
              ? "Request access to start delivering"
              : view === "login"
              ? "Sign in to start delivering"
              : view === "signup"
              ? "Create your driver account"
              : view === "otp"
              ? "Verify your email"
              : "Reset your password"}
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
        <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/5" />
      </div>

      {/* Form area */}
      <div className="flex flex-1 flex-col px-6 pt-8">
        <div className="mx-auto w-full max-w-sm">
          {/* Logged-in non-driver: show request-access flow instead of login/signup */}
          {user && roles.length > 0 && !roles.includes("driver") && !roles.includes("admin") ? (
            <>
              <RequestDriverAccess userEmail={user.email || ""} />
              <div className="mt-8 text-center">
                <a
                  href="https://wa.me/27686768409"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Contact the Admin on WhatsApp: 0686768409
                </a>
              </div>
            </>
          ) : (
          <>
          {/* OTP View */}
          {view === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-sm text-muted-foreground mb-4">{message}</p>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full rounded-2xl bg-[hsl(var(--driver-info))] py-3.5 font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    resetState();
                    setLoading(true);
                    const { error } = await supabase.auth.resend({ type: "signup", email });
                    if (error) setError(error.message);
                    else setMessage("A new code has been sent to your email.");
                    setLoading(false);
                  }}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-[hsl(var(--driver-info))] hover:bg-[hsl(var(--driver-info)/0.05)] transition-colors disabled:opacity-50"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("signup");
                    setOtp("");
                    resetState();
                  }}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Forgot Password View */}
          {view === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]"
                      placeholder="driver@example.com"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              {message && (
                <div className="rounded-xl bg-[hsl(var(--driver-success)/0.1)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-3">
                  <p className="text-sm text-[hsl(var(--driver-success))]">{message}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[hsl(var(--driver-info))] py-3.5 font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  resetState();
                }}
                className="w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* Login / Signup Views */}
          {(view === "login" || view === "signup") && (
            <>
              {/* Tab switcher */}
              <div className="mb-6 flex rounded-2xl border border-border bg-card p-1 shadow-card">
                <button
                  onClick={() => {
                    setView("login");
                    resetState();
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    view === "login"
                      ? "bg-[hsl(var(--driver-info))] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setView("signup");
                    resetState();
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    view === "signup"
                      ? "bg-[hsl(var(--driver-info))] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <form
                onSubmit={view === "login" ? handleLogin : handleSignup}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]"
                        placeholder="driver@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full rounded-xl border border-border bg-background pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {view === "signup" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--driver-info))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--driver-info)/0.2)]"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot");
                      resetState();
                    }}
                    className="text-sm font-semibold text-[hsl(var(--driver-info))] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}

                {error && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
                {message && (
                  <div className="rounded-xl bg-[hsl(var(--driver-success)/0.1)] border border-[hsl(var(--driver-success)/0.2)] px-4 py-3">
                    <p className="text-sm text-[hsl(var(--driver-success))]">{message}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[hsl(var(--driver-info))] py-3.5 font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Truck className="h-5 w-5" />
                  {loading
                    ? "Please wait..."
                    : view === "login"
                    ? "Sign In as Driver"
                    : "Create Driver Account"}
                </button>
              </form>

              {view === "signup" && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  By signing up, you'll be registered as a customer. Contact admin to get driver access.
                </p>
              )}
            </>
          )}

          {/* Contact admin via WhatsApp */}
          <div className="mt-8 text-center">
            <a
              href="https://wa.me/27686768409"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Contact the Admin on WhatsApp: 0686768409
            </a>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverAuth;
