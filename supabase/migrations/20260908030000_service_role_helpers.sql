-- Service-role helpers that must set the security GUC so protected columns can change.

CREATE OR REPLACE FUNCTION public.force_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('admin', 'shop_owner', 'customer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = p_role, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.force_user_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.force_user_role(UUID, TEXT) TO service_role;
