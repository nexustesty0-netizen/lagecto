-- Cap self-serve shop creation at 12, then close the portal.
-- Shop owners can assign a registered person as cashier, shop admin, or manager.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS self_serve BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.shops s
SET self_serve = TRUE
WHERE s.self_serve = FALSE
  AND EXISTS (
    SELECT 1
    FROM public.security_events e
    WHERE e.target_shop_id = s.id
      AND e.event_type = 'self_serve_shop_created'
  );

CREATE OR REPLACE FUNCTION public.self_serve_shop_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 12;
$$;

CREATE OR REPLACE FUNCTION public.self_serve_shop_used()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.shops WHERE self_serve = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.close_self_serve_shop_portal()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_flags (key, enabled, updated_at)
  VALUES ('self_serve_shop_creation', FALSE, NOW())
  ON CONFLICT (key) DO UPDATE
    SET enabled = FALSE,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.self_serve_portal_open()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.self_serve_shop_used() >= public.self_serve_shop_limit() THEN
    PERFORM public.close_self_serve_shop_portal();
    RETURN FALSE;
  END IF;
  RETURN public.platform_flag_enabled('self_serve_shop_creation');
END;
$$;

CREATE OR REPLACE FUNCTION public.self_serve_shop_portal()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used INTEGER := public.self_serve_shop_used();
  lim INTEGER := public.self_serve_shop_limit();
  flag_on BOOLEAN := public.platform_flag_enabled('self_serve_shop_creation');
  open_now BOOLEAN;
BEGIN
  open_now := flag_on AND used < lim;
  IF used >= lim AND flag_on THEN
    PERFORM public.close_self_serve_shop_portal();
    open_now := FALSE;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'open', open_now,
    'used', used,
    'limit', lim,
    'remaining', GREATEST(lim - used, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_platform_flag(p_key TEXT, p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key TEXT := lower(trim(p_key));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF key <> 'self_serve_shop_creation' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown setting');
  END IF;
  IF COALESCE(p_enabled, FALSE) AND public.self_serve_shop_used() >= public.self_serve_shop_limit() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The 12 self-serve shops are already used. New shops must request activation.');
  END IF;
  INSERT INTO public.platform_flags (key, enabled, updated_at, updated_by)
  VALUES (key, COALESCE(p_enabled, FALSE), NOW(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_at = NOW(),
        updated_by = auth.uid();
  PERFORM public.log_security_event(
    'platform_flag_toggle', auth.uid(), NULL, NULL, key, NULL, NULL, 'success',
    jsonb_build_object('enabled', COALESCE(p_enabled, FALSE))
  );
  RETURN jsonb_build_object('ok', true, 'key', key, 'enabled', COALESCE(p_enabled, FALSE));
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_serve_shop_portal() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.self_serve_portal_open() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_is_shop_owner(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = p_shop_id
      AND (
        owner_user_id = auth.uid()
        OR lower(COALESCE(owner_email, '')) = lower(COALESCE(public.current_user_email(), ''))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_staff_role(p_shop_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.role_name
  FROM public.shop_staff_assignments a
  WHERE a.shop_id = p_shop_id AND a.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_owns_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_shop_owner(p_shop_id) OR public.shop_staff_role(p_shop_id) IS NOT NULL;
$$;

DROP POLICY IF EXISTS shops_owner_manage ON public.shops;
CREATE POLICY shops_owner_manage ON public.shops FOR ALL
  USING (public.is_platform_admin() OR public.user_is_shop_owner(id))
  WITH CHECK (public.is_platform_admin() OR public.user_is_shop_owner(id));

DROP POLICY IF EXISTS shops_staff_read ON public.shops;
CREATE POLICY shops_staff_read ON public.shops FOR SELECT
  USING (public.shop_staff_role(id) IS NOT NULL);

UPDATE public.shop_staff_assignments SET role_name = 'cashier' WHERE role_name = 'staff';
ALTER TABLE public.shop_staff_assignments DROP CONSTRAINT IF EXISTS shop_staff_assignments_role_name_check;
ALTER TABLE public.shop_staff_assignments
  ADD CONSTRAINT shop_staff_assignments_role_name_check
  CHECK (role_name IN ('cashier', 'admin', 'manager'));

CREATE OR REPLACE FUNCTION public.shop_lookup_staff_candidate(p_email TEXT, p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  email TEXT := lower(trim(COALESCE(p_email, '')));
  uname TEXT := lower(trim(COALESCE(p_username, '')));
BEGIN
  IF email = '' OR uname = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter both email and username.');
  END IF;
  SELECT * INTO rec
  FROM public.users
  WHERE lower(email) = email AND username_normalized = uname
  LIMIT 1;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No registered person matches that email and username.');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'user_id', rec.id,
    'name', rec.name,
    'email', rec.email,
    'username', rec.username,
    'role', rec.role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_assign_staff(p_email TEXT, p_username TEXT, p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
  rec public.users%ROWTYPE;
  role TEXT := lower(trim(COALESCE(p_role, '')));
  found JSONB;
BEGIN
  SELECT s.id INTO v_shop
  FROM public.shops s
  WHERE public.user_is_shop_owner(s.id)
  ORDER BY s.created_at
  LIMIT 1;
  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the shop owner can assign staff.');
  END IF;
  IF role NOT IN ('cashier', 'admin', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose cashier, admin, or manager.');
  END IF;
  found := public.shop_lookup_staff_candidate(p_email, p_username);
  IF COALESCE((found->>'ok')::boolean, FALSE) IS NOT TRUE THEN
    RETURN found;
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = (found->>'user_id')::uuid;
  IF rec.id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You already own this shop.');
  END IF;
  IF rec.role = 'shop_owner' OR EXISTS (SELECT 1 FROM public.shops WHERE owner_user_id = rec.id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot make a shop owner a cashier or shop staff.');
  END IF;
  IF rec.role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot assign a platform admin.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shop_staff_assignments WHERE user_id = rec.id AND shop_id <> v_shop) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This email already belongs to one account at another shop.');
  END IF;

  INSERT INTO public.shop_staff_assignments (shop_id, user_id, role_name)
  VALUES (v_shop, rec.id, role)
  ON CONFLICT (shop_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name;

  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      rec.id,
      'Shop access',
      'You were assigned as ' || role || ' for a shop. Sign in with this same email — it cannot be used on another account.',
      'general'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'user_id', rec.id, 'role', role, 'name', rec.name);
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_unassign_staff(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
BEGIN
  SELECT s.id INTO v_shop
  FROM public.shops s
  WHERE public.user_is_shop_owner(s.id)
  ORDER BY s.created_at
  LIMIT 1;
  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the shop owner can remove staff.');
  END IF;
  DELETE FROM public.shop_staff_assignments WHERE shop_id = v_shop AND user_id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_shop_staff(
  p_shop_id UUID,
  p_user_id UUID,
  p_role_name TEXT DEFAULT 'cashier'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role TEXT := lower(trim(COALESCE(p_role_name, 'cashier')));
  rec public.users%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF role = 'staff' THEN
    role := 'cashier';
  END IF;
  IF role NOT IN ('cashier', 'admin', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid staff role');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF rec.role = 'shop_owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot make a shop owner a cashier.');
  END IF;
  INSERT INTO public.shop_staff_assignments (shop_id, user_id, role_name)
  VALUES (p_shop_id, p_user_id, role)
  ON CONFLICT (shop_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_is_shop_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_staff_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_lookup_staff_candidate(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_assign_staff(TEXT, TEXT, TEXT) TO authenticated;
CREATE OR REPLACE FUNCTION public.shop_list_staff()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop UUID;
BEGIN
  SELECT s.id INTO v_shop
  FROM public.shops s
  WHERE public.user_is_shop_owner(s.id) OR public.shop_staff_role(s.id) IS NOT NULL
  ORDER BY CASE WHEN public.user_is_shop_owner(s.id) THEN 0 ELSE 1 END, s.created_at
  LIMIT 1;
  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', u.id,
        'role_name', a.role_name,
        'name', u.name,
        'email', u.email,
        'username', u.username
      ) ORDER BY u.name)
      FROM public.shop_staff_assignments a
      JOIN public.users u ON u.id = a.user_id
      WHERE a.shop_id = v_shop
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_unassign_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_list_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.self_serve_create_shop(
  p_user_id UUID,
  p_shop_name TEXT,
  p_provider_type TEXT DEFAULT 'both',
  p_category TEXT DEFAULT 'other',
  p_phone TEXT DEFAULT NULL,
  p_about TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  shop_rec public.shops%ROWTYPE;
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_about TEXT := NULLIF(trim(COALESCE(p_about, '')), '');
  v_email TEXT := NULLIF(trim(COALESCE(p_email, '')), '');
BEGIN
  IF NOT public.self_serve_portal_open() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Self-serve shop creation is closed. Submit a request and LaGecto will activate your shop.');
  END IF;

  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    INSERT INTO public.users (id, email, name, phone, role)
    SELECT
      au.id,
      lower(trim(COALESCE(au.email, v_email, ''))),
      COALESCE(NULLIF(trim(au.raw_user_meta_data->>'name'), ''), NULLIF(trim(p_shop_name), ''), 'Shop owner'),
      COALESCE(v_phone, NULLIF(trim(au.raw_user_meta_data->>'phone'), '')),
      'customer'
    FROM auth.users au
    WHERE au.id = p_user_id
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_settings (user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
    SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  END IF;

  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF rec.role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin accounts cannot own a shop.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shops WHERE owner_user_id = rec.id) THEN
    SELECT * INTO shop_rec FROM public.shops WHERE owner_user_id = rec.id ORDER BY created_at LIMIT 1;
    PERFORM public.enroll_register_shop_founding(shop_rec.id);
    RETURN jsonb_build_object(
      'ok', true,
      'shop_id', shop_rec.id,
      'login_shop_id', shop_rec.login_shop_id,
      'shop_name', shop_rec.name,
      'provider_type', shop_rec.provider_type
    );
  END IF;

  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = 'shop_owner',
      admin_role = NULL,
      name = COALESCE(NULLIF(trim(rec.name), ''), NULLIF(trim(p_shop_name), ''), rec.name),
      phone = COALESCE(v_phone, rec.phone),
      updated_at = NOW()
  WHERE id = rec.id;

  shop_rec := public.ensure_shop_for_owner(
    rec.id,
    NULL,
    p_shop_name,
    COALESCE(NULLIF(trim(p_provider_type), ''), 'both'),
    COALESCE(NULLIF(trim(p_category), ''), 'other')
  );

  UPDATE public.shops
  SET
    phone = COALESCE(v_phone, shops.phone),
    whatsapp_number = COALESCE(shops.whatsapp_number, v_phone),
    about = COALESCE(v_about, shops.about),
    email = COALESCE(v_email, shops.email),
    status = 'active',
    verification_status = COALESCE(shops.verification_status, 'unverified'),
    self_serve = TRUE,
    updated_at = NOW()
  WHERE id = shop_rec.id
  RETURNING * INTO shop_rec;

  BEGIN
    PERFORM public.log_security_event(
      'self_serve_shop_created', rec.id, rec.id, shop_rec.id, rec.email, NULL, NULL, 'success',
      jsonb_build_object('login_shop_id', shop_rec.login_shop_id, 'shop_name', shop_rec.name)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM public.enroll_register_shop_founding(shop_rec.id);

  IF public.self_serve_shop_used() >= public.self_serve_shop_limit() THEN
    PERFORM public.close_self_serve_shop_portal();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'shop_name', shop_rec.name,
    'provider_type', shop_rec.provider_type
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to create this shop: ' || SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.self_serve_create_shop(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_serve_create_shop(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO postgres, service_role;
