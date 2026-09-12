import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { storeInfo } from "@/data/menu";

type AuthzDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};

const oauth = () =>
  (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthzDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("This link is missing its authorization reference.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The authorization server did not return a redirect. Please try again.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? "this app";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src={storeInfo.logo}
            alt={storeInfo.name}
            className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-[hsl(var(--gold))]"
          />
          <h1 className="mt-4 font-display text-2xl font-bold text-primary">{storeInfo.name}</h1>
        </div>

        <div className="glass shadow-luxury rounded-3xl p-6 space-y-4">
          {error ? (
            <>
              <h2 className="font-display text-lg font-bold text-foreground">
                We couldn't load this request
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <a href="/" className="block text-sm font-medium text-primary">
                Back to Mfula Deliveries
              </a>
            </>
          ) : !details ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <h2 className="font-display text-lg font-bold text-foreground">
                Connect {clientName} to your account
              </h2>
              <p className="text-sm text-muted-foreground">
                {clientName} will be able to see your restaurants, menus and your own orders on
                Mfula Deliveries, acting as you. You can disconnect it at any time.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true)}
                className="btn-glow shadow-maroon w-full rounded-xl gradient-maroon py-3 font-display font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Please wait..." : "Approve"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false)}
                className="w-full rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-card-foreground disabled:opacity-50"
              >
                Deny
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default OAuthConsent;
