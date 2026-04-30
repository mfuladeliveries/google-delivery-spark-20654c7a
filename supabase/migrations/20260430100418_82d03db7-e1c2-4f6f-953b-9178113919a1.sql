-- Force PostgREST to reload its schema cache so the new create_verified_order
-- signature (with p_customer_lat / p_customer_lng) becomes visible to the API.
NOTIFY pgrst, 'reload schema';