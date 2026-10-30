-- Auto-create a shop when a user is assigned as shop owner, and capture products/services/both.

CREATE OR REPLACE FUNCTION public.ensure_shop_for_owner(
  p_user_id UUID,
  p_shop_id UUID DEFAULT NULL,
  p_shop_name TEXT DEFAULT NULL,
  p_provider_type TEXT DEFAULT 'both',
  p_category TEXT DEFAULT 'other'
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  shop_rec public.shops%ROWTYPE;
  provider TEXT := COALESCE(NULLIF(trim(p_provider_type), ''), 'both');
  category TEXT := COALESCE(NULLIF(trim(p_category), ''), 'other');
  shop_name TEXT;
BEGIN
  IF provider NOT IN ('products', 'services', 'both') THEN
    RAISE EXCEPTION 'Invalid provider type';
  END IF;

  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  shop_name := COALESCE(
    NULLIF(trim(p_shop_name), ''),
    NULLIF(trim(rec.name), ''),
    split_part(rec.email, '@', 1),
    'Shop'
  );

  IF p_shop_id IS NOT NULL THEN
    UPDATE public.shops
    SET
      owner_user_id = rec.id,
      owner_email = rec.email,
      owner_name = rec.name,
      name = COALESCE(NULLIF(trim(p_shop_name), ''), name),
      provider_type = provider,
      updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO shop_rec;
    IF shop_rec.id IS NULL THEN
      RAISE EXCEPTION 'Shop not found';
    END IF;
    RETURN shop_rec;
  END IF;

  SELECT * INTO shop_rec
  FROM public.shops
  WHERE owner_user_id = rec.id
     OR lower(COALESCE(owner_email, '')) = lower(rec.email)
  ORDER BY created_at
  LIMIT 1;

  IF shop_rec.id IS NOT NULL THEN
    UPDATE public.shops
    SET
      owner_user_id = rec.id,
      owner_email = rec.email,
      owner_name = rec.name,
      name = COALESCE(NULLIF(trim(p_shop_name), ''), name),
      provider_type = provider,
      updated_at = NOW()
    WHERE id = shop_rec.id
    RETURNING * INTO shop_rec;
    RETURN shop_rec;
  END IF;

  INSERT INTO public.shops (
    name,
    login_shop_id,
    owner_user_id,
    owner_name,
    owner_email,
    category,
    provider_type,
    email,
    phone,
    status,
    verification_status
  )
  VALUES (
    shop_name,
    public.generate_shop_login_id(shop_name),
    rec.id,
    rec.name,
    rec.email,
    category,
    provider,
    rec.email,
    rec.phone,
    'active',
    'unverified'
  )
  RETURNING * INTO shop_rec;

  RETURN shop_rec;
END;
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
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
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

DROP FUNCTION IF EXISTS public.admin_promote_shop_owner(UUID, UUID);

CREATE FUNCTION public.admin_promote_shop_owner(
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

REVOKE ALL ON FUNCTION public.ensure_shop_for_owner(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_shop_for_owner(UUID, UUID, TEXT, TEXT, TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_shop_owner(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
