-- Messaging permission matrix, platform analytics (no shop GMV as LaGecto revenue),
-- weekend Stebo reports, news publishing fields, package catalog columns.

-- ============================================================
-- PACKAGES: extra catalog fields (historical subscriptions keep their amount)
-- ============================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_label TEXT,
  ADD COLUMN IF NOT EXISTS is_trial_available BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- NEWS
-- ============================================================
ALTER TABLE public.lagecto_news_articles
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.publish_due_news()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
BEGIN
  UPDATE public.lagecto_news_articles
  SET status = 'published',
      published_at = COALESCE(published_at, NOW())
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ============================================================
-- MESSAGING
-- ============================================================
ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_kind_check;
ALTER TABLE public.chat_conversations
  ADD CONSTRAINT chat_conversations_kind_check
  CHECK (kind IN ('shop_customer', 'shop_admin', 'admin_customer'));

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS can_reply BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.chat_can_read(p_conversation_id UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.chat_conversations%ROWTYPE;
BEGIN
  IF p_user IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF conv.id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF conv.kind = 'shop_customer' THEN
    RETURN conv.customer_id = p_user OR public.user_owns_shop(conv.shop_id);
  END IF;
  IF conv.kind = 'shop_admin' THEN
    RETURN public.is_platform_admin() OR public.user_owns_shop(conv.shop_id);
  END IF;
  IF conv.kind = 'admin_customer' THEN
    RETURN conv.customer_id = p_user OR public.is_platform_admin();
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_can_send(p_conversation_id UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.chat_conversations%ROWTYPE;
  sender_role TEXT;
BEGIN
  IF p_user IS NULL OR NOT public.chat_can_read(p_conversation_id, p_user) THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  SELECT role INTO sender_role FROM public.users WHERE id = p_user;
  IF conv.kind = 'admin_customer' THEN
    RETURN sender_role = 'admin';
  END IF;
  IF conv.kind = 'shop_admin' THEN
    RETURN sender_role = 'admin' OR public.user_owns_shop(conv.shop_id);
  END IF;
  IF conv.kind = 'shop_customer' THEN
    RETURN conv.customer_id = p_user OR public.user_owns_shop(conv.shop_id);
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_chat_conversation(
  p_kind TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  role TEXT;
  conv public.chat_conversations%ROWTYPE;
  kind TEXT := lower(trim(p_kind));
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT u.role INTO role FROM public.users u WHERE u.id = uid;

  IF kind = 'shop_customer' THEN
    IF p_shop_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
    END IF;
    IF role = 'customer' THEN
      p_customer_id := uid;
    ELSIF public.user_owns_shop(p_shop_id) THEN
      IF p_customer_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Choose a customer');
      END IF;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_customer' AND shop_id = p_shop_id AND customer_id = p_customer_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, customer_id, kind, can_reply, title)
      VALUES (p_shop_id, p_customer_id, 'shop_customer', TRUE, 'Shop chat')
      RETURNING * INTO conv;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);

  ELSIF kind = 'shop_admin' THEN
    IF role = 'admin' THEN
      IF p_shop_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
      END IF;
    ELSIF role = 'shop_owner' THEN
      SELECT id INTO p_shop_id FROM public.shops
      WHERE owner_user_id = uid OR lower(owner_email) = lower(public.current_user_email())
      LIMIT 1;
      IF p_shop_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No shop assigned');
      END IF;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_admin' AND shop_id = p_shop_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, admin_id, kind, can_reply, title)
      VALUES (p_shop_id, CASE WHEN role = 'admin' THEN uid ELSE NULL END, 'shop_admin', TRUE, 'Admin support')
      RETURNING * INTO conv;
    ELSIF role = 'admin' AND conv.admin_id IS NULL THEN
      UPDATE public.chat_conversations SET admin_id = uid WHERE id = conv.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);

  ELSIF kind = 'admin_customer' THEN
    IF role <> 'admin' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    IF p_customer_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Choose a customer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_customer_id AND role = 'customer') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Customer not found');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'admin_customer' AND customer_id = p_customer_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (customer_id, admin_id, kind, can_reply, title)
      VALUES (p_customer_id, uid, 'admin_customer', FALSE, 'LaGecto announcement')
      RETURNING * INTO conv;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Unsupported conversation type');
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  msg_id UUID;
  body TEXT := left(trim(COALESCE(p_body, '')), 4000);
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Write a message');
  END IF;
  IF NOT public.chat_can_send(p_conversation_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot reply in this conversation');
  END IF;
  INSERT INTO public.chat_messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, uid, body)
  RETURNING id INTO msg_id;
  UPDATE public.chat_conversations SET last_message_at = NOW() WHERE id = p_conversation_id;
  RETURN jsonb_build_object('ok', true, 'message_id', msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_message(
  p_audience TEXT,
  p_title TEXT,
  p_body TEXT,
  p_target_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  body TEXT := left(trim(COALESCE(p_body, '')), 4000);
  title TEXT := left(trim(COALESCE(p_title, 'LaGecto update')), 120);
  audience TEXT := lower(trim(p_audience));
  rec RECORD;
  conv_id UUID;
  sent INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Write a message');
  END IF;

  INSERT INTO public.updates (title, message, audience, created_by)
  VALUES (title, body, audience, uid);

  IF audience IN ('customer', 'customers', 'specific_customer') THEN
    FOR rec IN
      SELECT id FROM public.users
      WHERE role = 'customer' AND account_status = 'active'
        AND (p_target_id IS NULL OR id = p_target_id)
    LOOP
      SELECT id INTO conv_id FROM public.chat_conversations
      WHERE kind = 'admin_customer' AND customer_id = rec.id
      LIMIT 1;
      IF conv_id IS NULL THEN
        INSERT INTO public.chat_conversations (customer_id, admin_id, kind, can_reply, title)
        VALUES (rec.id, uid, 'admin_customer', FALSE, title)
        RETURNING id INTO conv_id;
      END IF;
      INSERT INTO public.chat_messages (conversation_id, sender_id, body, is_system)
      VALUES (conv_id, uid, body, TRUE);
      INSERT INTO public.notifications (user_id, title, message, type, reference_id)
      VALUES (rec.id, title, body, 'announcement', conv_id);
      sent := sent + 1;
    END LOOP;
  ELSIF audience IN ('shop', 'shops', 'shop_owner', 'shop_owners', 'specific_shop') THEN
    FOR rec IN
      SELECT id, owner_user_id FROM public.shops
      WHERE status = 'active' AND (p_target_id IS NULL OR id = p_target_id)
    LOOP
      SELECT id INTO conv_id FROM public.chat_conversations
      WHERE kind = 'shop_admin' AND shop_id = rec.id
      LIMIT 1;
      IF conv_id IS NULL THEN
        INSERT INTO public.chat_conversations (shop_id, admin_id, kind, can_reply, title)
        VALUES (rec.id, uid, 'shop_admin', TRUE, title)
        RETURNING id INTO conv_id;
      END IF;
      INSERT INTO public.chat_messages (conversation_id, sender_id, body, is_system)
      VALUES (conv_id, uid, body, TRUE);
      INSERT INTO public.shop_notifications (shop_id, title, message, type)
      VALUES (rec.id, title, body, 'announcement');
      sent := sent + 1;
    END LOOP;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Choose customers or shops');
  END IF;

  PERFORM public.log_security_event(
    'admin_broadcast', uid, NULL, p_target_id, audience, NULL, NULL, 'success',
    jsonb_build_object('title', title, 'sent', sent)
  );
  RETURN jsonb_build_object('ok', true, 'sent', sent);
END;
$$;

DROP POLICY IF EXISTS chat_conv_read ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_insert ON public.chat_conversations;
DROP POLICY IF EXISTS chat_msg_read ON public.chat_messages;
DROP POLICY IF EXISTS chat_msg_insert ON public.chat_messages;

CREATE POLICY chat_conv_read ON public.chat_conversations FOR SELECT
  USING (public.chat_can_read(id, auth.uid()));
CREATE POLICY chat_conv_insert ON public.chat_conversations FOR INSERT
  WITH CHECK (FALSE);
CREATE POLICY chat_conv_update ON public.chat_conversations FOR UPDATE
  USING (public.chat_can_read(id, auth.uid()))
  WITH CHECK (public.chat_can_read(id, auth.uid()));
CREATE POLICY chat_msg_read ON public.chat_messages FOR SELECT
  USING (public.chat_can_read(conversation_id, auth.uid()));
CREATE POLICY chat_msg_insert ON public.chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.chat_can_send(conversation_id, auth.uid()));

-- ============================================================
-- TIME PERIODS (Africa/Harare)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_day_bounds(p_period TEXT, p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS TABLE (starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  today DATE := (timezone('Africa/Harare', NOW()))::date;
  start_d DATE;
  end_d DATE;
  week_start DATE;
BEGIN
  -- All dashboard / Stebo / Top 3 windows use Africa/Harare civil days.
  week_start := today - ((EXTRACT(ISODOW FROM today)::int) - 1);
  IF p_from IS NOT NULL AND p_to IS NOT NULL THEN
    start_d := p_from;
    end_d := p_to;
  ELSIF p_period IN ('today') THEN
    start_d := today; end_d := today;
  ELSIF p_period IN ('yesterday') THEN
    start_d := today - 1; end_d := today - 1;
  ELSIF p_period IN ('week', 'this_week') THEN
    start_d := week_start; end_d := today;
  ELSIF p_period IN ('last_week') THEN
    start_d := week_start - 7; end_d := week_start - 1;
  ELSIF p_period IN ('month', 'this_month') THEN
    start_d := date_trunc('month', today)::date; end_d := today;
  ELSIF p_period IN ('last_month') THEN
    start_d := (date_trunc('month', today) - INTERVAL '1 month')::date;
    end_d := (date_trunc('month', today) - INTERVAL '1 day')::date;
  ELSIF p_period IN ('year') THEN
    start_d := date_trunc('year', today)::date; end_d := today;
  ELSE
    start_d := NULL; end_d := NULL;
  END IF;

  IF start_d IS NULL THEN
    RETURN QUERY SELECT NULL::timestamptz, NULL::timestamptz;
  ELSE
    RETURN QUERY SELECT
      (start_d::timestamp AT TIME ZONE 'Africa/Harare'),
      ((end_d + 1)::timestamp AT TIME ZONE 'Africa/Harare');
  END IF;
END;
$$;

-- ============================================================
-- MARKETPLACE ANALYTICS
-- Ranking (Top 3 / marketplace performance) — NOT company revenue:
--   score = completed_paid_orders_30d * 4
--         + distinct_customers_30d * 3
--         + marketplace_events_30d * 1
--         + LEAST(reviews, 40) * avg_rating * 0.35
--         + verified_bonus (8) + recently_active_bonus (2)
-- Shop GMV / profit / payouts are intentionally excluded.
-- ============================================================
CREATE OR REPLACE FUNCTION public.marketplace_performing_shops(
  p_limit INTEGER DEFAULT 3,
  p_period TEXT DEFAULT 'month'
)
RETURNS TABLE (
  shop_id UUID,
  shop_name TEXT,
  logo_url TEXT,
  verification_status TEXT,
  score NUMERIC,
  paid_orders BIGINT,
  unique_customers BIGINT,
  engagement_events BIGINT,
  avg_rating NUMERIC,
  total_reviews INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounds RECORD;
BEGIN
  SELECT * INTO bounds FROM public.platform_day_bounds(COALESCE(NULLIF(p_period, ''), 'month'), NULL, NULL);
  IF bounds.starts_at IS NULL THEN
    SELECT * INTO bounds FROM public.platform_day_bounds('month', NULL, NULL);
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT
      o.shop_id,
      COUNT(*)::bigint AS orders,
      COUNT(DISTINCT o.customer_id) FILTER (WHERE o.customer_id IS NOT NULL)::bigint AS customers
    FROM public.orders o
    WHERE o.payment_status = 'paid'
      AND o.status NOT IN ('cancelled', 'refunded')
      AND o.created_at >= bounds.starts_at
      AND o.created_at < bounds.ends_at
    GROUP BY o.shop_id
  ),
  events AS (
    SELECT shop_id, COUNT(*)::bigint AS hits
    FROM public.marketplace_events
    WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at
    GROUP BY shop_id
  )
  SELECT
    sh.id,
    sh.name,
    sh.logo_url,
    sh.verification_status,
    (
      COALESCE(p.orders, 0) * 4
      + COALESCE(p.customers, 0) * 3
      + COALESCE(e.hits, 0) * 1
      + LEAST(COALESCE(sh.total_reviews, 0), 40) * COALESCE(sh.avg_rating, 0) * 0.35
      + CASE WHEN sh.verification_status = 'verified' THEN 8 ELSE 0 END
      + CASE WHEN sh.updated_at >= NOW() - INTERVAL '14 days' THEN 2 ELSE 0 END
    )::numeric,
    COALESCE(p.orders, 0),
    COALESCE(p.customers, 0),
    COALESCE(e.hits, 0),
    COALESCE(sh.avg_rating, 0),
    COALESCE(sh.total_reviews, 0)
  FROM public.shops sh
  LEFT JOIN paid p ON p.shop_id = sh.id
  LEFT JOIN events e ON e.shop_id = sh.id
  WHERE sh.status = 'active'
    AND (
      COALESCE(p.orders, 0) > 0
      OR COALESCE(e.hits, 0) > 0
      OR COALESCE(sh.total_reviews, 0) > 0
    )
  ORDER BY 5 DESC, sh.name
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 3), 12));
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_platform_stats(
  p_period TEXT DEFAULT 'week',
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounds RECORD;
  users_total INTEGER := 0;
  users_new INTEGER := 0;
  shops_total INTEGER := 0;
  shops_active INTEGER := 0;
  shops_verified INTEGER := 0;
  shops_new INTEGER := 0;
  products_n INTEGER := 0;
  services_n INTEGER := 0;
  orders_n INTEGER := 0;
  events_n INTEGER := 0;
  promos_n INTEGER := 0;
  ads_n INTEGER := 0;
  subs_n INTEGER := 0;
  package_amount NUMERIC := 0;
  platform_pos_n INTEGER := 0;
  platform_pos_amount NUMERIC := 0;
  pending_verify INTEGER := 0;
  support_open INTEGER := 0;
  locked_n INTEGER := 0;
  news_n INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO bounds FROM public.platform_day_bounds(p_period, p_from, p_to);
  IF bounds.starts_at IS NULL THEN
    SELECT * INTO bounds FROM public.platform_day_bounds('week', NULL, NULL);
  END IF;

  SELECT COUNT(*) INTO users_total FROM public.users;
  SELECT COUNT(*) INTO users_new FROM public.users WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*) INTO shops_total FROM public.shops;
  SELECT COUNT(*) INTO shops_active FROM public.shops WHERE status = 'active';
  SELECT COUNT(*) INTO shops_verified FROM public.shops WHERE verification_status = 'verified';
  SELECT COUNT(*) INTO shops_new FROM public.shops WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*) INTO products_n FROM public.products WHERE type = 'product' AND is_available = TRUE;
  SELECT COUNT(*) INTO services_n FROM public.products WHERE type = 'service' AND is_available = TRUE;
  SELECT COUNT(*) INTO orders_n FROM public.orders WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*) INTO events_n FROM public.marketplace_events WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*) INTO promos_n FROM public.promotions WHERE is_active = TRUE;
  SELECT COUNT(*) INTO ads_n FROM public.marketplace_ads WHERE is_active = TRUE;
  SELECT COUNT(*) INTO subs_n FROM public.subscriptions WHERE status IN ('active', 'trial');
  SELECT COALESCE(SUM(amount), 0) INTO package_amount
  FROM public.subscriptions
  WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*), COALESCE(SUM(total), 0) INTO platform_pos_n, platform_pos_amount
  FROM public.platform_receipts
  WHERE created_at >= bounds.starts_at AND created_at < bounds.ends_at;
  SELECT COUNT(*) INTO pending_verify FROM public.verification_requests WHERE status = 'pending';
  SELECT COUNT(*) INTO support_open FROM public.shop_registration_requests WHERE status IN ('pending', 'contacted');
  SELECT COUNT(*) INTO locked_n FROM public.users WHERE account_status = 'locked';
  SELECT COUNT(*) INTO news_n FROM public.lagecto_news_articles WHERE status = 'published';

  RETURN jsonb_build_object(
    'ok', true,
    'timezone', 'Africa/Harare',
    'period', COALESCE(p_period, 'week'),
    'users_total', users_total,
    'users_new', users_new,
    'shops_total', shops_total,
    'shops_active', shops_active,
    'shops_verified', shops_verified,
    'shops_new', shops_new,
    'products', products_n,
    'services', services_n,
    'orders_count', orders_n,
    'marketplace_events', events_n,
    'active_promotions', promos_n,
    'live_ads', ads_n,
    'active_subscriptions', subs_n,
    'package_bookings_amount', package_amount,
    'platform_pos_count', platform_pos_n,
    'platform_pos_amount', platform_pos_amount,
    'pending_verification', pending_verify,
    'pending_registrations', support_open,
    'locked_accounts', locked_n,
    'published_news', news_n,
    'note', 'Shop company sales are not included. package_bookings_amount and platform_pos_amount are LaGecto platform activity, not shop GMV.'
  );
END;
$$;

-- ============================================================
-- STEBO WEEKLY REPORTS (idempotent)
-- Shop reports stay shop-private. Platform reports contain no shop GMV.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stebo_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('shop', 'platform')),
  subject_id UUID,
  week_start DATE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stebo_weekly_shop_week
  ON public.stebo_weekly_reports (subject_id, week_start)
  WHERE scope = 'shop';
CREATE UNIQUE INDEX IF NOT EXISTS stebo_weekly_platform_week
  ON public.stebo_weekly_reports (week_start)
  WHERE scope = 'platform';

ALTER TABLE public.stebo_weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stebo_weekly_read ON public.stebo_weekly_reports;
DROP POLICY IF EXISTS stebo_weekly_write ON public.stebo_weekly_reports;
CREATE POLICY stebo_weekly_read ON public.stebo_weekly_reports FOR SELECT
  USING (
    (scope = 'shop' AND subject_id IS NOT NULL AND public.user_owns_shop(subject_id))
    OR (scope = 'platform' AND public.is_platform_admin())
  );

CREATE OR REPLACE FUNCTION public.stebo_week_start(p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (timezone('Africa/Harare', p_at))::date
    - ((EXTRACT(ISODOW FROM (timezone('Africa/Harare', p_at))::date)::int) - 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_stebo_weekly_reports(p_week_start DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE := COALESCE(p_week_start, public.stebo_week_start() - 7);
  v_week_end DATE := v_week_start + 6;
  shop_rec RECORD;
  created INTEGER := 0;
  skipped INTEGER := 0;
  owner UUID;
BEGIN
  IF NOT (
    public.is_platform_admin()
    OR auth.role() = 'service_role'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  PERFORM set_config('lagecto.internal_stebo', 'true', true);
  PERFORM public.publish_due_news();

  IF NOT EXISTS (
    SELECT 1 FROM public.stebo_weekly_reports r
    WHERE r.scope = 'platform' AND r.week_start = v_week_start
  ) THEN
    INSERT INTO public.stebo_weekly_reports (scope, subject_id, week_start, title, body, metrics)
    VALUES (
      'platform',
      NULL,
      v_week_start,
      'Weekly platform analytics',
      public.stebo_platform_report_text(v_week_start, v_week_end),
      public.marketplace_platform_stats_internal(v_week_start, v_week_end)
    );
    created := created + 1;
  ELSE
    skipped := skipped + 1;
  END IF;

  FOR shop_rec IN SELECT id FROM public.shops WHERE status = 'active'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.stebo_weekly_reports
      WHERE scope = 'shop' AND subject_id = shop_rec.id AND week_start = v_week_start
    ) THEN
      INSERT INTO public.stebo_weekly_reports (scope, subject_id, week_start, title, body, metrics)
      VALUES (
        'shop',
        shop_rec.id,
        v_week_start,
        'Weekly business analytics',
        public.stebo_shop_report_text(shop_rec.id, v_week_start, v_week_end),
        jsonb_build_object(
          'stats', public.shop_dashboard_stats(shop_rec.id, 'custom', v_week_start, v_week_end),
          'performance', public.shop_product_performance(shop_rec.id, 'last_week')
        )
      );
      created := created + 1;
    ELSE
      skipped := skipped + 1;
    END IF;

    SELECT owner_user_id INTO owner FROM public.shops WHERE id = shop_rec.id;
    IF owner IS NOT NULL THEN
      INSERT INTO public.stebo_reports (user_id, title, body)
      SELECT owner, 'Weekly business analytics', r.body
      FROM public.stebo_weekly_reports r
      WHERE r.scope = 'shop' AND r.subject_id = shop_rec.id AND r.week_start = v_week_start
      AND NOT EXISTS (
        SELECT 1 FROM public.stebo_reports sr
        WHERE sr.user_id = owner AND sr.title = 'Weekly business analytics'
          AND sr.created_at >= v_week_start::timestamptz
          AND sr.created_at < (v_week_start + 7)::timestamptz
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'week_start', v_week_start, 'created', created, 'skipped', skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_platform_stats_internal(p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_at TIMESTAMPTZ := (p_from::timestamp AT TIME ZONE 'Africa/Harare');
  end_at TIMESTAMPTZ := ((p_to + 1)::timestamp AT TIME ZONE 'Africa/Harare');
  users_total INTEGER;
  users_new INTEGER;
  shops_active INTEGER;
  shops_verified INTEGER;
  shops_new INTEGER;
  products_n INTEGER;
  services_n INTEGER;
  orders_n INTEGER;
  events_n INTEGER;
  promos_n INTEGER;
  ads_n INTEGER;
  subs_n INTEGER;
  package_amount NUMERIC;
  platform_pos_n INTEGER;
  platform_pos_amount NUMERIC;
BEGIN
  SELECT COUNT(*) INTO users_total FROM public.users;
  SELECT COUNT(*) INTO users_new FROM public.users WHERE created_at >= start_at AND created_at < end_at;
  SELECT COUNT(*) INTO shops_active FROM public.shops WHERE status = 'active';
  SELECT COUNT(*) INTO shops_verified FROM public.shops WHERE verification_status = 'verified';
  SELECT COUNT(*) INTO shops_new FROM public.shops WHERE created_at >= start_at AND created_at < end_at;
  SELECT COUNT(*) INTO products_n FROM public.products WHERE type = 'product' AND is_available = TRUE;
  SELECT COUNT(*) INTO services_n FROM public.products WHERE type = 'service' AND is_available = TRUE;
  SELECT COUNT(*) INTO orders_n FROM public.orders WHERE created_at >= start_at AND created_at < end_at;
  SELECT COUNT(*) INTO events_n FROM public.marketplace_events WHERE created_at >= start_at AND created_at < end_at;
  SELECT COUNT(*) INTO promos_n FROM public.promotions WHERE is_active = TRUE;
  SELECT COUNT(*) INTO ads_n FROM public.marketplace_ads WHERE is_active = TRUE;
  SELECT COUNT(*) INTO subs_n FROM public.subscriptions WHERE status IN ('active', 'trial');
  SELECT COALESCE(SUM(amount), 0) INTO package_amount FROM public.subscriptions WHERE created_at >= start_at AND created_at < end_at;
  SELECT COUNT(*), COALESCE(SUM(total), 0) INTO platform_pos_n, platform_pos_amount
  FROM public.platform_receipts WHERE created_at >= start_at AND created_at < end_at;
  RETURN jsonb_build_object(
    'timezone', 'Africa/Harare',
    'users_total', users_total,
    'users_new', users_new,
    'shops_active', shops_active,
    'shops_verified', shops_verified,
    'shops_new', shops_new,
    'products', products_n,
    'services', services_n,
    'orders_count', orders_n,
    'marketplace_events', events_n,
    'active_promotions', promos_n,
    'live_ads', ads_n,
    'active_subscriptions', subs_n,
    'package_bookings_amount', package_amount,
    'platform_pos_count', platform_pos_n,
    'platform_pos_amount', platform_pos_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stebo_platform_report_text(p_from DATE, p_to DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m JSONB := public.marketplace_platform_stats_internal(p_from, p_to);
  lines TEXT;
BEGIN
  IF COALESCE((m->>'orders_count')::int, 0) = 0
     AND COALESCE((m->>'users_new')::int, 0) = 0
     AND COALESCE((m->>'shops_new')::int, 0) = 0 THEN
    RETURN 'WEEKLY PLATFORM ANALYTICS' || E'\n\n' ||
      'Overview' || E'\n' ||
      'Insufficient data for this insight.' || E'\n\n' ||
      'Period: ' || p_from::text || ' to ' || p_to::text || ' (Africa/Harare).' || E'\n' ||
      'Shop company sales are not treated as LaGecto revenue.';
  END IF;
  lines := 'WEEKLY PLATFORM ANALYTICS' || E'\n\n' ||
    'Overview' || E'\n' ||
    'Marketplace activity for ' || p_from::text || ' to ' || p_to::text || ' (Africa/Harare).' || E'\n' ||
    'Active shops: ' || (m->>'shops_active') || '. Verified shops: ' || (m->>'shops_verified') || '.' || E'\n' ||
    'Registered users: ' || (m->>'users_total') || ' (new this week: ' || (m->>'users_new') || ').' || E'\n\n' ||
    'What performed well' || E'\n';
  IF COALESCE((m->>'orders_count')::int, 0) > 0 THEN
    lines := lines || 'Completed marketplace orders this week: ' || (m->>'orders_count') || '.' || E'\n';
  ELSE
    lines := lines || 'Insufficient data for this insight.' || E'\n';
  END IF;
  lines := lines || E'\nWhat needs attention' || E'\n' ||
    'Live listings: ' || (m->>'products') || ' products, ' || (m->>'services') || ' services.' || E'\n' ||
    'Active promotions: ' || (m->>'active_promotions') || '. Live ads: ' || (m->>'live_ads') || '.' || E'\n\n' ||
    'Customer activity' || E'\n' ||
    'Marketplace events: ' || (m->>'marketplace_events') || '. New shops: ' || (m->>'shops_new') || '.' || E'\n\n' ||
    'Opportunities' || E'\n';
  IF COALESCE((m->>'shops_new')::int, 0) > 0 THEN
    lines := lines || 'New shops joined. Help them complete storefronts and verification.' || E'\n';
  ELSE
    lines := lines || 'Insufficient data for this insight.' || E'\n';
  END IF;
  lines := lines || E'\nNext week' || E'\n' ||
    'Review pending verification, keep packages accurate, and watch marketplace engagement — not shop private revenue.' || E'\n\n' ||
    'LaGecto package bookings this week: ' || COALESCE(m->>'package_bookings_amount', '0') ||
    '. Platform POS collections: ' || COALESCE(m->>'platform_pos_amount', '0') || '.' || E'\n' ||
    'Shop GMV is excluded from this report.';
  RETURN lines;
END;
$$;

CREATE OR REPLACE FUNCTION public.stebo_shop_report_text(p_shop_id UUID, p_from DATE, p_to DATE)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats JSONB;
  perf JSONB;
  lines TEXT;
  top_name TEXT;
  low_name TEXT;
  orders_n INTEGER;
  revenue NUMERIC;
BEGIN
  stats := public.shop_dashboard_stats(p_shop_id, 'custom', p_from, p_to);
  perf := public.shop_product_performance(p_shop_id, 'custom');
  IF stats->>'ok' = 'false' THEN
    RETURN 'WEEKLY BUSINESS ANALYTICS' || E'\n\nInsufficient data for this insight.';
  END IF;
  orders_n := COALESCE((stats->>'completed_orders')::int, 0);
  revenue := COALESCE((stats->>'revenue')::numeric, 0);
  lines := 'WEEKLY BUSINESS ANALYTICS' || E'\n\n' ||
    'Overview' || E'\n' ||
    'Your activity this week (' || p_from::text || ' to ' || p_to::text || ', Africa/Harare).' || E'\n';
  IF orders_n = 0 AND revenue = 0 THEN
    lines := lines || 'Insufficient data for this insight.' || E'\n';
  ELSE
    lines := lines || 'Completed orders: ' || orders_n || '. Recorded sales: ' || revenue::text || '.' || E'\n';
  END IF;
  lines := lines || E'\nWhat performed well' || E'\n';
  top_name := perf->'top'->0->>'product_name';
  IF top_name IS NOT NULL THEN
    lines := lines || COALESCE(top_name, 'A product') || ' performed strongly based on actual sales quantity this week.' || E'\n';
  ELSE
    lines := lines || 'Insufficient data for this insight.' || E'\n';
  END IF;
  lines := lines || E'\nWhat needs attention' || E'\n';
  low_name := perf->'low_stock'->0->>'name';
  IF low_name IS NOT NULL THEN
    lines := lines || 'Inventory for ' || low_name || ' is low based on your stock records.' || E'\n';
  ELSE
    lines := lines || 'No low-stock alerts from current inventory records.' || E'\n';
  END IF;
  lines := lines || E'\nCustomer activity' || E'\n' ||
    'Customers on record: ' || COALESCE(stats->>'customers', '0') ||
    '. Pending orders: ' || COALESCE(stats->>'pending_orders', '0') || '.' || E'\n\n' ||
    'Opportunities' || E'\n';
  IF perf->'slow'->0->>'name' IS NOT NULL THEN
    lines := lines || COALESCE(perf->'slow'->0->>'name', 'A listed product') || ' had no recorded sales this week. Consider a promotion if stock is healthy.' || E'\n';
  ELSE
    lines := lines || 'Insufficient data for this insight.' || E'\n';
  END IF;
  lines := lines || E'\nNext week' || E'\n' ||
    'Keep POS stock accurate, complete pending orders, and review promotions that are actually live.';
  RETURN lines;
END;
$$;

-- shop_product_performance custom period uses platform_day_bounds('custom') which needs p_from/p_to.
-- Extend it to accept dates by wrapping: when p_period = custom without dates, fall back to last week.

CREATE OR REPLACE FUNCTION public.shop_product_performance(p_shop_id UUID, p_period TEXT DEFAULT 'week')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounds RECORD;
  period TEXT := COALESCE(NULLIF(p_period, ''), 'week');
  privileged BOOLEAN := auth.role() = 'service_role'
    OR current_setting('lagecto.internal_stebo', true) = 'true'
    OR public.user_owns_shop(p_shop_id);
BEGIN
  IF NOT privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF period = 'custom' THEN
    SELECT * INTO bounds FROM public.platform_day_bounds('last_week', NULL, NULL);
  ELSE
    SELECT * INTO bounds FROM public.platform_day_bounds(period, NULL, NULL);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'timezone', 'Africa/Harare',
    'top', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT si.product_id, si.product_name, SUM(si.quantity)::int AS units, SUM(si.total_price)::numeric AS amount
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.shop_id = p_shop_id AND s.status = 'completed'
          AND s.sale_date >= bounds.starts_at AND s.sale_date < bounds.ends_at
        GROUP BY si.product_id, si.product_name
        ORDER BY SUM(si.quantity) DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'slow', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT p.id, p.name, COALESCE(p.stock, 0) AS stock
        FROM public.products p
        WHERE p.shop_id = p_shop_id AND p.type = 'product' AND p.is_available = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM public.sale_items si
            JOIN public.sales s ON s.id = si.sale_id
            WHERE si.product_id = p.id AND s.status = 'completed'
              AND s.sale_date >= bounds.starts_at AND s.sale_date < bounds.ends_at
          )
        ORDER BY p.stock DESC NULLS LAST, p.name
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'low_stock', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT p.id, p.name, p.stock, p.low_stock_threshold
        FROM public.products p
        WHERE p.shop_id = p_shop_id AND p.type = 'product'
          AND p.stock IS NOT NULL AND p.low_stock_threshold IS NOT NULL
          AND p.stock <= p.low_stock_threshold
        ORDER BY p.stock ASC
        LIMIT 8
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

-- generate_stebo_weekly_reports uses shop_dashboard_stats which checks user_owns_shop.
-- Cron runs as service_role, which is not a shop owner. Bypass via a privileged wrapper.

CREATE OR REPLACE FUNCTION public.shop_dashboard_stats(
  p_shop_id UUID,
  p_period TEXT DEFAULT 'current',
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounds RECORD;
  current_period UUID;
  start_at TIMESTAMPTZ;
  end_at TIMESTAMPTZ;
  revenue NUMERIC := 0;
  expenses NUMERIC := 0;
  paid_volume NUMERIC := 0;
  refunded_volume NUMERIC := 0;
  pending_orders INTEGER := 0;
  completed_orders INTEGER := 0;
  product_count INTEGER := 0;
  service_count INTEGER := 0;
  customer_count INTEGER := 0;
  inventory_units INTEGER := 0;
  low_stock INTEGER := 0;
  active_promos INTEGER := 0;
  refund_count INTEGER := 0;
  privileged BOOLEAN := auth.role() = 'service_role'
    OR current_setting('lagecto.internal_stebo', true) = 'true'
    OR public.user_owns_shop(p_shop_id);
BEGIN
  IF NOT privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT id INTO current_period
  FROM public.financial_periods
  WHERE shop_id = p_shop_id AND is_current = TRUE
  LIMIT 1;

  IF p_period = 'current' OR (p_period IS NULL AND p_from IS NULL) THEN
    SELECT COALESCE(SUM(total), 0) INTO revenue
    FROM public.sales
    WHERE shop_id = p_shop_id AND status = 'completed' AND period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO expenses
    FROM public.shop_expenses
    WHERE shop_id = p_shop_id AND period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO paid_volume
    FROM public.payments
    WHERE shop_id = p_shop_id AND status = 'paid' AND period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO refunded_volume
    FROM public.payment_refunds
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND payment_id IN (SELECT id FROM public.payments WHERE shop_id = p_shop_id AND period_id = current_period);
  ELSE
    SELECT * INTO bounds FROM public.platform_day_bounds(p_period, p_from, p_to);
    start_at := bounds.starts_at;
    end_at := bounds.ends_at;

    SELECT COALESCE(SUM(total), 0) INTO revenue
    FROM public.sales
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND sale_date >= start_at AND sale_date < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO expenses
    FROM public.shop_expenses
    WHERE shop_id = p_shop_id
      AND expense_date >= (start_at AT TIME ZONE 'Africa/Harare')::date
      AND expense_date < (end_at AT TIME ZONE 'Africa/Harare')::date;

    SELECT COALESCE(SUM(amount), 0) INTO paid_volume
    FROM public.payments
    WHERE shop_id = p_shop_id AND status = 'paid'
      AND created_at >= start_at AND created_at < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO refunded_volume
    FROM public.payment_refunds
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND created_at >= start_at AND created_at < end_at;
  END IF;

  SELECT COUNT(*) INTO pending_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'pending';
  SELECT COUNT(*) INTO completed_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'completed';
  SELECT COUNT(*) INTO product_count FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO service_count FROM public.products WHERE shop_id = p_shop_id AND type = 'service';
  SELECT COUNT(DISTINCT customer_id) INTO customer_count FROM public.orders WHERE shop_id = p_shop_id AND customer_id IS NOT NULL;
  SELECT COALESCE(SUM(stock), 0) INTO inventory_units FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO low_stock FROM public.products
  WHERE shop_id = p_shop_id AND type = 'product' AND stock IS NOT NULL AND low_stock_threshold IS NOT NULL AND stock <= low_stock_threshold;
  SELECT COUNT(*) INTO active_promos FROM public.promotions WHERE shop_id = p_shop_id AND is_active = TRUE;
  SELECT COUNT(*) INTO refund_count FROM public.payment_refunds WHERE shop_id = p_shop_id AND status = 'completed';

  RETURN jsonb_build_object(
    'ok', true,
    'timezone', 'Africa/Harare',
    'period', COALESCE(p_period, 'current'),
    'current_period_id', current_period,
    'revenue', revenue,
    'expenses', expenses,
    'profit', revenue - expenses,
    'paid_volume', paid_volume,
    'refunded_volume', refunded_volume,
    'net_paid', paid_volume - refunded_volume,
    'pending_orders', pending_orders,
    'completed_orders', completed_orders,
    'products', product_count,
    'services', service_count,
    'customers', customer_count,
    'inventory_units', inventory_units,
    'low_stock', low_stock,
    'active_promotions', active_promos,
    'completed_refunds', refund_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.chat_can_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_send(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_chat_conversation(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_message(TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_performing_shops(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_platform_stats(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_product_performance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_dashboard_stats(UUID, TEXT, DATE, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_stebo_weekly_reports(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_stebo_weekly_reports(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_due_news() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.stebo_week_start(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_platform_stats_internal(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stebo_platform_report_text(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stebo_shop_report_text(UUID, DATE, DATE) TO authenticated;

-- Lock down internal stats text to owners/admins via the wrappers; revoke broad execute on internals from anon.
REVOKE EXECUTE ON FUNCTION public.marketplace_platform_stats_internal(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stebo_platform_report_text(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stebo_shop_report_text(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_platform_stats_internal(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.stebo_platform_report_text(DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.stebo_shop_report_text(UUID, DATE, DATE) TO service_role;

-- Admin UI triggers generation through a service-role API route, not this GRANT.
