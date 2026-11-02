-- Super Admin control centre: audited shop/customer actions. No new marketplace modules.

CREATE OR REPLACE FUNCTION public.admin_audit_action(
  p_event_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_target_shop_id UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NULLIF(btrim(COALESCE(p_event_type, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Event type is required');
  END IF;
  PERFORM public.log_security_event(
    left(btrim(p_event_type), 80),
    auth.uid(),
    p_target_user_id,
    p_target_shop_id,
    p_identifier,
    NULL,
    NULL,
    'success',
    COALESCE(p_metadata, '{}'::jsonb)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.users%ROWTYPE;
  next_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF public.current_admin_role() <> 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can change account restrictions');
  END IF;
  next_status := lower(btrim(COALESCE(p_status, '')));
  IF next_status NOT IN ('active', 'locked', 'suspended', 'disabled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown account status');
  END IF;
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF target.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_user(target.id) OR lower(COALESCE(target.email, '')) = 'lagecto@outlook.com' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The platform owner account cannot be restricted');
  END IF;
  IF target.id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot restrict your own account');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET account_status = next_status,
      locked_at = CASE WHEN next_status = 'active' THEN NULL ELSE COALESCE(locked_at, NOW()) END,
      locked_reason = CASE
        WHEN next_status = 'active' THEN NULL
        ELSE NULLIF(left(btrim(COALESCE(p_reason, '')), 180), '')
      END,
      failed_login_attempts = CASE WHEN next_status = 'active' THEN 0 ELSE failed_login_attempts END,
      unlocked_at = CASE WHEN next_status = 'active' THEN NOW() ELSE unlocked_at END,
      unlocked_by = CASE WHEN next_status = 'active' THEN auth.uid() ELSE unlocked_by END,
      updated_at = NOW()
  WHERE id = p_user_id;
  PERFORM public.log_security_event(
    'account_status_changed',
    auth.uid(),
    p_user_id,
    NULL,
    next_status,
    NULL,
    NULL,
    'success',
    jsonb_build_object('status', next_status)
  );
  RETURN jsonb_build_object('ok', true, 'status', next_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_audit_action(TEXT, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(UUID, TEXT, TEXT) TO authenticated;
