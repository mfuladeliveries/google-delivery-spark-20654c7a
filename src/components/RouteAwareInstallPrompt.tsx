import { useLocation } from "react-router-dom";
import AutoInstallPrompt from "@/components/AutoInstallPrompt";
import type { PwaVariant } from "@/lib/pwaVariant";

/**
 * Mounts AutoInstallPrompt with the right variant + app name based on the current route.
 * Skipped on auth pages and the dedicated /install page (which has its own UI).
 */
const RouteAwareInstallPrompt = () => {
  const { pathname } = useLocation();

  // Skip on routes where a popup would interfere
  if (
    pathname === "/install" ||
    pathname === "/auth" ||
    pathname === "/driver/auth" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/~oauth")
  ) {
    return null;
  }

  let variant: PwaVariant = "customer";
  let appName = "Mfula App";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    variant = "admin";
    appName = "Mfula Admin";
  } else if (pathname === "/driver" || pathname.startsWith("/driver/")) {
    variant = "driver";
    appName = "Mfula Driver";
  } else if (
    pathname.startsWith("/restaurant/dashboard") ||
    pathname.startsWith("/restaurant/orders") ||
    pathname.startsWith("/restaurant/menu")
  ) {
    variant = "restaurant";
    appName = "Mfula Restaurant";
  } else {
    variant = "customer";
    appName = "Mfula Customer";
  }

  return <AutoInstallPrompt variant={variant} appName={appName} />;
};

export default RouteAwareInstallPrompt;
