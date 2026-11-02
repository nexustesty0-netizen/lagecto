-- Self-serve account deletion (customers and shop owners) and hide a shop
-- when an admin reverts its owner back to a customer.

CREATE OR REPLACE FUNCTION public.self_delete_account(p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = auth.uid();
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Account not found');
  END IF;
  IF rec.role = 'admin' OR public.is_protected_admin_email(rec.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin accounts cannot be self-deleted');
  END IF;
  IF rec.role NOT IN ('customer', 'shop_owner') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF reason IS NULL OR char_length(reason) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please tell us why you are deleting this account');
  END IF;

  UPDATE public.shops
  SET status = 'inactive',
      is_open = FALSE,
      updated_at = NOW()
  WHERE owner_user_id = rec.id
     OR lower(COALESCE(owner_email, '')) = lower(rec.email);

  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET account_status = 'disabled',
      locked_reason = left('account_deleted: ' || reason, 500),
      updated_at = NOW()
  WHERE id = rec.id;

  PERFORM public.log_security_event(
    'account_self_deleted',
    rec.id,
    rec.id,
    NULL,
    rec.email,
    NULL,
    NULL,
    'success',
    jsonb_build_object('reason', left(reason, 500), 'role', rec.role)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_delete_account(TEXT) TO authenticated;

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
  actor_role TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  actor_role := public.current_admin_role();
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
  IF actor_role = 'manager' AND p_role IS DISTINCT FROM 'shop_owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Managers can only assign shop owner roles');
  END IF;
  IF p_role = 'admin' AND p_admin_role IS NOT NULL
     AND p_admin_role NOT IN ('super_admin', 'staff', 'clerk', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid admin role');
  END IF;
  IF p_role = 'admin' AND COALESCE(p_admin_role, 'staff') IN ('super_admin', 'manager')
     AND COALESCE(actor_role, '') IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can assign managers or super admins');
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
  IF p_role = 'customer' THEN
    UPDATE public.shops
    SET status = 'inactive',
        is_open = FALSE,
        updated_at = NOW()
    WHERE owner_user_id = p_user_id
       OR lower(COALESCE(owner_email, '')) = lower(target.email);
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
