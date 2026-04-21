CREATE POLICY "Users view own notification log"
  ON public.order_notification_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);