/**
 * Central metadata for the Mfula Deliveries legal policy pages.
 * Update the `version` (last-updated) date whenever the wording of a policy
 * changes — the value is stored with every customer's checkout acceptance.
 */
export const POLICY_CONTACT = {
  business: "Mfula Deliveries",
  email: "[INSERT BUSINESS EMAIL]",
  phone: "[INSERT NUMBER]",
  area: "Cape Town, Western Cape, South Africa",
};

export const POLICY_VERSIONS = {
  terms: "2026-08-07",
  delivery: "2026-08-07",
  refund: "2026-08-07",
} as const;

export const POLICY_LINKS = [
  { to: "/terms-and-conditions", label: "Terms and Conditions" },
  { to: "/delivery-policy", label: "Delivery and Shipping Policy" },
  { to: "/refund-policy", label: "Refund and Cancellation Policy" },
];

export function formatPolicyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
