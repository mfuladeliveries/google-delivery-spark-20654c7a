ALTER TABLE public.menu_items ADD COLUMN price_verified boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.menu_items.price_verified IS 'Admin-confirmed price for the configured delivery branches. Existing menus remain unchanged; Steers imports require verification.';
UPDATE public.menu_items SET price_verified=false WHERE restaurant_id IN (SELECT id FROM public.restaurants WHERE lower(trim(name))='steers');
CREATE OR REPLACE FUNCTION public.guard_steers_verified_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.items) elem JOIN public.menu_items m ON m.id::text=elem->>'id' JOIN public.restaurants r ON r.id=m.restaurant_id WHERE lower(trim(r.name))='steers' AND (NOT m.price_verified OR NOT m.is_available OR m.price<=0)) THEN
 RAISE EXCEPTION 'Steers branch price awaiting admin verification' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER steers_verified_order_guard BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_steers_verified_order();