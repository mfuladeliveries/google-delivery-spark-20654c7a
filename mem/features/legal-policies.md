---
name: Legal Policy Pages
description: Public policy pages (terms, delivery, refund), footer links, and required checkout acceptance logged to order_policy_acceptances
type: feature
---
## Pages (public, no auth)
- `/terms-and-conditions`, `/delivery-policy`, `/refund-policy`
- Shared layout: `src/components/PolicyPageLayout.tsx`; metadata/versions in `src/lib/policies.ts`
- Contact details are editable placeholders (`[INSERT BUSINESS EMAIL]`, `[INSERT NUMBER]`); area = Cape Town, Western Cape, SA
- South African law: Consumer Protection Act 68 of 2008, POPIA. Never exclude liability where law prohibits.
- Refund reflect time: "approximately 5 to 10 business days" — never guaranteed.

## Checkout requirement
- Notice + required checkbox above the Confirm & Pay button; order cannot be placed until checked.
- On order creation, insert into `order_policy_acceptances` (order_id, user_id, accepted_at, and the three policy version dates).
- Bump the matching date in `POLICY_VERSIONS` whenever policy wording changes.
