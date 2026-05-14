
-- 1) Restrict restaurant-owner UPDATE on orders to only safe columns via a trigger
CREATE OR REPLACE FUNCTION public.enforce_restaurant_order_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the system bypass column restrictions
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- If caller is the restaurant owner (and not also the customer/driver),
  -- only allow whitelisted columns to change.
  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = NEW.restaurant_id AND r.owner_user_id = auth.uid()
  ) AND NEW.user_id <> auth.uid() AND COALESCE(NEW.driver_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid() THEN
    IF NEW.total IS DISTINCT FROM OLD.total
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax IS DISTINCT FROM OLD.tax
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.tip IS DISTINCT FROM OLD.tip
       OR NEW.credits_applied IS DISTINCT FROM OLD.credits_applied
       OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
       OR NEW.refund_status IS DISTINCT FROM OLD.refund_status
       OR NEW.refund_method IS DISTINCT FROM OLD.refund_method
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.customer_contact IS DISTINCT FROM OLD.customer_contact
       OR NEW.customer_address IS DISTINCT FROM OLD.customer_address
       OR NEW.customer_lat IS DISTINCT FROM OLD.customer_lat
       OR NEW.customer_lng IS DISTINCT FROM OLD.customer_lng
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
       OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider
       OR NEW.payment_provider_txn_id IS DISTINCT FROM OLD.payment_provider_txn_id
       OR NEW.delivery_code IS DISTINCT FROM OLD.delivery_code
       OR NEW.delivery_code_hash IS DISTINCT FROM OLD.delivery_code_hash
       OR NEW.admin_delivery_code IS DISTINCT FROM OLD.admin_delivery_code
       OR NEW.order_number IS DISTINCT FROM OLD.order_number
       OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    THEN
      RAISE EXCEPTION 'Restaurant owners may only update order status / approval fields, not %',
        'pricing, customer PII, payment, or identity columns'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_order_update_cols ON public.orders;
CREATE TRIGGER trg_restaurant_order_update_cols
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_restaurant_order_update_columns();

-- 2) Hide owner_user_id on restaurants from anonymous visitors
REVOKE SELECT (owner_user_id) ON public.restaurants FROM anon;
