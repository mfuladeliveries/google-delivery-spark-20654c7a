create or replace function public.check_email_verified(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmed_at timestamptz;
  v_email text;
begin
  select email, email_confirmed_at
  into v_email, v_confirmed_at
  from auth.users
  where email = p_email
  limit 1;

  if v_email is null then
    return json_build_object('exists', false, 'confirmed', false);
  end if;

  return json_build_object('exists', true, 'confirmed', v_confirmed_at is not null);
end;
$$;

grant execute on function public.check_email_verified(text) to anon;
grant execute on function public.check_email_verified(text) to authenticated;