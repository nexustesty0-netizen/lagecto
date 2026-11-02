-- Platform admin roles: Super admin, Admin, Manager.
-- Super admin can regenerate a shop's login Shop ID when an owner loses it.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%admin_role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_admin_role_check
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'admin', 'manager', 'staff', 'clerk'));

UPDATE public.users
SET admin_role = 'admin', updated_at = NOW()
WHERE role = 'admin' AND admin_role IN ('staff', 'clerk');

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%admin_role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_admin_role_check
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'admin', 'manager'));

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_protected_admin_user(id) OR admin_role = 'super_admin' THEN 'super_admin'
    WHEN admin_role = 'manager' THEN 'manager'
    ELSE 'admin'
  END
  FROM public.users
  WHERE id = auth.uid()
    AND role = 'admin'
    AND account_status = 'active'
$$;

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
  next_admin TEXT;
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

  next_admin := NULLIF(btrim(COALESCE(p_admin_role, '')), '');
  IF next_admin IN ('staff', 'clerk') THEN
    next_admin := 'admin';
  END IF;
  IF p_role = 'admin' THEN
    next_admin := COALESCE(next_admin, 'admin');
    IF next_admin NOT IN ('super_admin', 'admin', 'manager') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid admin role');
    END IF;
    IF COALESCE(target.admin_role, '') = 'super_admin' AND actor_role IS DISTINCT FROM 'super_admin' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can change a super admin');
    END IF;
    IF next_admin = 'super_admin' AND actor_role IS DISTINCT FROM 'super_admin' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can assign super admins');
    END IF;
  ELSE
    next_admin := NULL;
  END IF;

  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = p_role,
      admin_role = next_admin,
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
    jsonb_build_object('role', p_role, 'admin_role', next_admin, 'shop_id', shop_rec.id)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'provider_type', shop_rec.provider_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_shop_login_id(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
  actor_role TEXT;
  previous_id TEXT;
  next_id TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  actor_role := public.current_admin_role();
  IF actor_role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Managers cannot regenerate Shop IDs');
  END IF;
  SELECT * INTO shop_rec FROM public.shops WHERE id = p_shop_id;
  IF shop_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;
  previous_id := shop_rec.login_shop_id;
  next_id := public.generate_shop_login_id(shop_rec.name);
  UPDATE public.shops
  SET login_shop_id = next_id,
      updated_at = NOW()
  WHERE id = p_shop_id;
  PERFORM public.log_security_event(
    'shop_login_id_regenerated', auth.uid(), shop_rec.owner_user_id, p_shop_id, next_id, NULL, NULL, 'success',
    jsonb_build_object('previous_login_shop_id', previous_id, 'login_shop_id', next_id, 'shop_name', shop_rec.name)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'shop_name', shop_rec.name,
    'previous_login_shop_id', previous_id,
    'login_shop_id', next_id
  );
END;
$$;

DROP POLICY IF EXISTS security_admin_read ON public.security_events;
CREATE POLICY security_admin_read ON public.security_events FOR SELECT
  USING (public.is_platform_admin() AND public.current_admin_role() = 'super_admin');

GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_shop_login_id(UUID) TO authenticated;
