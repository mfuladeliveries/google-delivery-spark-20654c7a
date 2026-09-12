# Mfula Deliveries V2 Improvements

This V2 keeps the FINAL_UPDATED project as the base and adds operational reliability improvements.

## Added
- Operations health checks in Admin > Health:
  - active order count
  - orders delayed more than 60 minutes
  - ready/no-driver orders waiting more than 15 minutes
  - active orders with payment-status problems
- Driver multi-order prioritisation:
  - out-for-delivery first
  - arrived at restaurant second
  - picking up third
  - newly assigned after that
- Multi-order workload banner on the driver dashboard.
- Lightweight remaining-time estimate on assigned driver order cards.
- Unit tests for operational-health summaries, route priority and workload ETA penalty.
- Admin header shortcut to Health diagnostics.

## Preserved
- Mfuleni E2E coordinates: -33.99472, 18.67583
- Yoco payment integration
- existing QA fixes
- existing multi-order database migration
- dispatch monitor
- delivery PIN flow

## Validation
- TypeScript typecheck passes (`npm run typecheck`).
- Vitest could not be executed in this environment because the local `vitest` binary/dependencies are not installed.
- No duplicate Supabase migration was introduced.
