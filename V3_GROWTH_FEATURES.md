# Mfula Deliveries V3 — Growth Features

## Included
- Customer favourites (existing feature retained)
- One-tap reorder from delivered orders (existing feature retained)
- Promo codes: admin creation, percent/fixed discounts, minimum order, max discount, usage limits, one use per customer
- Referral codes: each customer gets a personal code; referred new customer gets R10 off; referrer gets R10 wallet credit after first delivered order
- WhatsApp notification outbox for confirmed, preparing, ready, driver assigned, out for delivery, delivered and cancelled/rejected states
- Meta WhatsApp Cloud API queue processor Edge Function
- Restaurant performance report: 7/30/90 day orders, delivered, revenue, average order, completion/cancellation rate and average delivery time
- Driver performance report: 7/30/90 day deliveries, earnings, completion/cancellation rate and average order time

## Deployment required
1. Apply `supabase/migrations/20260912143000_growth_features.sql` to the live Supabase project.
2. Deploy `process-whatsapp-queue` as a Supabase Edge Function.
3. Set Supabase Edge Function secrets: `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
4. For business-initiated WhatsApp messages, create/approve a Meta WhatsApp template with one body variable and set `WHATSAPP_TEMPLATE_NAME`; optionally set `WHATSAPP_TEMPLATE_LANGUAGE` (default `en_US`). Without a template, free-form text only works where Meta permits an active customer-service conversation window.
5. Schedule the Edge Function (for example every minute) or call it from a trusted server/cron. Do not expose the service-role key to the browser.

## Referral defaults
The V3 migration uses R10 off for the new customer and R10 wallet credit for the referrer. These values are in the SQL migration and can be changed before applying it if the business wants a different launch offer.
