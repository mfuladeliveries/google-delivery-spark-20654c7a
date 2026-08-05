CREATE OR REPLACE FUNCTION public.admin_dispatch_runs(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id bigint,
  created timestamptz,
  status_code integer,
  content text,
  error_msg text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT r.id::bigint,
         r.created,
         r.status_code::integer,
         left(coalesce(r.content, ''), 500) AS content,
         r.error_msg
  FROM net._http_response r
  ORDER BY r.created DESC, r.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dispatch_runs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dispatch_runs(integer) TO authenticated;