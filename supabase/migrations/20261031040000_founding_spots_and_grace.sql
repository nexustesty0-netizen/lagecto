-- Founding portal: 10 spots, counted from real signups.
-- Complimentary period is 1 month + 3 weeks, then a 5-day pay window.
-- After the window, unpaid shops are deactivated and delisted.

CREATE OR REPLACE FUNCTION public.founding_spot_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 10;
$$;

CREATE OR REPLACE FUNCTION public.subscription_grace_days()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 5;
$$;

CREATE OR REPLACE FUNCTION public.founding_duration()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT INTERVAL '1 month 21 days';
$$;

CREATE OR REPLACE FUNCTION public.founding_spots_used()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT e.shop_id)::INTEGER
  FROM public.campaign_enrollments e
  JOIN public.campaigns c ON c.id = e.campaign_id
  WHERE c.kind = 'founding_users' AND e.shop_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.shop_subscription_covers(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND s.renewal_date + public.subscription_grace_days() >= CURRENT_DATE
  );
$$;

UPDATE public.campaigns
SET
  max_enrollments = public.founding_spot_limit(),
  enrollment_count = public.founding_spots_used(),
  description = 'Complimentary listing for 1 month and 3 weeks. Then 5 days to pay or the shop is delisted.',
  benefit = jsonb_build_object(
    'package_key', 'thabi',
    'duration', '1 month 21 days',
    'grace_days', 5,
    'amount', 0,
    'listing', 'founding'
  ),
  updated_at = NOW()
WHERE kind = 'founding_users';

UPDATE public.campaign_enrollments e
SET ends_at = e.starts_at + public.founding_duration()
FROM public.campaigns c
WHERE c.id = e.campaign_id
  AND c.kind = 'founding_users'
  AND e.status = 'active';

UPDATE public.subscriptions s
SET
  duration_key = '1_month',
  duration_months = 1,
  renewal_date = (s.start_date + public.founding_duration())::date
WHERE s.status = 'trial'
  AND COALESCE(s.amount, 0) = 0
  AND s.start_date IS NOT NULL
  AND (
    s.plan ILIKE '%founding%'
    OR EXISTS (
      SELECT 1 FROM public.campaign_enrollments e
      JOIN public.campaigns c ON c.id = e.campaign_id
      WHERE e.shop_id = s.shop_id AND c.kind = 'founding_users'
    )
  );

CREATE OR REPLACE FUNCTION public.active_founding_campaign()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'ok', true,
        'id', c.id,
        'name', c.name,
        'description', 'Complimentary listing for 1 month and 3 weeks. Then 5 days to pay or the shop is delisted.',
        'starts_at', c.starts_at,
        'ends_at', c.ends_at,
        'benefit', c.benefit,
        'limit', public.founding_spot_limit(),
        'used', public.founding_spots_used(),
        'remaining', GREATEST(public.founding_spot_limit() - public.founding_spots_used(), 0)
      )
      FROM public.campaigns c
      WHERE c.kind = 'founding_users' AND c.is_active
        AND (c.starts_at IS NULL OR c.starts_at <= NOW())
        AND (c.ends_at IS NULL OR c.ends_at >= NOW())
        AND public.founding_spots_used() < public.founding_spot_limit()
      ORDER BY c.created_at
      LIMIT 1
    ),
    jsonb_build_object(
      'ok', public.founding_spots_used() < public.founding_spot_limit(),
      'name', 'Founding Users',
      'limit', public.founding_spot_limit(),
      'used', public.founding_spots_used(),
      'remaining', GREATEST(public.founding_spot_limit() - public.founding_spots_used(), 0)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.delist_unpaid_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
BEGIN
  IF public.shop_subscription_covers(p_shop_id) THEN
    RETURN FALSE;
  END IF;
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE shop_id = p_shop_id AND status IN ('active', 'trial');
  UPDATE public.shops
  SET status = 'inactive', updated_at = NOW()
  WHERE id = p_shop_id AND status IS DISTINCT FROM 'inactive'
  RETURNING * INTO shop_rec;
  IF shop_rec.id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF shop_rec.owner_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        shop_rec.owner_user_id,
        'Shop deactivated',
        'Your listing period ended and payment was not received in the 5-day extension. The shop is deactivated and removed from Shops.',
        'general'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions(p_shop_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
  rec RECORD;
  grace INTEGER := public.subscription_grace_days();
BEGIN
  FOR rec IN
    SELECT id, shop_id
    FROM public.subscriptions
    WHERE status IN ('active', 'trial')
      AND renewal_date + grace < CURRENT_DATE
      AND (p_shop_id IS NULL OR shop_id = p_shop_id)
  LOOP
    UPDATE public.subscriptions SET status = 'expired' WHERE id = rec.id;
    IF public.delist_unpaid_shop(rec.shop_id) THEN
      n := n + 1;
    ELSE
      n := n + 1;
    END IF;
    PERFORM public.sync_shop_verification(rec.shop_id);
  END LOOP;
  IF p_shop_id IS NOT NULL THEN
    IF NOT public.shop_subscription_covers(p_shop_id) THEN
      PERFORM public.delist_unpaid_shop(p_shop_id);
    END IF;
    PERFORM public.sync_shop_verification(p_shop_id);
  END IF;
  RETURN n;
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
  rec RECORD;
  grace INTEGER := public.subscription_grace_days();
BEGIN
  FOR rec IN
    SELECT e.id, e.shop_id
    FROM public.campaign_enrollments e
    JOIN public.campaigns c ON c.id = e.campaign_id
    WHERE e.status = 'active'
      AND c.kind = 'founding_users'
      AND e.ends_at IS NOT NULL
      AND (e.ends_at + make_interval(days => grace)) < NOW()
  LOOP
    UPDATE public.campaign_enrollments SET status = 'expired' WHERE id = rec.id;
    IF rec.shop_id IS NOT NULL THEN
      PERFORM public.expire_due_subscriptions(rec.shop_id);
    END IF;
    n := n + 1;
  END LOOP;

  UPDATE public.campaigns
  SET is_active = FALSE, updated_at = NOW()
  WHERE kind = 'founding_users'
    AND is_active
    AND public.founding_spots_used() >= public.founding_spot_limit();

  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_is_verified(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
      AND s.renewal_date + public.subscription_grace_days() >= CURRENT_DATE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_has_feature(p_shop_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg TEXT;
BEGIN
  SELECT s.package_key INTO pkg
  FROM public.subscriptions s
  WHERE s.shop_id = p_shop_id
    AND s.status IN ('active', 'trial')
    AND s.renewal_date + public.subscription_grace_days() >= CURRENT_DATE
    AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
  ORDER BY s.created_at DESC
  LIMIT 1;
  RETURN public.package_features(COALESCE(pkg, 'free')) ? p_feature;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_shop_verification(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
      AND COALESCE(s.amount, 0) > 0
      AND s.renewal_date + public.subscription_grace_days() >= CURRENT_DATE
  ) INTO paid;
  PERFORM set_config('lagecto.allow_verification_sync', 'true', true);
  UPDATE public.shops
  SET verification_status = CASE WHEN paid THEN 'verified' ELSE
    CASE WHEN verification_status = 'verified' THEN 'unverified' ELSE verification_status END
  END
  WHERE id = p_shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_subscription(
  p_shop_id UUID,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_rec public.subscription_plans%ROWTYPE;
  shop_rec public.shops%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO plan_rec FROM public.subscription_plans WHERE id = p_plan_id;
  SELECT * INTO shop_rec FROM public.shops WHERE id = p_shop_id;
  IF plan_rec.id IS NULL OR shop_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop or plan not found');
  END IF;
  UPDATE public.subscriptions SET status = 'expired' WHERE shop_id = p_shop_id AND status IN ('active', 'trial');
  INSERT INTO public.subscriptions (
    shop_id, shop_name, plan, plan_id, package_key, duration_key, duration_months, amount, status, payment_status, start_date, renewal_date
  ) VALUES (
    p_shop_id,
    shop_rec.name,
    plan_rec.name,
    plan_rec.id,
    plan_rec.package_key,
    COALESCE(plan_rec.duration_key, '1_month'),
    COALESCE(plan_rec.duration_months, public.duration_months_for(plan_rec.duration_key)),
    plan_rec.price,
    'active',
    'paid',
    CURRENT_DATE,
    CURRENT_DATE + make_interval(months => COALESCE(plan_rec.duration_months, 1))
  );
  INSERT INTO public.subscription_history (shop_id, plan_id, package_key, amount, status, changed_by)
  VALUES (p_shop_id, plan_rec.id, plan_rec.package_key, plan_rec.price, 'active', auth.uid());
  UPDATE public.shops SET status = 'active', updated_at = NOW() WHERE id = p_shop_id;
  PERFORM public.sync_shop_verification(p_shop_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.try_enroll_founding_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  camp public.campaigns%ROWTYPE;
  shop public.shops%ROWTYPE;
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

  IF EXISTS (SELECT 1 FROM public.campaign_enrollments e JOIN public.campaigns c ON c.id = e.campaign_id WHERE c.kind = 'founding_users' AND e.shop_id = p_shop_id) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  IF public.founding_spots_used() >= public.founding_spot_limit() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Founding spots are full');
  END IF;

  SELECT * INTO camp
  FROM public.campaigns
  WHERE kind = 'founding_users' AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  ORDER BY created_at
  LIMIT 1;

  IF camp.id IS NULL THEN
    SELECT * INTO camp FROM public.campaigns WHERE kind = 'founding_users' ORDER BY is_active DESC, created_at LIMIT 1;
  END IF;

  IF camp.id IS NULL THEN
    INSERT INTO public.campaigns (
      slug, name, description, kind, is_active, starts_at, ends_at, max_enrollments, eligibility, benefit
    ) VALUES (
      'founding-users',
      'Founding Users',
      'Complimentary listing for 1 month and 3 weeks. Then 5 days to pay or the shop is delisted.',
      'founding_users',
      TRUE,
      NOW(),
      NULL,
      public.founding_spot_limit(),
      jsonb_build_object('shop_must_be_new', true),
      jsonb_build_object('package_key', 'thabi', 'duration', '1 month 21 days', 'grace_days', 5, 'amount', 0)
    )
    ON CONFLICT (slug) DO UPDATE
      SET max_enrollments = public.founding_spot_limit(),
          is_active = TRUE
    RETURNING * INTO camp;
  END IF;

  pkg := COALESCE(NULLIF(camp.benefit->>'package_key', ''), 'thabi');
  ends := NOW() + public.founding_duration();

  SELECT * INTO plan_rec
  FROM public.subscription_plans
  WHERE package_key = pkg AND is_active
  ORDER BY price
  LIMIT 1;

  INSERT INTO public.campaign_enrollments (campaign_id, user_id, shop_id, status, benefit_applied, starts_at, ends_at)
  VALUES (
    camp.id, shop.owner_user_id, shop.id, 'active',
    jsonb_build_object('package_key', pkg, 'duration', '1 month 21 days', 'grace_days', 5, 'amount', 0),
    NOW(), ends
  );

  UPDATE public.campaigns
  SET enrollment_count = public.founding_spots_used(), updated_at = NOW()
  WHERE id = camp.id;

  IF plan_rec.id IS NOT NULL THEN
    UPDATE public.subscriptions SET status = 'expired' WHERE shop_id = shop.id AND status IN ('active', 'trial');
    INSERT INTO public.subscriptions (
      shop_id, shop_name, plan, plan_id, package_key, duration_key, duration_months, amount, status, payment_status, start_date, renewal_date
    ) VALUES (
      shop.id, shop.name, COALESCE(plan_rec.name, 'Founding listing'), plan_rec.id, pkg,
      '1_month', 1, 0, 'trial', 'paid', CURRENT_DATE, (ends)::date
    );
    INSERT INTO public.subscription_history (shop_id, plan_id, package_key, amount, status, changed_by)
    VALUES (shop.id, plan_rec.id, pkg, 0, 'founding_trial', shop.owner_user_id);
    PERFORM public.sync_shop_verification(shop.id);
  END IF;

  IF shop.owner_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        shop.owner_user_id,
        'Founding User',
        'Your shop is listed free for 1 month and 3 weeks. After that you have 5 days to pay or it is delisted.',
        'general'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  INSERT INTO public.shop_badges (shop_id, badge_id, source)
  SELECT shop.id, d.id, 'campaign'
  FROM public.customer_badge_definitions d
  WHERE d.slug = 'founding_shop'
  ON CONFLICT (shop_id, badge_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'campaign_id', camp.id, 'ends_at', ends);
END;
$$;

GRANT EXECUTE ON FUNCTION public.founding_spot_limit() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.founding_spots_used() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.founding_duration() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_grace_days() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_founding_campaign() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_founding_campaigns() TO service_role;
GRANT EXECUTE ON FUNCTION public.try_enroll_founding_shop(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_assign_subscription(UUID, UUID) TO authenticated, service_role;
