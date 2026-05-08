import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { storeInfo } from "@/data/menu";
import { getHomeRouteForRoles } from "@/lib/homeRoute";
import { shouldNudgeInstall, markInstallNudged } from "@/lib/installRedirect";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showOtp, setShowOtp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  // Wait for roles to load before redirecting so provider-only users
  // go straight to their dashboard (no flicker through customer home).
  useEffect(() => {
    if (authLoading || !user || roles.length === 0) return;
    const installPath = shouldNudgeInstall(roles);
    if (installPath) {
      markInstallNudged();
      navigate(installPath, { replace: true });
      return;
    }
    navigate(getHomeRouteForRoles(roles), { replace: true });
  }, [user, roles, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      // Redirect happens via the useEffect above once roles load
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        setShowOtp(true);
        setMessage("We sent a 6-digit code to your email. Enter it below to verify.");
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
    if (error) setError(error.message);
    // Redirect happens via the useEffect above once roles load
    setLoading(false);
  };

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
          <p className="mt-1 text-sm text-muted-foreground">
            {isLogin ? "Sign in to place your order" : "Create an account to get started"}
          </p>
        </div>

        <div className="glass shadow-luxury rounded-3xl p-6 sm:p-7">
        {showOtp ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-center text-lg tracking-[0.5em] text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="000000"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="btn-glow w-full rounded-xl gradient-maroon py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setError("");
                setLoading(true);
                const { error } = await supabase.auth.resend({ type: "signup", email });
                if (error) setError(error.message);
                else setMessage("A new code has been sent to your email.");
                setLoading(false);
              }}
              className="w-full text-sm font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {loading ? "Sending..." : "Resend Code"}
            </button>
            <button
              type="button"
              onClick={() => { setShowOtp(false); setOtp(""); setError(""); setMessage(""); }}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Back
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-primary">{message}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-glow shadow-maroon w-full rounded-xl gradient-maroon py-3 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={async () => {
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) setError(error.message);
              }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); setMessage(""); }}
                className="font-semibold text-primary hover:underline"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
