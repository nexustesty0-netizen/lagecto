-- LaGecto Web parity: remaining tables, entitlements, admin RPCs, RLS.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_role TEXT
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'staff', 'clerk'));

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS package_key TEXT,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS package_key TEXT,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  package_key TEXT,
  amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL DEFAULT 'staff' CHECK (role_name IN ('manager', 'staff')),
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'accepted', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.shop_storefront_config (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  hero_title TEXT,
  hero_subtitle TEXT,
  theme JSONB DEFAULT '{}'::jsonb,
  gallery JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.loyalty_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, shop_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.loyalty_wallets(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  threshold INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.customer_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.customer_badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.business_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'shop_customer' CHECK (kind IN ('shop_customer', 'shop_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lagecto_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  category TEXT DEFAULT 'platform',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diary_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.diary_habits(id) ON DELETE CASCADE,
  logged_on DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (habit_id, logged_on)
);
CREATE TABLE IF NOT EXISTS public.diary_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS public.diary_mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_vision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.diary_budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.stebo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'personal',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.stebo_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL DEFAULT 'base',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_personality_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  display_name TEXT DEFAULT 'Stebo',
  traits JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS public.stebo_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.stebo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.stebo_personality_settings (id, display_name)
VALUES (1, 'Stebo') ON CONFLICT DO NOTHING;

INSERT INTO public.customer_badge_definitions (slug, name, description, threshold) VALUES
('first_order', 'First Order', 'Placed your first LaGecto order', 1),
('regular', 'Regular', 'Completed 5 orders', 5),
('explorer', 'Explorer', 'Visited many shops', 10)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.subscription_plans SET package_key = 'thabi', duration_months = 1
WHERE slug = 'basic' OR name ILIKE 'basic';
UPDATE public.subscription_plans SET package_key = 'thabi', duration_months = 1, price = 3, name = 'Thabi', slug = 'thabi',
  features = '["one_shop","product_listings","digital_storefront","order_management","customer_reviews","reports_standard","notifications","business_profile_basic","smart_diary_limited"]'::jsonb
WHERE slug IN ('basic', 'thabi') OR name ILIKE 'thabi' OR name ILIKE 'basic';

INSERT INTO public.subscription_plans (name, slug, package_key, price, billing_period, duration_months, features, is_active)
SELECT 'Thabi', 'thabi', 'thabi', 3, 'monthly', 1,
  '["one_shop","product_listings","digital_storefront","order_management","customer_reviews","reports_standard","notifications","business_profile_basic","smart_diary_limited"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE slug = 'thabi');

INSERT INTO public.subscription_plans (name, slug, package_key, price, billing_period, duration_months, features, is_active)
SELECT 'Kristen', 'kristen', 'kristen', 5, 'monthly', 1,
  '["one_shop","product_listings","digital_storefront","order_management","customer_reviews","reports_standard","notifications","business_profile_basic","smart_diary_limited","pos","inventory","employees","customer_chat","smart_diary_full","profit_loss","expenses","analytics","receipts","custom_branding","priority_support","early_access"]'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE slug = 'kristen');

DELETE FROM public.subscription_plans WHERE slug IN ('growth', 'premium', 'basic');

CREATE OR REPLACE FUNCTION public.shop_has_feature(p_shop_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feats JSONB;
BEGIN
  SELECT sp.features INTO feats
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id OR lower(sp.name) = lower(s.plan) OR sp.package_key = s.package_key
  WHERE s.shop_id = p_shop_id AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF feats IS NULL THEN
    SELECT features INTO feats FROM public.subscription_plans WHERE package_key = 'thabi' AND is_active LIMIT 1;
  END IF;
  IF feats IS NULL THEN
    RETURN TRUE;
  END IF;
  RETURN feats ? p_feature;
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
  PERFORM public.log_security_event(
    'role_assigned', auth.uid(), p_user_id, NULL, NULL, NULL, NULL, 'success',
    jsonb_build_object('role', p_role, 'admin_role', p_admin_role)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_promote_shop_owner(
  p_user_id UUID,
  p_shop_id UUID DEFAULT NULL
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
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users SET role = 'shop_owner', admin_role = NULL, updated_at = NOW() WHERE id = p_user_id;
  IF p_shop_id IS NOT NULL THEN
    UPDATE public.shops
    SET owner_user_id = p_user_id, owner_email = rec.email, owner_name = rec.name
    WHERE id = p_shop_id
    RETURNING * INTO shop_rec;
  END IF;
  PERFORM public.log_security_event(
    'promoted_shop_owner', auth.uid(), p_user_id, p_shop_id, rec.email, NULL, NULL, 'success', '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true, 'shop_id', shop_rec.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_shop_staff(
  p_shop_id UUID,
  p_user_id UUID,
  p_role_name TEXT DEFAULT 'staff'
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
  IF p_role_name NOT IN ('manager', 'staff') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid staff role');
  END IF;
  INSERT INTO public.shop_staff_assignments (shop_id, user_id, role_name)
  VALUES (p_shop_id, p_user_id, p_role_name)
  ON CONFLICT (shop_id, user_id) DO UPDATE SET role_name = EXCLUDED.role_name;
  PERFORM public.log_security_event(
    'staff_assigned', auth.uid(), p_user_id, p_shop_id, NULL, NULL, NULL, 'success',
    jsonb_build_object('role_name', p_role_name)
  );
  RETURN jsonb_build_object('ok', true);
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
  INSERT INTO public.subscriptions (shop_id, shop_name, plan, plan_id, package_key, amount, status, start_date, renewal_date)
  VALUES (
    p_shop_id, shop_rec.name, plan_rec.name, plan_rec.id, plan_rec.package_key, plan_rec.price, 'active',
    CURRENT_DATE, CURRENT_DATE + make_interval(months => COALESCE(plan_rec.duration_months, 1))
  );
  INSERT INTO public.subscription_history (shop_id, plan_id, package_key, amount, status, changed_by)
  VALUES (p_shop_id, plan_rec.id, plan_rec.package_key, plan_rec.price, 'active', auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_user_security_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('lagecto.allow_security_update', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
  NEW.admin_role := OLD.admin_role;
  NEW.account_status := OLD.account_status;
  NEW.failed_login_attempts := OLD.failed_login_attempts;
  NEW.locked_at := OLD.locked_at;
  NEW.locked_reason := OLD.locked_reason;
  NEW.unlocked_at := OLD.unlocked_at;
  NEW.unlocked_by := OLD.unlocked_by;
  NEW.last_login_at := OLD.last_login_at;
  NEW.last_failed_login_at := OLD.last_failed_login_at;
  IF NEW.username_normalized IS DISTINCT FROM OLD.username_normalized
     OR NEW.last_username_change_at IS DISTINCT FROM OLD.last_username_change_at THEN
    NEW.username := OLD.username;
    NEW.username_normalized := OLD.username_normalized;
    NEW.last_username_change_at := OLD.last_username_change_at;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_has_feature(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_promote_shop_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_shop_staff(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_subscription(UUID, UUID) TO authenticated;

ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_storefront_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lagecto_news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_vision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_personality_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stebo_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_hist_admin ON public.subscription_history FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin());
CREATE POLICY staff_admin ON public.shop_staff_assignments FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id) OR user_id = auth.uid())
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY svc_req_read ON public.service_requests FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY svc_req_insert ON public.service_requests FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY svc_req_update ON public.service_requests FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY purchase_items_owner ON public.purchase_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND (public.is_platform_admin() OR public.user_owns_shop(p.shop_id))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_id AND (public.is_platform_admin() OR public.user_owns_shop(p.shop_id))));
CREATE POLICY storefront_read ON public.shop_storefront_config FOR SELECT USING (TRUE);
CREATE POLICY storefront_write ON public.shop_storefront_config FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY shop_faq_read ON public.shop_faq_entries FOR SELECT USING (TRUE);
CREATE POLICY shop_faq_write ON public.shop_faq_entries FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY loyalty_own ON public.loyalty_wallets FOR ALL
  USING (user_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (user_id = auth.uid() OR public.user_owns_shop(shop_id));
CREATE POLICY loyalty_tx ON public.loyalty_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.loyalty_wallets w WHERE w.id = wallet_id AND (w.user_id = auth.uid() OR public.is_platform_admin())));
CREATE POLICY badges_def_read ON public.customer_badge_definitions FOR SELECT USING (TRUE);
CREATE POLICY badges_own ON public.customer_badges FOR SELECT USING (user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY badges_earn ON public.customer_badges FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY posts_read ON public.business_posts FOR SELECT USING (TRUE);
CREATE POLICY posts_write ON public.business_posts FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY chat_conv_read ON public.chat_conversations FOR SELECT
  USING (customer_id = auth.uid() OR admin_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY chat_conv_insert ON public.chat_conversations FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY chat_msg_read ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id
      AND (c.customer_id = auth.uid() OR c.admin_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(c.shop_id))
  ));
CREATE POLICY chat_msg_insert ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY news_public ON public.lagecto_news_articles FOR SELECT
  USING (status = 'published' OR public.is_platform_admin());
CREATE POLICY news_admin ON public.lagecto_news_articles FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY diary_habits_own ON public.diary_habits FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_habit_logs_own ON public.diary_habit_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.diary_habits h WHERE h.id = habit_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.diary_habits h WHERE h.id = habit_id AND h.user_id = auth.uid()));
CREATE POLICY diary_events_own ON public.diary_events FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_mood_own ON public.diary_mood_logs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_vision_own ON public.diary_vision_items FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_mem_own ON public.diary_memories FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_brief_own ON public.diary_briefings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_refl_own ON public.diary_reflections FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_week_own ON public.diary_weekly_reviews FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_budget_own ON public.diary_budget_entries FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY stebo_conv_own ON public.stebo_conversations FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY stebo_msg_own ON public.stebo_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stebo_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stebo_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY stebo_know_read ON public.stebo_knowledge FOR SELECT USING (is_active = TRUE OR public.is_platform_admin());
CREATE POLICY stebo_know_admin ON public.stebo_knowledge FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY stebo_train_admin ON public.stebo_training_examples FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY stebo_train_read ON public.stebo_training_examples FOR SELECT USING (TRUE);
CREATE POLICY stebo_pers_read ON public.stebo_personality_settings FOR SELECT USING (TRUE);
CREATE POLICY stebo_pers_admin ON public.stebo_personality_settings FOR UPDATE USING (public.is_platform_admin());
CREATE POLICY stebo_ind_read ON public.stebo_industries FOR SELECT USING (TRUE);
CREATE POLICY stebo_ind_admin ON public.stebo_industries FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY stebo_goals_own ON public.stebo_goals FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY stebo_brief_own ON public.stebo_briefings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY stebo_rep_own ON public.stebo_reports FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.stebo_knowledge (section, title, body)
SELECT * FROM (VALUES
  ('base', 'What is LaGecto', 'LaGecto is a digital marketplace connecting customers with local businesses. Shop owners manage products, orders, POS and finances. Customers browse shops, order, and keep receipts.'),
  ('base', 'Support', 'LaGecto Support: phone +263 71 503 4314, email lagecto@outlook.com.'),
  ('rules', 'Shop ID login', 'Shop owners sign in with Shop ID (example gectotech@lg23) and password, not email.'),
  ('lagecto', 'Packages', 'Thabi is the essential storefront package. Kristen adds POS, inventory, employees, payroll, chat and advanced diary.')
) AS seed(section, title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.stebo_knowledge k WHERE k.title = seed.title);
