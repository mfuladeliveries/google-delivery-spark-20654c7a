-- 1. Add bank detail columns to driver_profiles
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS bank_account_holder text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_branch_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_type text NOT NULL DEFAULT 'cheque';

-- 2. Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  -- snapshot of bank details at the moment of the request (so later edits don't change history)
  bank_account_holder text NOT NULL,
  bank_name text NOT NULL,
  bank_account_number text NOT NULL,
  bank_branch_code text NOT NULL,
  bank_account_type text NOT NULL,
  admin_notes text,
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_driver ON public.withdrawal_requests(driver_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawal_requests(status, requested_at DESC);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins view all withdrawals"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- No direct insert/update/delete — everything via SECURITY DEFINER functions below.

-- 3. Helper: compute current withdrawable balance
CREATE OR REPLACE FUNCTION public.get_driver_balance(p_driver_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_earnings numeric := 0;
  v_locked numeric := 0;
BEGIN
  -- Only the driver themself or an admin can read their balance
  IF auth.uid() IS NULL OR (auth.uid() <> p_driver_id AND NOT has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT COALESCE(SUM(driver_payout), 0) INTO v_earnings
  FROM public.driver_earnings
  WHERE driver_id = p_driver_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_locked
  FROM public.withdrawal_requests
  WHERE driver_id = p_driver_id
    AND status IN ('pending','approved','paid');

  RETURN GREATEST(v_earnings - v_locked, 0);
END;
$$;

-- 4. Driver requests a withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver uuid;
  v_profile record;
  v_balance numeric;
  v_request_id uuid;
BEGIN
  v_driver := auth.uid();
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal is R100';
  END IF;

  -- Block more than one open (pending/approved) request
  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE driver_id = v_driver AND status IN ('pending','approved')
  ) THEN
    RAISE EXCEPTION 'You already have a withdrawal in progress';
  END IF;

  SELECT bank_account_holder, bank_name, bank_account_number, bank_branch_code, bank_account_type
    INTO v_profile
  FROM public.driver_profiles
  WHERE user_id = v_driver;

  IF v_profile IS NULL
     OR COALESCE(v_profile.bank_account_holder,'') = ''
     OR COALESCE(v_profile.bank_name,'') = ''
     OR COALESCE(v_profile.bank_account_number,'') = ''
     OR COALESCE(v_profile.bank_branch_code,'') = '' THEN
    RAISE EXCEPTION 'Please save your bank details before requesting a withdrawal';
  END IF;

  v_balance := public.get_driver_balance(v_driver);
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Insufficient balance (available: R%)', v_balance;
  END IF;

  INSERT INTO public.withdrawal_requests (
    driver_id, amount, status,
    bank_account_holder, bank_name, bank_account_number, bank_branch_code, bank_account_type
  ) VALUES (
    v_driver, p_amount, 'pending',
    v_profile.bank_account_holder, v_profile.bank_name, v_profile.bank_account_number,
    v_profile.bank_branch_code, v_profile.bank_account_type
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 5. Admin updates a withdrawal request (approve / pay / reject)
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(
  p_request_id uuid,
  p_status text,
  p_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_status NOT IN ('approved','paid','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT status INTO v_current FROM public.withdrawal_requests
  WHERE id = p_request_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;

  -- Validate transitions
  IF NOT (
    (v_current = 'pending'  AND p_status IN ('approved','rejected')) OR
    (v_current = 'approved' AND p_status IN ('paid','rejected'))
  ) THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current, p_status;
  END IF;

  UPDATE public.withdrawal_requests SET
    status = p_status,
    admin_notes = COALESCE(p_notes, admin_notes),
    rejection_reason = CASE WHEN p_status = 'rejected' THEN COALESCE(p_rejection_reason, rejection_reason) ELSE rejection_reason END,
    approved_at = CASE WHEN p_status = 'approved' AND approved_at IS NULL THEN now() ELSE approved_at END,
    paid_at     = CASE WHEN p_status = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
    rejected_at = CASE WHEN p_status = 'rejected' AND rejected_at IS NULL THEN now() ELSE rejected_at END
  WHERE id = p_request_id;
END;
$$;