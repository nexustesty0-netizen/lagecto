-- Self-serve shop creation (admin can turn it off) and Free shops get every tool for now.

CREATE TABLE IF NOT EXISTS public.platform_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_flags (key, enabled)
VALUES ('self_serve_shop_creation', TRUE)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_flags_read ON public.platform_flags;
CREATE POLICY platform_flags_read ON public.platform_flags
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS platform_flags_admin_write ON public.platform_flags;
CREATE POLICY platform_flags_admin_write ON public.platform_flags
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.platform_flag_enabled(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  on_flag BOOLEAN;
BEGIN
  IF NULLIF(trim(p_key), '') IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT enabled INTO on_flag FROM public.platform_flags WHERE key = trim(p_key);
  RETURN COALESCE(on_flag, FALSE);
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

-- Unpaid shops currently receive every shop tool.
CREATE OR REPLACE FUNCTION public.package_features(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  all_tools JSONB := '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","quotations","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","payroll","receipts","analytics","advanced_pos","advanced_inventory","priority_support","early_access"]'::jsonb;
BEGIN
  IF p_key = 'sandra' OR p_key = 'free' OR p_key IS NULL OR btrim(p_key) = '' THEN
    RETURN all_tools;
  END IF;
  IF p_key = 'kristen' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","quotations","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","payroll","receipts"]'::jsonb;
  END IF;
  IF p_key = 'thabi' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","quotations","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop"]'::jsonb;
  END IF;
  RETURN all_tools;
END;
$$;

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
  IF NOT public.platform_flag_enabled('self_serve_shop_creation') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Public shop creation is turned off. Submit a request and LaGecto will activate your shop.');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = p_user_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF rec.role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Admin accounts cannot own a shop.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shops WHERE owner_user_id = rec.id) THEN
    SELECT * INTO shop_rec FROM public.shops WHERE owner_user_id = rec.id ORDER BY created_at LIMIT 1;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'This account already has a shop.',
      'login_shop_id', shop_rec.login_shop_id
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

  PERFORM public.log_security_event(
    'self_serve_shop_created', rec.id, rec.id, shop_rec.id, rec.email, NULL, NULL, 'success',
    jsonb_build_object('login_shop_id', shop_rec.login_shop_id, 'shop_name', shop_rec.name)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'shop_name', shop_rec.name,
    'provider_type', shop_rec.provider_type
  );
END;
$$;

GRANT SELECT ON public.platform_flags TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.platform_flags TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_flag_enabled(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_flag(TEXT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.self_serve_create_shop(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.self_serve_create_shop(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO postgres, service_role;
