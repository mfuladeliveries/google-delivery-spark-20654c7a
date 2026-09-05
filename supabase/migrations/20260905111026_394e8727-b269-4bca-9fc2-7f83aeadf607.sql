CREATE OR REPLACE FUNCTION public.enforce_driver_profile_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow trusted system paths: SECURITY DEFINER functions (current_user is the
  -- function owner, not the API role) and nested trigger chains such as
  -- update_driver_earnings() crediting a driver on delivery completion.
  IF current_user NOT IN ('authenticated', 'anon') OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
     OR NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
     OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
     OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
     OR NEW.bank_branch_code IS DISTINCT FROM OLD.bank_branch_code
     OR NEW.bank_account_type IS DISTINCT FROM OLD.bank_account_type
  THEN
    RAISE EXCEPTION 'You are not allowed to change these fields.';
  END IF;

  RETURN NEW;
END;
$function$;