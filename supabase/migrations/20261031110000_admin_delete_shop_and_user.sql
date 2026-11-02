-- Super admin can permanently delete a shop or a user.

CREATE OR REPLACE FUNCTION public.admin_purge_shop(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.payments') IS NOT NULL THEN
    DELETE FROM public.payments
    WHERE shop_id = p_shop_id
       OR order_id IN (SELECT id FROM public.orders WHERE shop_id = p_shop_id);
  END IF;
  DELETE FROM public.shops WHERE id = p_shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
  owner_id UUID;
  remaining INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF public.current_admin_role() IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can delete shops');
  END IF;
  SELECT * INTO shop_rec FROM public.shops WHERE id = p_shop_id;
  IF shop_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;
  owner_id := shop_rec.owner_user_id;
  PERFORM public.admin_purge_shop(p_shop_id);
  IF owner_id IS NOT NULL THEN
    SELECT count(*) INTO remaining FROM public.shops WHERE owner_user_id = owner_id;
    IF remaining = 0 THEN
      PERFORM set_config('lagecto.allow_security_update', 'true', true);
      UPDATE public.users
      SET role = CASE WHEN role = 'shop_owner' THEN 'customer' ELSE role END,
          updated_at = NOW()
      WHERE id = owner_id
        AND role = 'shop_owner'
        AND NOT public.is_protected_admin_email(email);
    END IF;
  END IF;
  PERFORM public.log_security_event(
    'shop_deleted',
    auth.uid(),
    owner_id,
    NULL,
    shop_rec.login_shop_id,
    NULL,
    NULL,
    'success',
    jsonb_build_object('shop_id', p_shop_id, 'shop_name', shop_rec.name, 'login_shop_id', shop_rec.login_shop_id)
  );
  RETURN jsonb_build_object('ok', true, 'shop_id', p_shop_id, 'shop_name', shop_rec.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.users%ROWTYPE;
  shop_rec public.shops%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF public.current_admin_role() IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can delete users');
  END IF;
  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot delete your own account');
  END IF;
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF target.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_email(target.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The platform owner account cannot be deleted');
  END IF;

  FOR shop_rec IN
    SELECT * FROM public.shops
    WHERE owner_user_id = p_user_id
       OR lower(COALESCE(owner_email, '')) = lower(target.email)
  LOOP
    PERFORM public.admin_purge_shop(shop_rec.id);
  END LOOP;

  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  DELETE FROM public.users WHERE id = p_user_id;

  PERFORM public.log_security_event(
    'user_deleted',
    auth.uid(),
    NULL,
    NULL,
    target.email,
    NULL,
    NULL,
    'success',
    jsonb_build_object('user_id', p_user_id, 'email', target.email, 'name', target.name, 'role', target.role)
  );
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_shop(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
