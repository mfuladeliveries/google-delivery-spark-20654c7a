import { supabase } from "@/integrations/supabase/client";

interface PushNotifyParams {
  order_id: string;
  order_number: number;
  status: string;
  restaurant?: string;
  total?: number;
  user_id?: string;
  driver_id?: string | null;
  restaurant_id?: string | null;
  old_status?: string | null;
}

export const sendPushNotification = (params: PushNotifyParams) => {
  supabase.functions.invoke("push-notify", { body: params }).catch(() => {});
};
