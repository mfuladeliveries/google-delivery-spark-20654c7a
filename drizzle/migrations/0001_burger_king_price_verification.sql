CREATE OR REPLACE FUNCTION public.guard_burger_king_verified_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.items) elem JOIN public.menu_items m ON m.id::text=elem->>'id' JOIN public.restaurants r ON r.id=m.restaurant_id WHERE lower(trim(r.name))='burger king' AND (NOT m.price_verified OR NOT m.is_available OR m.price<=0)) THEN
 RAISE EXCEPTION 'Burger King branch price awaiting admin verification' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER burger_king_verified_order_guard BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_burger_king_verified_order();