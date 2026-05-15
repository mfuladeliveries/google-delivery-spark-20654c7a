// Returns the correct landing route for a user based on their roles.
// Used by Auth/Profile/back-arrow logic so provider-only users never
// briefly land on the customer home before being bounced.

type AppRole = "admin" | "customer" | "restaurant" | "driver";

export const getHomeRouteForRoles = (roles: AppRole[]): string => {
  if (!roles || roles.length === 0) return "/";
  // Role hierarchy: admin > restaurant > driver > customer.
  // Drivers must always land in the driver app even if they also have the
  // default customer role, so they don't get bounced into the customer home.
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("restaurant")) return "/restaurant/dashboard";
  if (roles.includes("driver")) return "/driver";
  if (roles.includes("customer")) return "/";
  return "/";
};
