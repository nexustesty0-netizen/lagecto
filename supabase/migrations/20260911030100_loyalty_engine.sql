-- Loyalty / promo / badge engine. All financial and achievement writes are SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.loyalty_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_audit_log (actor_id, action, entity_type, entity_id, shop_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_shop_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_platform_loyalty_program()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  SELECT id INTO pid FROM public.loyalty_programs WHERE scope = 'platform' LIMIT 1;
  IF pid IS NULL THEN
    INSERT INTO public.loyalty_programs (scope, name, description, is_active)
    VALUES ('platform', 'LaGecto Loyalty', 'Platform rewards for shopping across LaGecto.', TRUE)
    RETURNING id INTO pid;
  END IF;
  RETURN pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_shop_loyalty_program(p_shop_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  shop_name TEXT;
BEGIN
  SELECT id INTO pid FROM public.loyalty_programs WHERE shop_id = p_shop_id LIMIT 1;
  IF pid IS NOT NULL THEN
    RETURN pid;
  END IF;
  SELECT name INTO shop_name FROM public.shops WHERE id = p_shop_id;
  INSERT INTO public.loyalty_programs (scope, shop_id, name, description, is_active)
  VALUES ('shop', p_shop_id, COALESCE(shop_name, 'Shop') || ' Loyalty', 'Rewards for customers of this shop.', TRUE)
  RETURNING id INTO pid;
  INSERT INTO public.loyalty_levels (program_id, slug, name, description, icon, rank, min_points, discount_percent, benefits)
  SELECT pid, slug, name, description, icon, rank, min_points, discount_percent, benefits
  FROM public.loyalty_levels
  WHERE program_id = public.ensure_platform_loyalty_program()
  ON CONFLICT (program_id, slug) DO NOTHING;
  RETURN pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_loyalty_wallet(p_user_id UUID, p_shop_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid UUID;
  lvl UUID;
  program UUID;
BEGIN
  IF p_shop_id IS NULL THEN
    SELECT id INTO wid FROM public.loyalty_wallets WHERE user_id = p_user_id AND scope = 'platform';
    IF wid IS NOT NULL THEN RETURN wid; END IF;
    program := public.ensure_platform_loyalty_program();
    SELECT id INTO lvl FROM public.loyalty_levels WHERE program_id = program AND is_active ORDER BY rank LIMIT 1;
    INSERT INTO public.loyalty_wallets (user_id, shop_id, scope, points, lifetime_points, level_id)
    VALUES (p_user_id, NULL, 'platform', 0, 0, lvl)
    RETURNING id INTO wid;
  ELSE
    SELECT id INTO wid FROM public.loyalty_wallets WHERE user_id = p_user_id AND shop_id = p_shop_id AND scope = 'shop';
    IF wid IS NOT NULL THEN RETURN wid; END IF;
    program := public.ensure_shop_loyalty_program(p_shop_id);
    SELECT id INTO lvl FROM public.loyalty_levels WHERE program_id = program AND is_active ORDER BY rank LIMIT 1;
    INSERT INTO public.loyalty_wallets (user_id, shop_id, scope, points, lifetime_points, level_id)
    VALUES (p_user_id, p_shop_id, 'shop', 0, 0, lvl)
    RETURNING id INTO wid;
  END IF;
  RETURN wid;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_loyalty_level(p_wallet_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.loyalty_wallets%ROWTYPE;
  program UUID;
  nxt public.loyalty_levels%ROWTYPE;
  prev_rank INTEGER := 0;
BEGIN
  SELECT * INTO w FROM public.loyalty_wallets WHERE id = p_wallet_id;
  IF w.id IS NULL THEN RETURN; END IF;
  IF w.scope = 'platform' THEN
    program := public.ensure_platform_loyalty_program();
  ELSE
    program := public.ensure_shop_loyalty_program(w.shop_id);
  END IF;
  SELECT COALESCE(l.rank, 0) INTO prev_rank
  FROM public.loyalty_levels l WHERE l.id = w.level_id;
  SELECT * INTO nxt
  FROM public.loyalty_levels
  WHERE program_id = program AND is_active AND min_points <= w.lifetime_points
  ORDER BY rank DESC
  LIMIT 1;
  IF nxt.id IS NOT NULL AND nxt.id IS DISTINCT FROM w.level_id THEN
    UPDATE public.loyalty_wallets SET level_id = nxt.id, updated_at = NOW() WHERE id = w.id;
    IF COALESCE(nxt.rank, 0) > COALESCE(prev_rank, 0) AND w.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
      VALUES (
        w.user_id,
        'You reached ' || nxt.name || ' level!',
        'Your ' || CASE WHEN w.scope = 'platform' THEN 'LaGecto' ELSE 'shop' END || ' loyalty level is now ' || nxt.name || '.',
        'loyalty',
        '/customer/loyalty',
        nxt.id
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_user_id UUID,
  p_shop_id UUID,
  p_points INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT,
  p_order_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid UUID;
  inserted UUID;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_points, 0) = 0 OR p_idempotency_key IS NULL THEN
    RETURN FALSE;
  END IF;
  wid := public.ensure_loyalty_wallet(p_user_id, p_shop_id);
  INSERT INTO public.loyalty_transactions (wallet_id, points, reason, kind, idempotency_key, order_id, metadata)
  VALUES (
    wid,
    p_points,
    left(COALESCE(p_reason, ''), 200),
    CASE WHEN p_points < 0 THEN 'reverse' ELSE 'earn' END,
    p_idempotency_key,
    p_order_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (wallet_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO inserted;
  IF inserted IS NULL THEN
    RETURN FALSE;
  END IF;
  UPDATE public.loyalty_wallets
  SET
    points = GREATEST(0, points + p_points),
    lifetime_points = GREATEST(0, lifetime_points + p_points),
    updated_at = NOW()
  WHERE id = wid;
  PERFORM public.refresh_loyalty_level(wid);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_has_completed_order(p_user_id UUID, p_shop_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.customer_id = p_user_id
      AND o.status = 'completed'
      AND o.payment_status IN ('paid', 'pending')
      AND (p_shop_id IS NULL OR o.shop_id = p_shop_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.valid_completed_orders(p_user_id UUID, p_shop_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  total NUMERIC,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT o.id, o.shop_id, o.total, o.created_at, o.completed_at
  FROM public.orders o
  WHERE o.customer_id = p_user_id
    AND o.status = 'completed'
    AND COALESCE(o.payment_status, 'paid') NOT IN ('failed', 'cancelled', 'refunded')
    AND (p_shop_id IS NULL OR o.shop_id = p_shop_id);
$$;

CREATE OR REPLACE FUNCTION public.customer_engagement_snapshot(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  snap JSONB;
  profile public.users%ROWTYPE;
  streak INTEGER := 0;
  cursor_day DATE;
  visit DATE;
  platform_pts INTEGER := 0;
  platform_rank INTEGER := 1;
BEGIN
  SELECT * INTO profile FROM public.users WHERE id = p_user_id;
  IF profile.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(MAX(lifetime_points), 0), COALESCE(MAX(l.rank), 1)
  INTO platform_pts, platform_rank
  FROM public.loyalty_wallets w
  LEFT JOIN public.loyalty_levels l ON l.id = w.level_id
  WHERE w.user_id = p_user_id AND w.scope = 'platform';

  SELECT COUNT(*) FILTER (WHERE visit_date IS NOT NULL) INTO rec FROM public.loyalty_visits WHERE user_id = p_user_id;

  streak := 0;
  cursor_day := CURRENT_DATE;
  FOR visit IN
    SELECT v.visit_date FROM public.loyalty_visits v WHERE v.user_id = p_user_id ORDER BY v.visit_date DESC
  LOOP
    IF visit = cursor_day OR (streak = 0 AND visit = CURRENT_DATE - 1 AND cursor_day = CURRENT_DATE) THEN
      IF streak = 0 AND visit = CURRENT_DATE - 1 THEN
        cursor_day := CURRENT_DATE - 1;
      END IF;
      streak := streak + 1;
      cursor_day := cursor_day - 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  SELECT jsonb_build_object(
    'completed_orders', COUNT(*),
    'completed_order_value', COALESCE(SUM(o.total), 0),
    'distinct_shops_purchased', COUNT(DISTINCT o.shop_id),
    'weekend_orders', COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM COALESCE(o.completed_at, o.created_at)) >= 6),
    'distinct_order_months', COUNT(DISTINCT to_char(COALESCE(o.completed_at, o.created_at), 'YYYY-MM')),
    'distinct_order_days', COUNT(DISTINCT (COALESCE(o.completed_at, o.created_at))::date),
    'max_orders_single_shop', COALESCE((
      SELECT MAX(cnt) FROM (
        SELECT COUNT(*) AS cnt FROM public.valid_completed_orders(p_user_id) g GROUP BY g.shop_id
      ) s
    ), 0),
    'new_shop_purchases', COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.shops sh
        WHERE sh.id = o.shop_id AND o.created_at < sh.created_at + INTERVAL '30 days'
      )
    ),
    'hidden_gem_purchases', COUNT(*) FILTER (
      WHERE EXISTS (SELECT 1 FROM public.shops sh WHERE sh.id = o.shop_id AND COALESCE(sh.total_reviews, 0) < 10)
    ),
    'founding_shop_purchases', COUNT(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.campaign_enrollments e
        JOIN public.campaigns c ON c.id = e.campaign_id
        WHERE e.shop_id = o.shop_id AND c.kind = 'founding_users' AND e.status = 'active'
      )
    ),
    'had_comeback', EXISTS (
      SELECT 1
      FROM public.valid_completed_orders(p_user_id) a
      JOIN public.valid_completed_orders(p_user_id) b ON b.created_at > a.created_at + INTERVAL '14 days'
    )
  )
  INTO snap
  FROM public.valid_completed_orders(p_user_id) o;

  snap := COALESCE(snap, '{}'::jsonb) || jsonb_build_object(
    'reviews_count', (SELECT COUNT(*) FROM public.ratings r WHERE r.user_id = p_user_id AND COALESCE(r.is_hidden, FALSE) = FALSE),
    'reviews_with_text', (SELECT COUNT(*) FROM public.ratings r WHERE r.user_id = p_user_id AND length(COALESCE(r.review, '')) >= 12 AND COALESCE(r.is_hidden, FALSE) = FALSE),
    'distinct_shops_reviewed', (SELECT COUNT(DISTINCT r.shop_id) FROM public.ratings r WHERE r.user_id = p_user_id AND COALESCE(r.is_hidden, FALSE) = FALSE),
    'shop_views', (SELECT COUNT(*) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.event_type = 'shop_view'),
    'product_views', (SELECT COUNT(*) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.event_type = 'product_view'),
    'searches', (SELECT COUNT(*) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.event_type = 'search'),
    'cart_adds', (SELECT COUNT(*) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.event_type = 'add_to_cart'),
    'promotion_clicks', (SELECT COUNT(*) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.event_type = 'promotion_click'),
    'distinct_shops_viewed', (SELECT COUNT(DISTINCT e.shop_id) FROM public.marketplace_events e WHERE e.user_id = p_user_id AND e.shop_id IS NOT NULL),
    'distinct_categories_viewed', (
      SELECT COUNT(DISTINCT sh.category)
      FROM public.marketplace_events e
      JOIN public.shops sh ON sh.id = e.shop_id
      WHERE e.user_id = p_user_id
    ),
    'saved_shops', (SELECT COUNT(*) FROM public.saved_shops s WHERE s.user_id = p_user_id),
    'promo_redemptions', (SELECT COUNT(*) FROM public.promo_redemptions pr WHERE pr.user_id = p_user_id AND pr.status = 'applied'),
    'promo_savings', (SELECT COALESCE(SUM(pr.discount_amount), 0) FROM public.promo_redemptions pr WHERE pr.user_id = p_user_id AND pr.status = 'applied'),
    'loyalty_only_redemptions', (
      SELECT COUNT(*) FROM public.promo_redemptions pr
      JOIN public.promo_codes pc ON pc.id = pr.promo_code_id
      WHERE pr.user_id = p_user_id AND pr.status = 'applied' AND pc.loyalty_only = TRUE
    ),
    'rewards_claimed', (SELECT COUNT(*) FROM public.reward_claims rc WHERE rc.user_id = p_user_id AND rc.status IN ('claimed', 'used')),
    'challenges_started', (SELECT COUNT(*) FROM public.challenge_progress cp WHERE cp.user_id = p_user_id),
    'challenges_completed', (SELECT COUNT(*) FROM public.challenge_progress cp WHERE cp.user_id = p_user_id AND cp.completed_at IS NOT NULL),
    'visit_days', (SELECT COUNT(*) FROM public.loyalty_visits v WHERE v.user_id = p_user_id),
    'current_streak', streak,
    'profile_complete', (
      COALESCE(profile.name, '') <> ''
      AND COALESCE(profile.phone, '') <> ''
      AND COALESCE(profile.address, '') <> ''
      AND COALESCE(profile.username, '') <> ''
    ),
    'account_age_days', GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - profile.created_at)) / 86400)),
    'platform_points', platform_pts,
    'platform_level_rank', platform_rank,
    'is_founding_user', EXISTS (
      SELECT 1 FROM public.campaign_enrollments e
      JOIN public.campaigns c ON c.id = e.campaign_id
      WHERE c.kind = 'founding_users' AND e.user_id = p_user_id AND e.status IN ('active', 'expired')
    ),
    'is_early_adopter', EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.kind = 'founding_users'
        AND COALESCE((c.eligibility->>'include_customers')::boolean, FALSE) = TRUE
        AND profile.role = 'customer'
        AND profile.created_at >= COALESCE(c.starts_at, profile.created_at)
        AND (c.ends_at IS NULL OR profile.created_at <= c.ends_at)
        AND c.is_active = TRUE
    ),
    'is_marketplace_pioneer', (
      SELECT COUNT(*) FROM public.users u
      WHERE u.role = 'customer' AND u.created_at <= profile.created_at
    ) <= 100,
    'badges_unlocked', (SELECT COUNT(*) FROM public.customer_badges b WHERE b.user_id = p_user_id)
  );

  RETURN snap;
END;
$$;

CREATE OR REPLACE FUNCTION public.requirement_met(p_snapshot JSONB, p_requirements JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  rule JSONB;
  metric TEXT;
  actual NUMERIC;
  target NUMERIC;
BEGIN
  IF p_requirements IS NULL OR p_requirements = '{}'::jsonb THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_requirements->'all') = 'array' THEN
    FOR rule IN SELECT * FROM jsonb_array_elements(p_requirements->'all')
    LOOP
      metric := rule->>'metric';
      target := COALESCE((rule->>'gte')::numeric, (rule->>'eq')::numeric, 1);
      IF jsonb_typeof(p_snapshot->metric) = 'boolean' THEN
        IF COALESCE((p_snapshot->>metric)::boolean, FALSE) IS NOT TRUE THEN
          RETURN FALSE;
        END IF;
      ELSE
        actual := COALESCE((p_snapshot->>metric)::numeric, 0);
        IF actual < target THEN
          RETURN FALSE;
        END IF;
      END IF;
    END LOOP;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.requirement_progress(p_snapshot JSONB, p_requirements JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  rule JSONB;
  metric TEXT;
  actual NUMERIC := 0;
  target NUMERIC := 1;
  best JSONB := jsonb_build_object('current', 0, 'target', 1);
BEGIN
  IF jsonb_typeof(p_requirements->'all') <> 'array' THEN
    RETURN best;
  END IF;
  FOR rule IN SELECT * FROM jsonb_array_elements(p_requirements->'all')
  LOOP
    metric := rule->>'metric';
    target := COALESCE((rule->>'gte')::numeric, (rule->>'eq')::numeric, 1);
    IF jsonb_typeof(p_snapshot->metric) = 'boolean' THEN
      actual := CASE WHEN COALESCE((p_snapshot->>metric)::boolean, FALSE) THEN 1 ELSE 0 END;
      target := 1;
    ELSE
      actual := COALESCE((p_snapshot->>metric)::numeric, 0);
    END IF;
    best := jsonb_build_object('current', actual, 'target', GREATEST(target, 1), 'metric', metric);
  END LOOP;
  RETURN best;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_loyalty(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_href TEXT,
  p_reference UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = p_user_id AND n.type = p_type AND n.reference_id IS NOT DISTINCT FROM p_reference
      AND n.created_at > NOW() - INTERVAL '2 days'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
  VALUES (p_user_id, left(p_title, 120), left(p_message, 400), p_type, p_href, p_reference);
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_customer_engagement(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := COALESCE(p_user_id, auth.uid());
  snap JSONB;
  def public.customer_badge_definitions%ROWTYPE;
  unlocked UUID[] := '{}';
  progress JSONB;
  newly JSONB := '[]'::jsonb;
  ch public.loyalty_challenges%ROWTYPE;
  profile_ok BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF current_setting('lagecto.allow_loyalty_eval', true) IS DISTINCT FROM 'true'
     AND uid IS DISTINCT FROM auth.uid()
     AND NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  INSERT INTO public.loyalty_visits (user_id, visit_date)
  VALUES (uid, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  PERFORM public.ensure_loyalty_wallet(uid, NULL);
  snap := public.customer_engagement_snapshot(uid);

  profile_ok := COALESCE((snap->>'profile_complete')::boolean, FALSE);
  IF profile_ok THEN
    IF public.award_loyalty_points(uid, NULL, 25, 'Completed your profile', 'profile_complete', NULL, '{}'::jsonb) THEN
      PERFORM public.notify_loyalty(uid, 'Your 25-point reward is ready.', 'Profile complete — LaGecto loyalty points were added.', 'loyalty', '/customer/rewards', NULL);
    END IF;
  END IF;

  IF COALESCE((snap->>'completed_orders')::numeric, 0) >= 1 THEN
    PERFORM public.award_loyalty_points(uid, NULL, 50, 'First completed order', 'first_completed_order', NULL, '{}'::jsonb);
  END IF;

  FOR def IN
    SELECT * FROM public.customer_badge_definitions
    WHERE audience = 'customer' AND is_active = TRUE
    ORDER BY sort_order, name
  LOOP
    progress := public.requirement_progress(snap, def.requirements);
    INSERT INTO public.badge_progress (user_id, badge_id, current_value, target_value, updated_at)
    VALUES (uid, def.id, COALESCE((progress->>'current')::numeric, 0), COALESCE((progress->>'target')::numeric, 1), NOW())
    ON CONFLICT (user_id, badge_id)
    DO UPDATE SET current_value = EXCLUDED.current_value, target_value = EXCLUDED.target_value, updated_at = NOW();

    IF public.requirement_met(snap, def.requirements) THEN
      INSERT INTO public.customer_badges (user_id, badge_id, source)
      VALUES (uid, def.id, 'engine')
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      IF FOUND THEN
        unlocked := array_append(unlocked, def.id);
        newly := newly || jsonb_build_array(jsonb_build_object(
          'id', def.id, 'slug', def.slug, 'name', def.name, 'description', def.description, 'rarity', def.rarity, 'icon', def.icon
        ));
        PERFORM public.notify_loyalty(
          uid,
          'Achievement unlocked',
          'You unlocked ' || def.name || '.',
          'achievement',
          '/customer/badges',
          def.id
        );
      END IF;
    ELSE
      DELETE FROM public.customer_badges
      WHERE user_id = uid AND badge_id = def.id AND source = 'engine'
        AND def.slug IN (
          SELECT slug FROM public.customer_badge_definitions d2
          WHERE d2.id = def.id
            AND (d2.requirements->'all' @> '[{"metric":"completed_orders"}]'::jsonb
              OR d2.requirements::text LIKE '%completed_orders%'
              OR d2.requirements::text LIKE '%completed_order_value%')
        );
    END IF;
  END LOOP;

  -- Recompute lagecto_100 / ultimate after other unlocks
  snap := snap || jsonb_build_object(
    'badges_unlocked', (SELECT COUNT(*) FROM public.customer_badges WHERE user_id = uid)
  );
  FOR def IN
    SELECT * FROM public.customer_badge_definitions
    WHERE audience = 'customer' AND is_active AND slug IN ('lagecto_100', 'ultimate_lagecto_champion')
  LOOP
    IF public.requirement_met(snap, def.requirements) THEN
      INSERT INTO public.customer_badges (user_id, badge_id, source)
      VALUES (uid, def.id, 'engine')
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      IF FOUND THEN
        newly := newly || jsonb_build_array(jsonb_build_object(
          'id', def.id, 'slug', def.slug, 'name', def.name, 'description', def.description, 'rarity', def.rarity, 'icon', def.icon
        ));
      END IF;
    END IF;
  END LOOP;

  FOR ch IN
    SELECT * FROM public.loyalty_challenges
    WHERE is_active AND shop_id IS NULL
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
  LOOP
    INSERT INTO public.challenge_progress (challenge_id, user_id)
    VALUES (ch.id, uid)
    ON CONFLICT DO NOTHING;
    IF public.requirement_met(snap, ch.requirements) THEN
      UPDATE public.challenge_progress
      SET completed_at = COALESCE(completed_at, NOW())
      WHERE challenge_id = ch.id AND user_id = uid AND completed_at IS NULL;
      IF FOUND THEN
        PERFORM public.award_loyalty_points(
          uid, NULL, ch.reward_points, 'Challenge: ' || ch.name, 'challenge:' || ch.id::text, NULL, '{}'::jsonb
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'snapshot', snap, 'newly_unlocked', newly);
END;
$$;
