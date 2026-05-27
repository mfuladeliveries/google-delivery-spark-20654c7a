// Build the password-reset redirect URL.
//
// Production users always land on https://mfuladeliveries.online/reset-password
// so the email link never points to localhost or a stale preview host.
// On localhost / lovable preview hosts we fall through to the current origin
// so developers can still test the flow end-to-end.
const PRODUCTION_ORIGIN = "https://mfuladeliveries.online";

const isProductionHost = (host: string) => {
  return (
    host === "mfuladeliveries.online" ||
    host === "www.mfuladeliveries.online" ||
    host.endsWith(".mfuladeliveries.online")
  );
};

const isDevHost = (host: string) => {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host.includes("id-preview--")
  );
};

export const getPasswordResetRedirect = (): string => {
  if (typeof window === "undefined") return `${PRODUCTION_ORIGIN}/reset-password`;
  const host = window.location.hostname;
  // Dev / preview: keep current origin so the link opens locally.
  if (isDevHost(host) && !isProductionHost(host)) {
    return `${window.location.origin}/reset-password`;
  }
  // Anything else (custom domain, prod) -> always production URL.
  return `${PRODUCTION_ORIGIN}/reset-password`;
};
