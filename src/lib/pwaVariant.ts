// Swaps the <link rel="manifest"> href so the browser's install prompt
// picks up the right manifest (Driver / Customer / Admin).
//
// Call this on mount of any page that should advertise a specific PWA identity.
// Note: the browser only re-reads the manifest on user gesture / install prompt,
// so we set it before the install prompt is triggered.

export type PwaVariant = "customer" | "driver" | "admin";

const MANIFEST_BY_VARIANT: Record<PwaVariant, string> = {
  customer: "/manifest-customer.json",
  driver: "/manifest-driver.json",
  admin: "/manifest-admin.json",
};

const THEME_COLOR_BY_VARIANT: Record<PwaVariant, string> = {
  customer: "#ff6600",
  driver: "#ff6600",
  admin: "#ff6600",
};

export const setPwaVariant = (variant: PwaVariant) => {
  if (typeof document === "undefined") return;

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = MANIFEST_BY_VARIANT[variant];

  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (theme) theme.content = THEME_COLOR_BY_VARIANT[variant];
};

export const getManifestHref = (variant: PwaVariant) => MANIFEST_BY_VARIANT[variant];
