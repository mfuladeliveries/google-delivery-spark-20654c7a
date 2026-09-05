// Yoco return-URL origin.
//
// Yoco reviews/validates the domain used for the hosted-checkout return URLs,
// so production checkouts must always return to https://mfuladeliveries.online
// — never to a Lovable preview host. On localhost / preview hosts we keep the
// current origin only for local developer testing; anything a real customer
// can reach is pinned to the production domain.
const PRODUCTION_ORIGIN = "https://mfuladeliveries.online";

const isProductionHost = (host: string) =>
  host === "mfuladeliveries.online" ||
  host === "www.mfuladeliveries.online" ||
  host.endsWith(".mfuladeliveries.online");

export const getYocoReturnOrigin = (): string => {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const host = window.location.hostname;
  // Pure local development: keep localhost so devs can test the redirect loop.
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return window.location.origin;
  }
  // Everything else (custom domain, Lovable preview, published URL) -> production domain.
  return PRODUCTION_ORIGIN;
};
