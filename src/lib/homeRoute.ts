// Returns the correct landing route for a user based on their roles.
// Used by Auth/Profile/back-arrow logic so provider-only users never
// briefly land on the customer home before being bounced.

type AppRole = "admin" | "customer" | "restaurant" | "driver";

export const getHomeRouteForRoles = (roles: AppRole[]): string => {
  if (!roles || roles.length === 0) return "/";
  // Customer access wins (most permissive landing for multi-role users)
  if (roles.includes("customer")) return "/";
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("driver")) return "/driver";
  if (roles.includes("restaurant")) return "/restaurant/dashboard";
  return "/";
};
