// Decides whether a user should be nudged to /install/<role> after login.
// Skipped when:
//  - Running as an installed PWA (standalone display mode)
//  - User has already been nudged this session
//  - User explicitly opted out (localStorage)
//  - Running inside Lovable preview/iframe (no real install possible)

type AppRole = "admin" | "customer" | "restaurant" | "driver";

const SESSION_KEY = "mfula_install_nudged";
const OPT_OUT_KEY = "mfula_install_optout";

const VARIANT_BY_ROLE: Record<AppRole, "customer" | "driver" | "restaurant" | "admin"> = {
  customer: "customer",
  driver: "driver",
  restaurant: "restaurant",
  admin: "admin",
};

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

const isPreviewOrIframe = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return host.includes("id-preview--") || host.includes("lovableproject.com");
};

export const getInstallPathForRoles = (roles: AppRole[]): string | null => {
  if (!roles || roles.length === 0) return null;
  // Match priority of homeRoute, but for install we nudge providers only.
  // Customers don't need a forced install nudge after login (banner handles them).
  const priority: AppRole[] = ["admin", "restaurant", "driver"];
  const best = priority.find((r) => roles.includes(r));
  if (!best) return null;
  return `/install/${VARIANT_BY_ROLE[best]}`;
};

export const shouldNudgeInstall = (roles: AppRole[]): string | null => {
  if (typeof window === "undefined") return null;
  if (isStandalone()) return null;
  if (isPreviewOrIframe()) return null;
  if (sessionStorage.getItem(SESSION_KEY) === "1") return null;
  if (localStorage.getItem(OPT_OUT_KEY) === "1") return null;
  return getInstallPathForRoles(roles);
};

export const markInstallNudged = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // ignore
  }
};

export const optOutOfInstallNudge = () => {
  try {
    localStorage.setItem(OPT_OUT_KEY, "1");
  } catch {
    // ignore
  }
};
