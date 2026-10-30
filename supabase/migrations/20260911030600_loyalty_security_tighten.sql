-- Restrict internal loyalty RPCs. SECURITY DEFINER functions remain callable
-- from triggers and other owner functions after REVOKE FROM PUBLIC.

REVOKE ALL ON FUNCTION public.award_loyalty_points(UUID, UUID, INTEGER, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_order_loyalty(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_order_loyalty(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.try_enroll_founding_shop(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_founding_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_loyalty_wallet(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_loyalty_level(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.expire_founding_campaigns() TO service_role;

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
BEGIN
  IF NOT (
    public.is_platform_admin()
    OR public.user_owns_shop(p_shop_id)
    OR current_setting('lagecto.allow_loyalty_eval', true) = 'true'
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
  IF camp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active founding campaign');
  END IF;
  IF camp.max_enrollments IS NOT NULL AND camp.enrollment_count >= camp.max_enrollments THEN
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

CREATE OR REPLACE FUNCTION public.shops_after_insert_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM public.ensure_shop_loyalty_program(NEW.id);
  PERFORM public.try_enroll_founding_shop(NEW.id);
  PERFORM public.evaluate_shop_achievements(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_founding_campaigns()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
BEGIN
  IF NOT (
    public.is_platform_admin()
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR current_user IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.campaign_enrollments
  SET status = 'expired'
  WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at < NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.campaigns
  SET is_active = FALSE, updated_at = NOW()
  WHERE is_active AND ends_at IS NOT NULL AND ends_at < NOW();
  RETURN n;
END;
$$;
