-- Shop packages: Thabi / Kristen / Sandra durations, FREE fallback, subscription verification, blog URL media.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_key TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS duration_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT;

ALTER TABLE public.storefront_blog_posts
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_duration_key_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_duration_key_check
      CHECK (duration_key IS NULL OR duration_key IN ('1_month', '3_months', '6_months', '9_months', '1_year'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_duration_key_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_duration_key_check
      CHECK (duration_key IS NULL OR duration_key IN ('1_month', '3_months', '6_months', '9_months', '1_year'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_payment_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_payment_status_check
      CHECK (payment_status IS NULL OR payment_status IN ('unpaid', 'pending', 'paid', 'failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'storefront_blog_posts_media_type_check'
  ) THEN
    ALTER TABLE public.storefront_blog_posts
      ADD CONSTRAINT storefront_blog_posts_media_type_check
      CHECK (media_type IN ('none', 'image', 'video'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.package_features(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_key = 'sandra' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","receipts","analytics","advanced_pos","advanced_inventory","priority_support","early_access"]'::jsonb;
  END IF;
  IF p_key = 'kristen' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","receipts"]'::jsonb;
  END IF;
  IF p_key = 'thabi' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop"]'::jsonb;
  END IF;
  RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic"]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.duration_months_for(p_key TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN '3_months' THEN 3
    WHEN '6_months' THEN 6
    WHEN '9_months' THEN 9
    WHEN '1_year' THEN 12
    ELSE 1
  END;
$$;

INSERT INTO public.subscription_plans (name, slug, package_key, duration_key, duration_months, price, billing_period, features, is_active)
VALUES
  ('Thabi', 'thabi-1-month', 'thabi', '1_month', 1, 2, 'monthly', public.package_features('thabi'), TRUE),
  ('Thabi', 'thabi-3-months', 'thabi', '3_months', 3, 5, 'monthly', public.package_features('thabi'), TRUE),
  ('Thabi', 'thabi-6-months', 'thabi', '6_months', 6, 9, 'monthly', public.package_features('thabi'), TRUE),
  ('Thabi', 'thabi-9-months', 'thabi', '9_months', 9, 13, 'monthly', public.package_features('thabi'), TRUE),
  ('Thabi', 'thabi-1-year', 'thabi', '1_year', 12, 16, 'yearly', public.package_features('thabi'), TRUE),
  ('Kristen', 'kristen-1-month', 'kristen', '1_month', 1, 3.50, 'monthly', public.package_features('kristen'), TRUE),
  ('Kristen', 'kristen-3-months', 'kristen', '3_months', 3, 9, 'monthly', public.package_features('kristen'), TRUE),
  ('Kristen', 'kristen-6-months', 'kristen', '6_months', 6, 16, 'monthly', public.package_features('kristen'), TRUE),
  ('Kristen', 'kristen-9-months', 'kristen', '9_months', 9, 22, 'monthly', public.package_features('kristen'), TRUE),
  ('Kristen', 'kristen-1-year', 'kristen', '1_year', 12, 28, 'yearly', public.package_features('kristen'), TRUE),
  ('Sandra', 'sandra-1-month', 'sandra', '1_month', 1, 5, 'monthly', public.package_features('sandra'), TRUE),
  ('Sandra', 'sandra-3-months', 'sandra', '3_months', 3, 13, 'monthly', public.package_features('sandra'), TRUE),
  ('Sandra', 'sandra-6-months', 'sandra', '6_months', 6, 23, 'monthly', public.package_features('sandra'), TRUE),
  ('Sandra', 'sandra-9-months', 'sandra', '9_months', 9, 32, 'monthly', public.package_features('sandra'), TRUE),
  ('Sandra', 'sandra-1-year', 'sandra', '1_year', 12, 40, 'yearly', public.package_features('sandra'), TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  package_key = EXCLUDED.package_key,
  duration_key = EXCLUDED.duration_key,
  duration_months = EXCLUDED.duration_months,
  price = EXCLUDED.price,
  billing_period = EXCLUDED.billing_period,
  features = EXCLUDED.features,
  is_active = TRUE;

UPDATE public.subscription_plans
SET is_active = FALSE
WHERE slug IN ('thabi', 'kristen', 'basic')
  AND slug NOT LIKE '%-%';

UPDATE public.subscription_plans p
SET
  features = public.package_features(p.package_key),
  duration_key = COALESCE(p.duration_key, CASE p.duration_months
    WHEN 3 THEN '3_months'
    WHEN 6 THEN '6_months'
    WHEN 9 THEN '9_months'
    WHEN 12 THEN '1_year'
    ELSE '1_month'
  END)
WHERE p.package_key IN ('thabi', 'kristen', 'sandra');

CREATE OR REPLACE FUNCTION public.sync_shop_verification(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
      AND s.renewal_date >= CURRENT_DATE
  ) INTO paid;
  PERFORM set_config('lagecto.allow_verification_sync', 'true', true);
  UPDATE public.shops
  SET verification_status = CASE WHEN paid THEN 'verified' ELSE
    CASE WHEN verification_status = 'verified' THEN 'unverified' ELSE verification_status END
  END
  WHERE id = p_shop_id;
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
BEGIN
  FOR rec IN
    SELECT id, shop_id
    FROM public.subscriptions
    WHERE status IN ('active', 'trial')
      AND renewal_date < CURRENT_DATE
      AND (p_shop_id IS NULL OR shop_id = p_shop_id)
  LOOP
    UPDATE public.subscriptions SET status = 'expired' WHERE id = rec.id;
    PERFORM public.sync_shop_verification(rec.shop_id);
    n := n + 1;
  END LOOP;
  IF p_shop_id IS NOT NULL THEN
    PERFORM public.sync_shop_verification(p_shop_id);
  END IF;
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
      AND s.renewal_date >= CURRENT_DATE
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
    AND s.renewal_date >= CURRENT_DATE
    AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
  ORDER BY s.created_at DESC
  LIMIT 1;
  RETURN public.package_features(COALESCE(pkg, 'free')) ? p_feature;
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
  PERFORM public.sync_shop_verification(p_shop_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_shop_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('lagecto.allow_verification_sync', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.verification_status := OLD.verification_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shop_verification ON public.shops;
CREATE TRIGGER trg_protect_shop_verification
BEFORE UPDATE OF verification_status ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.protect_shop_verification();

CREATE OR REPLACE FUNCTION public.enforce_blog_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.shop_has_feature(NEW.shop_id, 'blogs') THEN
    RAISE EXCEPTION 'Blogs and vlogs require Kristen or Sandra';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_blog_entitlement ON public.storefront_blog_posts;
CREATE TRIGGER trg_enforce_blog_entitlement
BEFORE INSERT OR UPDATE ON public.storefront_blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_blog_entitlement();

CREATE OR REPLACE FUNCTION public.enforce_pos_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.shop_has_feature(NEW.shop_id, 'pos') THEN
    RAISE EXCEPTION 'POS is not available for this shop';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pos_entitlement ON public.sales;
CREATE TRIGGER trg_enforce_pos_entitlement
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pos_entitlement();

GRANT EXECUTE ON FUNCTION public.package_features(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_has_feature(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_is_verified(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_shop_verification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_subscription(UUID, UUID) TO authenticated;

SELECT public.sync_shop_verification(id) FROM public.shops;
