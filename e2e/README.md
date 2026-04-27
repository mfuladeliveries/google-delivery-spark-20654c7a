# Playwright E2E suite

End-to-end tests covering the four main roles of the delivery platform.

## One-time setup

1. Install the browser binary (Playwright needs it once per machine):
   ```sh
   bun run e2e:install
   ```
2. Copy the env template and fill in real test credentials:
   ```sh
   cp .env.e2e.example .env.e2e
   ```
   Each role needs an **already-confirmed** account with the right role granted via the Admin Dashboard. Signup OTP cannot be intercepted by Playwright, so test users must already exist.

   Recommended setup:
   - **Customer** — sign up normally + verify the OTP once.
   - **Driver** — create via Admin → Users → grant `driver` role + fill bank details (so withdrawal logic doesn't crash any view).
   - **Restaurant** — create via Admin → Restaurants → assign the user as `owner_user_id` of an active restaurant that has at least one available menu item.
   - **Admin** — your existing admin account.

   For the customer-order spec to clean up after itself, also add to `.env.e2e`:
   ```
   VITE_SUPABASE_URL=https://kdplufybixfqsqhyixxw.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<the same anon key the app uses>
   ```

## Running

```sh
bun run e2e                  # runs against http://localhost:8080 (auto-starts dev)
E2E_BASE_URL=https://google-delivery-spark.lovable.app bun run e2e   # against published
bun run e2e:report           # open the last HTML report
```

## What it covers

| Spec | Role | Coverage |
| --- | --- | --- |
| `auth.setup.ts` | all 4 | Logs in each role once and saves the session to `e2e/.auth/<role>.json`. |
| `customer-order.spec.ts` | customer | Browse restaurants → open menu → add item → place a real order via `create_verified_order`. |
| `restaurant-dashboard.spec.ts` | restaurant | Loads the restaurant orders dashboard. |
| `driver-tracking.spec.ts` | driver | Loads the driver dashboard and looks for the job board / earnings UI. |
| `admin-tracking.spec.ts` | admin | Loads the admin dashboard, opens an order, and **cancels every open order whose customer name contains "e2e"** so the suite cleans up after itself. |

## Caveats

- Tests **share the live database**. Run them serially (the config does this) and prefer dedicated test accounts.
- The customer spec places a **real** order — the admin cleanup spec then cancels it. If the admin spec fails to run, you'll need to cancel the order manually.
- Tests pre-grant geolocation to Johannesburg CBD so the service-area check passes. Adjust `geolocation` in `playwright.config.ts` if your service area is configured elsewhere.
- Drivers must already have bank details + be marked online via the dashboard if you want the order spec to dispatch to them; otherwise the order will sit in `ready` until the admin spec cancels it.
