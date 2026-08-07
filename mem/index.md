# Project Memory

## Core
Multi-restaurant delivery platform (admin, customer, restaurant, driver).
Luxury maroon theme. Primary Maroon (#5B0017), Gold accent (#D4AF37), Matte Black (#121212), Cream (#F8F5F2).
Playfair Display headings, Inter body. Glassmorphism + premium shadows.
Role hierarchy: admin > restaurant > driver > customer.
Closed onboarding for providers (admin-led). Customer self-service.

## Memories
- [Visual Identity](mem://style/visual-identity) — Luxury maroon/gold palette, glassmorphism, premium shadows, Playfair Display
- [Cart Logic](mem://features/cart-logic) — Delivery fees R40 internal/R55 display, 5% tax, min order R40
- [Delivery Fee Management](mem://features/delivery-fee-management) — Peak surcharges (flat ZAR), audit log, find_nearest_zone includes surcharge
- [Order Tracking](mem://features/order-tracking) — 7-stage tracker, driver GPS every 10s
- [Role Assignment](mem://auth/role-assignment) — Default customer role, multi-role priority handling
- [Password Recovery](mem://auth/password-recovery) — 6-char min password, confirm field
- [Location Auto Fill](mem://features/location-auto-fill) — Browser Geolocation and OSM reverse geocoding
- [Social Login](mem://auth/social-login) — Google sign-in via Lovable Cloud OAuth
- [Verification Method](mem://auth/verification-method) — 6-digit email OTP
- [Notifications](mem://features/notifications) — Realtime + Web Push via VAPID, edge functions
- [PWA Deployment](mem://project/deployment-pwa) — Manifest and tailored installation page
- [Access Control](mem://security/access-control) — Strict RLS, driver status updates limited, no manual delivered status
- [Order Dispatch](mem://features/order-dispatch) — Broadcast-and-claim for driver assignment
- [Order Statuses](mem://features/order-statuses) — Sequence: pending to delivered/rejected
- [Payment Options](mem://features/payment-options) — Cash on Delivery and Online Payment
- [Admin Management](mem://features/admin-management) — Edge functions for user management using service role key
- [Delivery Verification](mem://security/delivery-verification) — 6-digit hashed PIN (SHA-256), 5-attempt lockout
- [Order Creation Integrity](mem://security/order-creation-integrity) — Direct inserts disabled, server-side RPC validation
- [Document Privacy](mem://security/document-privacy) — RLS + signed URLs for driver documents
- [Driver Job Board](mem://features/driver-job-board) — Filter by distance (color-coded), fee, urgency
- [Driver Earnings](mem://features/driver-earnings-logic) — 70/30 split on R55 fee, driver_earnings table, auto on delivery
- [Withdrawals](mem://features/withdrawals) — Bank details on profile, R100 min, pending→approved→paid flow, push notifications
- [Database Security](mem://tech/database-security-utils) — pgcrypto extension for secure hashing
- [Map UI Stability](mem://tech/ui-stability-mapping) — Lazy-loading + error boundaries for mapping
- [Checkout](mem://features/checkout) — Direct DB workflow, strict validation for details
- [Routing Priority](mem://tech/routing-priority) — Static dashboard paths prioritized over dynamic routes
- [Manual Configurations](mem://security/manual-configurations) — Gitignore, Leaked Password Protection
- [Dependency Constraints](mem://tech/dependency-constraints) — react-leaflet version fixes to prevent React 18 conflicts
- [Auth Loading Logic](mem://tech/auth-loading-logic) — useAuth waits for roles before loading completes
- [Data Privacy](mem://security/data-privacy) — PII isolated in private_users, strict view access for drivers
- [Onboarding Model](mem://auth/onboarding-model) — Admin-led provider onboarding via Edge Functions
- [Food Images](mem://features/food-image-management) — 5MB limit, drag-and-drop, restricted upload
- [Location Gating](mem://features/location-gating) — Live GPS, 6km per-restaurant radius, sort/filter nearby on home
- [Coordinate Validation](mem://security/coordinate-validation) — Autocomplete-only addresses, map confirm, 8km server-enforced radius, invalid_order_attempts log
- [Legal Policies](mem://features/legal-policies) — Public terms/delivery/refund pages, footer links, required checkout acceptance logging
