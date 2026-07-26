
-- menu_items: split the policy so anon only sees available items, without touching restaurants.owner_user_id
DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;

CREATE POLICY "Public can view available menu items"
  ON public.menu_items FOR SELECT
  TO anon
  USING (is_available = true);

CREATE POLICY "Authenticated can view menu items"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (
    is_available = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_items.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
  );

-- orders: scope public-role policies to authenticated so anon never evaluates them
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = customer_id);

DROP POLICY IF EXISTS "Restaurant owners can view their orders" ON public.orders;
CREATE POLICY "Restaurant owners can view their orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = orders.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    AND status <> 'pending_payment'
  );

DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
