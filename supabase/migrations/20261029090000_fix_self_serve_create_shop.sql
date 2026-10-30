-- Make public shop creation succeed even if the profile trigger is slow,
-- and return a JSON error instead of a hard SQL exception.

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
  flag_on BOOLEAN;
BEGIN
  IF to_regclass('public.platform_flags') IS NOT NULL THEN
    SELECT enabled INTO flag_on FROM public.platform_flags WHERE key = 'self_serve_shop_creation';
    IF flag_on IS FALSE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Public shop creation is turned off. Submit a request and LaGecto will activate your shop.');
    END IF;
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

CREATE OR REPLACE FUNCTION public.shops_after_insert_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
    PERFORM public.ensure_shop_loyalty_program(NEW.id);
    PERFORM public.try_enroll_founding_shop(NEW.id);
    PERFORM public.evaluate_shop_achievements(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
