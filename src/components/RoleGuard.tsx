import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getHomeRouteForRoles } from "@/lib/homeRoute";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";

type AppRole = "admin" | "customer" | "restaurant" | "driver";

interface RoleGuardProps {
  /**
   * Roles allowed to view the wrapped route.
   * If omitted, the route is public (still waits for auth to resolve before rendering).
   */
  allow?: AppRole[];
  /**
   * If true, an unauthenticated user is sent to `redirectUnauthedTo` (default: /auth).
   * If false (default), unauthenticated users are allowed to view the route
   * (useful for the customer home which works for guests too).
   */
  requireAuth?: boolean;
  /** Where to send unauthenticated users when requireAuth is true. */
  redirectUnauthedTo?: string;
  /** Optional loader label, e.g. "Loading driver dashboard…". */
  loadingLabel?: string;
  children: ReactNode;
}

/**
 * Shared route guard for entry routes (/, /driver, and future dashboards).
 *
 * Guarantees:
 *   1. Always renders the same `AuthLoadingScreen` while auth/roles resolve,
 *      so users never see a flash of the wrong UI.
 *   2. Redirects users who don't match `allow` to their correct home route
 *      (based on their actual roles), keeping role routing in one place.
 *   3. Optionally bounces unauthenticated users to a sign-in page.
 */
const RoleGuard = ({
  allow,
  requireAuth = false,
  redirectUnauthedTo = "/auth",
  loadingLabel,
  children,
}: RoleGuardProps) => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Decide whether the current user is allowed on this route.
  const userKnown = !authLoading && (!user || roles.length > 0);
  const isAllowed = (() => {
    if (!userKnown) return false;
    if (!allow || allow.length === 0) return true; // public route, just gate on auth resolution
    // Guests are allowed on routes that don't require auth (e.g. customer home),
    // since the guard's job is only to prevent the *wrong signed-in role* from
    // seeing this UI. Auth-required routes are handled by the redirect effect.
    if (!user) return !requireAuth;
    return allow.some((r) => roles.includes(r));
  })();

  useEffect(() => {
    if (authLoading) return;
    // Unauthenticated user on a route that requires auth → bounce to sign-in.
    if (!user) {
      if (requireAuth) {
        navigate(redirectUnauthedTo, { replace: true });
      }
      return;
    }
    // Authenticated, but roles haven't loaded yet → wait.
    if (roles.length === 0) return;
    // Authenticated and role-checked, but not allowed here → send to their home.
    if (allow && allow.length > 0 && !allow.some((r) => roles.includes(r))) {
      const dest = getHomeRouteForRoles(roles);
      if (dest !== location.pathname) navigate(dest, { replace: true });
    }
  }, [
    authLoading,
    user,
    roles,
    allow,
    requireAuth,
    redirectUnauthedTo,
    navigate,
    location.pathname,
  ]);

  if (!isAllowed) return <AuthLoadingScreen label={loadingLabel} />;

  return <>{children}</>;
};

export default RoleGuard;
