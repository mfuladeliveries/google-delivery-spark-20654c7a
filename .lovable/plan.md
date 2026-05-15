## Goal
Make the Driver App a fully separated experience with its own login/signup, layout, route protection, approval workflow, and persistent session — without touching customer/restaurant/admin flows beyond what's needed for redirects.

## What already exists (reuse)
- Roles table + `has_role` + `app_role` enum (admin/customer/restaurant/driver)
- `RoleGuard` for route gating
- `/driver`, `/driver/*` and `/driver/auth` routes already gated to driver+admin
- `DriverDashboard` with bottom nav for Orders / Active / History / Earnings / Profile
- `homeRoute.ts` already prioritises admin > restaurant > driver > customer
- `AppSwitcher` already hidden for driver-only users
- `driver_profiles` with vehicle_type, license_url, id_document_url, bank fields
- `driver_access_requests` table for admin approval

## Changes to make

### 1. Driver-only sub-routes (URLs)
Add these as aliases under the existing `RoleGuard allow=["driver","admin"]`:
- `/driver/login` and `/driver/signup` → render `DriverAuth` (public, no guard)
- `/driver/dashboard` → DriverDashboard (default tab)
- `/driver/orders`, `/driver/active`, `/driver/history`, `/driver/earnings`, `/driver/profile` → DriverDashboard with the right tab pre-selected

DriverDashboard already reads tab from path; just register the explicit routes so deep links work.

### 2. Driver signup expansion
Today `/driver/auth` only does email+password and submits a driver-access request. Expand the **signup** form to capture:
- Full name, phone, email, password
- ID number
- Vehicle type, vehicle registration number
- Driver license upload (file → `driver-docs` storage bucket)
- Profile photo upload (→ `avatars` or new `driver-photos` bucket)

On submit: create auth user → upload files → upsert `profiles` (full_name, contact_number) → upsert `driver_profiles` (vehicle_type, license_plate, id_document_url, license_url, profile_photo_url, id_number) → insert `driver_access_requests` with status `pending`.

DB additions needed:
- `driver_profiles.id_number text`
- `driver_profiles.profile_photo_url text`
- `driver_profiles.is_approved boolean default false`
- `driver_profiles.is_suspended boolean default false`
- Storage bucket `driver-docs` (private) with RLS: driver can upload/read own folder, admin can read all

### 3. Approval gate at login
- Driver login flow: after sign-in, check `driver_profiles.is_approved` and `is_suspended`.
- If not approved: sign out + show "Your driver account is pending approval"
- If suspended: sign out + show "Your driver account has been suspended"
- Only approved, non-suspended drivers reach `/driver`

### 4. Strict redirects (cross-role isolation)
Update `RoleGuard` behaviour:
- Customer routes (`/`, `/restaurant/:id`, `/search`, etc.) — wrap in `RoleGuard allow=["customer","admin"]` so a driver hitting them is bounced to `/driver`.
- Currently `/restaurant/:id`, `/orders`, `/order-confirmation`, `/search` are unguarded. Add guards so a signed-in driver is redirected to `/driver`.
- Driver auth routes (`/driver/auth`, `/driver/login`, `/driver/signup`) auto-redirect to `/driver` when an approved driver is already signed in.

### 5. Admin tools
`AdminDriverRequests` already approves/rejects. Add:
- A new `AdminDrivers` panel listing all drivers with: approve toggle, suspend toggle, link to view documents (signed URLs from `driver-docs`).
- Edge function `admin-driver-action` (or extend existing admin functions) to flip `is_approved` / `is_suspended` using service role.

### 6. Persistent login
Already handled by Supabase JS default (`persistSession: true` via the generated client). No code change needed; verify and document.

## Out of scope (won't change)
- Customer/restaurant/admin UI beyond adding redirect guards
- Existing driver dispatch / earnings / withdrawals logic
- Push notification stack

## Technical notes
- DB migration for `driver_profiles` columns + `driver-docs` bucket + RLS
- Admin function uses service role to set approval/suspension flags
- File uploads: use `supabase.storage.from('driver-docs').upload()` with path `${user.id}/license.ext` and `${user.id}/id.ext`; profile photo to public `avatars` bucket if it exists, else `driver-docs`
- DriverAuth becomes a tabbed login/signup with the expanded fields; routes `/driver/login` and `/driver/signup` deep-link to the right tab

## Questions before I build
1. Profile photos — should they be public (any signed-in user can view) or private (admin/driver only)? Affects bucket choice.
2. Should I add the new `AdminDrivers` panel now, or is the existing `AdminDriverRequests` (approve at signup) enough for v1, with suspend coming later?
3. Any specific vehicle types to allow (motorbike / car / bicycle / scooter), or free text?