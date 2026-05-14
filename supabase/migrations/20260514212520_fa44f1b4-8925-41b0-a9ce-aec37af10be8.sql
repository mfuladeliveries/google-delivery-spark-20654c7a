-- Re-apply column-level revoke and ensure it sticks. Postgres column ACLs override table-level grants per-column.
REVOKE SELECT (owner_user_id) ON public.restaurants FROM anon;
REVOKE SELECT (owner_user_id) ON public.restaurants FROM PUBLIC;