---
name: Payment Test Mode
description: Admin Live/Test payment mode switch, per-order payment_environment, strict live/test Yoco credential separation
type: feature
---
Admin can switch Payment Mode between Live and Test in Admin Panel > payments tab (`AdminPaymentMode.tsx`), stored in `app_settings.payment_mode = {"mode":"live"|"test"}` (admin-only read/write).

- `orders.payment_environment` ('live'|'test', default 'live') records the mode each order was created in; verify/webhook/refund always follow the order's own value, never the current setting.
- Test mode uses `YOCO_TEST_SECRET_KEY` (must start with `sk_test`) + `YOCO_TEST_WEBHOOK_SECRET`; `secretKey(mode)` throws rather than falling back to live keys. Checkout returns 409 if test mode is on without a test key.
- Webhook verification tries both live and test signing secrets and returns the matched mode.
- TEST badges: admin order rows, customer Orders list, PaymentResult banner.
