
DROP POLICY IF EXISTS "Restaurant owners can manage their menu items" ON public.menu_items;
CREATE POLICY "Restaurant owners can manage their menu items"
  ON public.menu_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_items.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_items.restaurant_id
        AND r.owner_user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );
