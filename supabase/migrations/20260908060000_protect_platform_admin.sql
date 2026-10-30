-- lagecto@outlook.com is platform admin only and cannot become staff, shop owner, or customer.

CREATE OR REPLACE FUNCTION public.is_protected_admin_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(p_email, ''))) = 'lagecto@outlook.com';
$$;

CREATE OR REPLACE FUNCTION public.is_protected_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND public.is_protected_admin_email(email)
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_platform_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_protected_admin_email(COALESCE(NEW.email, OLD.email)) THEN
    NEW.role := 'admin';
    NEW.admin_role := 'super_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_platform_owner ON public.users;
CREATE TRIGGER users_protect_platform_owner
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_platform_owner();

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_admin_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
  target public.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF target.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_email(target.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lagecto@outlook.com is platform admin only and cannot be staff or a shop.');
  END IF;
  IF p_user_id = auth.uid() AND p_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot demote your own admin account');
  END IF;
  IF p_role NOT IN ('admin', 'shop_owner', 'customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid role');
  END IF;
  IF p_role = 'admin' AND p_admin_role IS NOT NULL
     AND p_admin_role NOT IN ('super_admin', 'staff', 'clerk') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid admin role');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = p_role,
      admin_role = CASE WHEN p_role = 'admin' THEN COALESCE(p_admin_role, 'staff') ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_user_id;
  IF p_role = 'shop_owner' THEN
    shop_rec := public.ensure_shop_for_owner(p_user_id);
  END IF;
  PERFORM public.log_security_event(
    'role_assigned', auth.uid(), p_user_id, shop_rec.id, NULL, NULL, NULL, 'success',
    jsonb_build_object('role', p_role, 'admin_role', p_admin_role, 'shop_id', shop_rec.id)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'provider_type', shop_rec.provider_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_promote_shop_owner(
  p_user_id UUID,
  p_shop_id UUID DEFAULT NULL,
  p_shop_name TEXT DEFAULT NULL,
  p_provider_type TEXT DEFAULT 'both',
  p_category TEXT DEFAULT 'other'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  shop_rec public.shops%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_email(rec.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lagecto@outlook.com is platform admin only and cannot be a shop.');
  END IF;
  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change your own role this way');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users SET role = 'shop_owner', admin_role = NULL, updated_at = NOW() WHERE id = p_user_id;
  shop_rec := public.ensure_shop_for_owner(p_user_id, p_shop_id, p_shop_name, p_provider_type, p_category);
  PERFORM public.log_security_event(
    'promoted_shop_owner', auth.uid(), p_user_id, shop_rec.id, rec.email, NULL, NULL, 'success',
    jsonb_build_object(
      'login_shop_id', shop_rec.login_shop_id,
      'provider_type', shop_rec.provider_type,
      'shop_name', shop_rec.name
    )
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'provider_type', shop_rec.provider_type,
    'shop_name', shop_rec.name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_shop_staff(
  p_shop_id UUID,
  p_user_id UUID,
  p_role_name TEXT DEFAULT 'staff'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_email(rec.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lagecto@outlook.com is platform admin only and cannot be staff.');
  END IF;
  IF p_role_name NOT IN ('manager', 'staff') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid staff role');
  END IF;
  INSERT INTO public.shop_staff_assignments (shop_id, user_id, role_name)
  VALUES (p_shop_id, p_user_id, p_role_name)
  ON CONFLICT (shop_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name;
  PERFORM public.log_security_event(
    'staff_assigned', auth.uid(), p_user_id, p_shop_id, NULL, NULL, NULL, 'success',
    jsonb_build_object('role_name', p_role_name)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.force_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_protected_admin_user(p_user_id) AND p_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'lagecto@outlook.com is platform admin only';
  END IF;
  IF p_role NOT IN ('admin', 'shop_owner', 'customer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = p_role, updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

UPDATE public.users
SET role = 'admin', admin_role = 'super_admin', updated_at = NOW()
WHERE public.is_protected_admin_email(email);

GRANT EXECUTE ON FUNCTION public.is_protected_admin_email(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_protected_admin_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_shop_owner(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_shop_staff(UUID, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.force_user_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.force_user_role(UUID, TEXT) TO service_role;
