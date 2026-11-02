-- Shops created from Register a shop become Founding Users automatically.
-- Enrollment is not blocked by campaign dates or remaining places.

CREATE OR REPLACE FUNCTION public.try_enroll_founding_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  camp public.campaigns%ROWTYPE;
  shop public.shops%ROWTYPE;
  months INTEGER := 3;
  pkg TEXT := 'thabi';
  plan_rec public.subscription_plans%ROWTYPE;
  ends TIMESTAMPTZ;
  force_enroll BOOLEAN := current_setting('lagecto.force_founding_enroll', true) = 'true';
BEGIN
  IF NOT (
    public.is_platform_admin()
    OR public.user_owns_shop(p_shop_id)
    OR current_setting('lagecto.allow_loyalty_eval', true) = 'true'
    OR force_enroll
    OR COALESCE(auth.role(), '') = 'service_role'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO shop FROM public.shops WHERE id = p_shop_id;
  IF shop.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;

  SELECT * INTO camp
  FROM public.campaigns
  WHERE kind = 'founding_users' AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  ORDER BY created_at
  LIMIT 1;

  IF camp.id IS NULL AND force_enroll THEN
    SELECT * INTO camp
    FROM public.campaigns
    WHERE kind = 'founding_users'
    ORDER BY is_active DESC, created_at
    LIMIT 1;
  END IF;

  IF camp.id IS NULL AND force_enroll THEN
    INSERT INTO public.campaigns (
      slug, name, description, kind, is_active, starts_at, ends_at, max_enrollments, eligibility, benefit
    ) VALUES (
      'founding-users',
      'Founding Users',
      'Shops created from Register a shop are Founding Users.',
      'founding_users',
      TRUE,
      NOW(),
      NULL,
      NULL,
      jsonb_build_object('shop_must_be_new', true),
      jsonb_build_object('package_key', 'thabi', 'duration_months', 3, 'amount', 0, 'listing', 'free_for_3_months')
    )
    ON CONFLICT (slug) DO UPDATE SET kind = 'founding_users'
    RETURNING * INTO camp;
  END IF;

  IF camp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active founding campaign');
  END IF;

  IF NOT force_enroll AND camp.max_enrollments IS NOT NULL AND camp.enrollment_count >= camp.max_enrollments THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This founding offer is fully subscribed');
  END IF;

  IF EXISTS (SELECT 1 FROM public.campaign_enrollments e WHERE e.campaign_id = camp.id AND e.shop_id = p_shop_id) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  months := COALESCE((camp.benefit->>'duration_months')::int, 3);
  pkg := COALESCE(NULLIF(camp.benefit->>'package_key', ''), 'thabi');
  ends := NOW() + make_interval(months => months);

  SELECT * INTO plan_rec
  FROM public.subscription_plans
  WHERE package_key = pkg AND is_active
  ORDER BY CASE WHEN months = 3 THEN 0 ELSE 1 END, price
  LIMIT 1;

  INSERT INTO public.campaign_enrollments (campaign_id, user_id, shop_id, status, benefit_applied, starts_at, ends_at)
  VALUES (
    camp.id, shop.owner_user_id, shop.id, 'active',
    jsonb_build_object('package_key', pkg, 'duration_months', months, 'amount', 0),
    NOW(), ends
  );

  UPDATE public.campaigns SET enrollment_count = enrollment_count + 1, updated_at = NOW() WHERE id = camp.id;

  IF plan_rec.id IS NOT NULL THEN
    UPDATE public.subscriptions SET status = 'expired' WHERE shop_id = shop.id AND status IN ('active', 'trial');
    INSERT INTO public.subscriptions (
      shop_id, shop_name, plan, plan_id, package_key, duration_key, duration_months, amount, status, payment_status, start_date, renewal_date
    ) VALUES (
      shop.id, shop.name, COALESCE(plan_rec.name, 'Founding listing'), plan_rec.id, pkg,
      CASE WHEN months = 3 THEN '3_months' ELSE '1_month' END,
      months, 0, 'trial', 'paid', CURRENT_DATE, (ends)::date
    );
    INSERT INTO public.subscription_history (shop_id, plan_id, package_key, amount, status, changed_by)
    VALUES (shop.id, plan_rec.id, pkg, 0, 'founding_trial', shop.owner_user_id);
    PERFORM public.sync_shop_verification(shop.id);
  END IF;

  IF shop.owner_user_id IS NOT NULL THEN
    INSERT INTO public.customer_badges (user_id, badge_id, source, metadata)
    SELECT shop.owner_user_id, d.id, 'campaign', jsonb_build_object('campaign_id', camp.id)
    FROM public.customer_badge_definitions d
    WHERE d.slug = 'founding_user'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    INSERT INTO public.notifications (user_id, title, message, type, href)
    VALUES (
      shop.owner_user_id,
      'Founding User',
      'Your shop is listed free for ' || months::text || ' months under the Founding Users offer.',
      'loyalty',
      '/shop/subscription'
    );
  END IF;

  INSERT INTO public.shop_badges (shop_id, badge_id, source)
  SELECT shop.id, d.id, 'campaign'
  FROM public.customer_badge_definitions d
  WHERE d.slug = 'founding_shop'
  ON CONFLICT (shop_id, badge_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'campaign_id', camp.id, 'ends_at', ends);
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_register_shop_founding(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM set_config('lagecto.force_founding_enroll', 'true', true);
  RETURN public.try_enroll_founding_shop(p_shop_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_register_shop_founding(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_register_shop_founding(UUID) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.try_enroll_founding_shop(UUID) TO postgres, service_role;

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
