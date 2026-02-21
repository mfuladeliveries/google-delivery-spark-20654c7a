import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { storeInfo } from "@/data/menu";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      // Also listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else {
      setConfirmed(true);
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={storeInfo.logo} alt={storeInfo.name} className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-primary/30" />
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Reset Password</h1>
        </div>

        {confirmed ? (
          <p className="text-center text-sm text-primary">Password updated! Redirecting…</p>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">
            Loading… If you arrived here without a reset link, please request one from the sign-in page.
          </p>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">New Password</label>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-2.5 font-display font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
