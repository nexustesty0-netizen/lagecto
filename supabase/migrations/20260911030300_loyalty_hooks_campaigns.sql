-- Order lifecycle loyalty, founding campaign, shop badges, reward claims, admin/shop RPCs.

CREATE OR REPLACE FUNCTION public.apply_order_loyalty(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  pts INTEGER;
  shop_orders INTEGER;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id;
  IF ord.id IS NULL OR ord.customer_id IS NULL THEN RETURN; END IF;
  IF ord.status <> 'completed' THEN RETURN; END IF;
  IF COALESCE(ord.payment_status, 'paid') IN ('failed', 'cancelled', 'refunded') THEN RETURN; END IF;
  IF ord.loyalty_awarded_at IS NOT NULL THEN RETURN; END IF;

  pts := 20 + FLOOR(GREATEST(COALESCE(ord.total, 0), 0));
  PERFORM public.award_loyalty_points(
    ord.customer_id, NULL, pts, 'Completed order ' || COALESCE(ord.order_number, ''),
    'order_complete:platform:' || ord.id::text, ord.id, jsonb_build_object('shop_id', ord.shop_id)
  );
  PERFORM public.award_loyalty_points(
    ord.customer_id, ord.shop_id, pts, 'Completed order at this shop',
    'order_complete:shop:' || ord.id::text, ord.id, '{}'::jsonb
  );

  SELECT COUNT(*) INTO shop_orders
  FROM public.valid_completed_orders(ord.customer_id, ord.shop_id);
  IF shop_orders = 1 THEN
    PERFORM public.award_loyalty_points(
      ord.customer_id, ord.shop_id, 30, 'First purchase at this shop',
      'shop_first_purchase:' || ord.shop_id::text || ':' || ord.customer_id::text, ord.id, '{}'::jsonb
    );
  END IF;
  IF shop_orders IN (2, 5, 10) THEN
    PERFORM public.award_loyalty_points(
      ord.customer_id, ord.shop_id, shop_orders * 5, shop_orders::text || ' purchases at this shop',
      'shop_milestone:' || shop_orders::text || ':' || ord.shop_id::text || ':' || ord.customer_id::text,
      ord.id, '{}'::jsonb
    );
  END IF;

  IF ord.promo_code_id IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      ord.customer_id, NULL, 10, 'Used a promotion',
      'promo_used:' || ord.id::text, ord.id, '{}'::jsonb
    );
  END IF;

  UPDATE public.orders SET loyalty_awarded_at = NOW() WHERE id = ord.id;
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM public.evaluate_customer_engagement(ord.customer_id);
  PERFORM public.evaluate_shop_achievements(ord.shop_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_order_loyalty(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  tx RECORD;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id;
  IF ord.id IS NULL OR ord.customer_id IS NULL THEN RETURN; END IF;
  IF ord.loyalty_reversed_at IS NOT NULL THEN RETURN; END IF;
  IF ord.loyalty_awarded_at IS NULL THEN
    -- Void unused promo even if points were never awarded.
    UPDATE public.promo_redemptions
    SET status = 'voided'
    WHERE order_id = ord.id AND status = 'applied';
    IF FOUND AND ord.promo_code_id IS NOT NULL THEN
      UPDATE public.promo_codes SET usage_count = GREATEST(0, usage_count - 1) WHERE id = ord.promo_code_id;
    END IF;
    RETURN;
  END IF;

  FOR tx IN
    SELECT t.*
    FROM public.loyalty_transactions t
    WHERE t.order_id = ord.id AND t.kind = 'earn' AND t.points > 0
  LOOP
    PERFORM public.award_loyalty_points(
      ord.customer_id,
      (SELECT w.shop_id FROM public.loyalty_wallets w WHERE w.id = tx.wallet_id),
      -tx.points,
      'Reversed: ' || COALESCE(tx.reason, 'order'),
      'order_reverse:' || tx.id::text,
      ord.id,
      '{}'::jsonb
    );
  END LOOP;

  UPDATE public.promo_redemptions SET status = 'voided' WHERE order_id = ord.id AND status = 'applied';
  IF FOUND AND ord.promo_code_id IS NOT NULL THEN
    UPDATE public.promo_codes SET usage_count = GREATEST(0, usage_count - 1) WHERE id = ord.promo_code_id;
  END IF;

  UPDATE public.orders SET loyalty_reversed_at = NOW() WHERE id = ord.id;
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM public.evaluate_customer_engagement(ord.customer_id);
  PERFORM public.evaluate_shop_achievements(ord.shop_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      PERFORM public.apply_order_loyalty(NEW.id);
    ELSIF NEW.status IN ('cancelled', 'refunded') AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.reverse_order_loyalty(NEW.id);
    ELSIF NEW.payment_status IN ('refunded') AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
      PERFORM public.reverse_order_loyalty(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_on_order_change ON public.orders;
CREATE TRIGGER trg_loyalty_on_order_change
AFTER UPDATE OF status, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.loyalty_on_order_change();

CREATE OR REPLACE FUNCTION public.shop_engagement_snapshot(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop public.shops%ROWTYPE;
  orders_n INTEGER := 0;
  reviews_n INTEGER := 0;
  rating NUMERIC := 0;
  products_n INTEGER := 0;
  promos_n INTEGER := 0;
  members INTEGER := 0;
  recent INTEGER := 0;
  first_month INTEGER := 0;
BEGIN
  SELECT * INTO shop FROM public.shops WHERE id = p_shop_id;
  IF shop.id IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT COUNT(*) INTO orders_n FROM public.orders o
  WHERE o.shop_id = p_shop_id AND o.status = 'completed'
    AND COALESCE(o.payment_status, 'paid') NOT IN ('failed', 'cancelled', 'refunded');
  SELECT COUNT(*), COALESCE(AVG(r.rating), 0) INTO reviews_n, rating
  FROM public.ratings r WHERE r.shop_id = p_shop_id AND COALESCE(r.is_hidden, FALSE) = FALSE;
  SELECT COUNT(*) INTO products_n FROM public.products p WHERE p.shop_id = p_shop_id AND p.is_available;
  SELECT COUNT(*) INTO promos_n FROM public.promotions pr WHERE pr.shop_id = p_shop_id AND pr.is_active;
  SELECT COUNT(*) INTO members FROM public.loyalty_wallets w WHERE w.shop_id = p_shop_id AND w.lifetime_points > 0;
  SELECT COUNT(*) INTO recent FROM public.orders o
  WHERE o.shop_id = p_shop_id AND o.status = 'completed' AND o.completed_at >= NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO first_month FROM public.orders o
  WHERE o.shop_id = p_shop_id AND o.status = 'completed' AND o.created_at < shop.created_at + INTERVAL '30 days';
  RETURN jsonb_build_object(
    'is_new_shop', TRUE,
    'is_verified', shop.verification_status = 'verified',
    'completed_orders', orders_n,
    'reviews_count', reviews_n,
    'avg_rating', rating,
    'products_listed', products_n,
    'active_promotions', promos_n,
    'loyalty_members', members,
    'recent_orders_30d', recent,
    'first_month_orders', first_month,
    'is_founding_shop', EXISTS (
      SELECT 1 FROM public.campaign_enrollments e
      JOIN public.campaigns c ON c.id = e.campaign_id
      WHERE e.shop_id = p_shop_id AND c.kind = 'founding_users'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_shop_achievements(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap JSONB;
  def public.customer_badge_definitions%ROWTYPE;
  newly JSONB := '[]'::jsonb;
  progress JSONB;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF NOT (
    public.is_platform_admin()
    OR public.user_owns_shop(p_shop_id)
    OR current_setting('lagecto.allow_loyalty_eval', true) = 'true'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  PERFORM public.ensure_shop_loyalty_program(p_shop_id);
  snap := public.shop_engagement_snapshot(p_shop_id);
  FOR def IN
    SELECT * FROM public.customer_badge_definitions
    WHERE audience = 'shop' AND is_active
    ORDER BY sort_order
  LOOP
    progress := public.requirement_progress(snap, def.requirements);
    INSERT INTO public.badge_progress (shop_id, badge_id, current_value, target_value, updated_at)
    VALUES (p_shop_id, def.id, COALESCE((progress->>'current')::numeric, 0), COALESCE((progress->>'target')::numeric, 1), NOW())
    ON CONFLICT (shop_id, badge_id)
    DO UPDATE SET current_value = EXCLUDED.current_value, target_value = EXCLUDED.target_value, updated_at = NOW();
    IF public.requirement_met(snap, def.requirements) THEN
      INSERT INTO public.shop_badges (shop_id, badge_id, source)
      VALUES (p_shop_id, def.id, 'engine')
      ON CONFLICT (shop_id, badge_id) DO NOTHING;
      IF FOUND THEN
        newly := newly || jsonb_build_array(jsonb_build_object('id', def.id, 'name', def.name, 'slug', def.slug));
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'newly_unlocked', newly);
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_public_badges(p_shop_id UUID, p_limit INTEGER DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO result
  FROM (
    SELECT d.slug, d.name, d.icon, d.rarity
    FROM public.shop_badges b
    JOIN public.customer_badge_definitions d ON d.id = b.badge_id
    WHERE b.shop_id = p_shop_id AND d.is_active AND d.is_visible
      AND d.slug IN ('verified_shop', 'customer_favourite', 'top_seller', 'founding_shop', 'trusted_shop', 'excellent_rating', 'marketplace_leader')
    ORDER BY
      CASE d.slug
        WHEN 'verified_shop' THEN 1
        WHEN 'founding_shop' THEN 2
        WHEN 'customer_favourite' THEN 3
        WHEN 'top_seller' THEN 4
        ELSE 5
      END
    LIMIT GREATEST(p_limit, 1)
  ) x;
  RETURN result;
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
  months INTEGER := 3;
  pkg TEXT := 'thabi';
  plan_rec public.subscription_plans%ROWTYPE;
  ends TIMESTAMPTZ;
BEGIN
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
  ORDER BY CASE WHEN duration_months = months THEN 0 ELSE 1 END, price
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
  PERFORM public.ensure_shop_loyalty_program(NEW.id);
  PERFORM public.try_enroll_founding_shop(NEW.id);
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM public.evaluate_shop_achievements(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shops_after_insert_loyalty ON public.shops;
CREATE TRIGGER trg_shops_after_insert_loyalty
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.shops_after_insert_loyalty();

CREATE OR REPLACE FUNCTION public.claim_reward(p_reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  reward public.rewards%ROWTYPE;
  snap JSONB;
  used INTEGER;
  claim_id UUID;
  code TEXT;
  promo_id UUID;
  program public.loyalty_programs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT * INTO reward FROM public.rewards WHERE id = p_reward_id FOR UPDATE;
  IF reward.id IS NULL OR reward.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This reward is not available.');
  END IF;
  IF reward.starts_at IS NOT NULL AND reward.starts_at > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This reward is not available yet.');
  END IF;
  IF reward.ends_at IS NOT NULL AND reward.ends_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This reward has expired.');
  END IF;
  SELECT * INTO program FROM public.loyalty_programs WHERE id = reward.program_id;
  IF program.scope = 'shop' AND reward.shop_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.valid_completed_orders(uid, reward.shop_id)
    ) AND COALESCE((reward.requirements->>'allow_without_purchase')::boolean, FALSE) IS NOT TRUE THEN
      -- still allow if requirements pass
      NULL;
    END IF;
  END IF;

  SELECT COUNT(*) INTO used FROM public.reward_claims WHERE reward_id = reward.id AND status IN ('claimed', 'used');
  IF reward.usage_limit IS NOT NULL AND used >= reward.usage_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This reward has been fully claimed.');
  END IF;
  SELECT COUNT(*) INTO used FROM public.reward_claims WHERE reward_id = reward.id AND user_id = uid AND status IN ('claimed', 'used');
  IF used >= COALESCE(reward.per_customer_limit, 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already claimed this reward.');
  END IF;

  snap := public.customer_engagement_snapshot(uid);
  IF reward.requirements IS NOT NULL AND reward.requirements <> '{}'::jsonb
     AND NOT public.requirement_met(snap, reward.requirements) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have not met this reward’s requirements yet.');
  END IF;

  INSERT INTO public.reward_claims (reward_id, user_id, shop_id, status, idempotency_key)
  VALUES (reward.id, uid, reward.shop_id, 'claimed', uid::text || ':' || reward.id::text)
  ON CONFLICT (reward_id, user_id, idempotency_key) DO NOTHING
  RETURNING id INTO claim_id;
  IF claim_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You have already claimed this reward.');
  END IF;

  IF reward.reward_type IN ('percent_discount', 'fixed_discount', 'free_delivery', 'promo_code') THEN
    code := 'LG' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    INSERT INTO public.promo_codes (
      code, name, description, owner_scope, shop_id, created_by, discount_type,
      percent_off, amount_off, max_discount, min_order_amount, starts_at, ends_at,
      total_usage_limit, per_customer_limit, eligible_customer_ids, loyalty_only, is_active, source_reward_id
    ) VALUES (
      code,
      reward.name,
      reward.description,
      CASE WHEN reward.shop_id IS NULL THEN 'platform' ELSE 'shop' END,
      reward.shop_id,
      uid,
      CASE reward.reward_type
        WHEN 'percent_discount' THEN 'percent'
        WHEN 'fixed_discount' THEN 'fixed'
        WHEN 'free_delivery' THEN 'free_delivery'
        ELSE 'percent'
      END,
      CASE WHEN reward.reward_type = 'percent_discount' THEN reward.value ELSE NULL END,
      CASE WHEN reward.reward_type = 'fixed_discount' THEN reward.value ELSE NULL END,
      NULL, 0, NOW(), COALESCE(reward.ends_at, NOW() + INTERVAL '30 days'),
      1, 1, ARRAY[uid], TRUE, TRUE, reward.id
    )
    RETURNING id INTO promo_id;
    UPDATE public.reward_claims SET promo_code_id = promo_id WHERE id = claim_id;
  END IF;

  PERFORM public.notify_loyalty(uid, 'Your reward is ready.', reward.name || ' is waiting in My Rewards.', 'loyalty', '/customer/rewards', reward.id);
  RETURN jsonb_build_object('ok', true, 'claim_id', claim_id, 'promo_code', code);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_badge(
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT
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
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A reason is required to grant a badge.');
  END IF;
  INSERT INTO public.customer_badges (user_id, badge_id, source, granted_by, grant_reason)
  VALUES (p_user_id, p_badge_id, 'admin', auth.uid(), left(p_reason, 400))
  ON CONFLICT (user_id, badge_id) DO NOTHING;
  PERFORM public.loyalty_audit('grant_badge', 'customer_badge', p_badge_id, NULL,
    jsonb_build_object('user_id', p_user_id, 'reason', p_reason));
  PERFORM public.log_security_event(
    'admin_grant_badge', auth.uid(), p_user_id, NULL, p_reason, NULL, NULL, 'success',
    jsonb_build_object('badge_id', p_badge_id)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_analytics_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'members', (SELECT COUNT(*) FROM public.loyalty_wallets WHERE scope = 'platform' AND lifetime_points > 0),
    'rewards_claimed', (SELECT COUNT(*) FROM public.reward_claims WHERE status IN ('claimed', 'used')),
    'rewards_used', (SELECT COUNT(*) FROM public.reward_claims WHERE status = 'used'),
    'promo_redemptions', (SELECT COUNT(*) FROM public.promo_redemptions WHERE status = 'applied'),
    'badge_unlocks', (SELECT COUNT(*) FROM public.customer_badges),
    'active_campaigns', (SELECT COUNT(*) FROM public.campaigns WHERE is_active),
    'founding_users', (
      SELECT COUNT(*) FROM public.campaign_enrollments e
      JOIN public.campaigns c ON c.id = e.campaign_id
      WHERE c.kind = 'founding_users'
    ),
    'founding_shops', (
      SELECT COUNT(DISTINCT e.shop_id) FROM public.campaign_enrollments e
      JOIN public.campaigns c ON c.id = e.campaign_id
      WHERE c.kind = 'founding_users'
    ),
    'popular_badges', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT d.name, d.slug, COUNT(*)::int AS unlocks
        FROM public.customer_badges b
        JOIN public.customer_badge_definitions d ON d.id = b.badge_id
        GROUP BY d.name, d.slug
        ORDER BY COUNT(*) DESC
        LIMIT 8
      ) x
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_analytics_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'loyal_customers', (SELECT COUNT(*) FROM public.loyalty_wallets WHERE shop_id = p_shop_id AND lifetime_points > 0),
    'returning_customers', (
      SELECT COUNT(*) FROM (
        SELECT customer_id FROM public.orders
        WHERE shop_id = p_shop_id AND status = 'completed' AND customer_id IS NOT NULL
        GROUP BY customer_id HAVING COUNT(*) >= 2
      ) r
    ),
    'rewards_issued', (SELECT COUNT(*) FROM public.reward_claims WHERE shop_id = p_shop_id),
    'rewards_redeemed', (SELECT COUNT(*) FROM public.reward_claims WHERE shop_id = p_shop_id AND status = 'used'),
    'active_promos', (
      SELECT COUNT(*) FROM public.promo_codes
      WHERE shop_id = p_shop_id AND is_active
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
    ),
    'top_customers', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT w.user_id, w.points, w.lifetime_points, left(COALESCE(u.name, 'Customer'), 24) AS display_name
        FROM public.loyalty_wallets w
        JOIN public.users u ON u.id = w.user_id
        WHERE w.shop_id = p_shop_id
        ORDER BY w.lifetime_points DESC
        LIMIT 8
      ) x
    )
  );
END;
$$;

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
        'description', c.description,
        'starts_at', c.starts_at,
        'ends_at', c.ends_at,
        'benefit', c.benefit,
        'remaining', CASE WHEN c.max_enrollments IS NULL THEN NULL ELSE GREATEST(c.max_enrollments - c.enrollment_count, 0) END
      )
      FROM public.campaigns c
      WHERE c.kind = 'founding_users' AND c.is_active
        AND (c.starts_at IS NULL OR c.starts_at <= NOW())
        AND (c.ends_at IS NULL OR c.ends_at >= NOW())
      ORDER BY c.created_at
      LIMIT 1
    ),
    jsonb_build_object('ok', false)
  );
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

GRANT EXECUTE ON FUNCTION public.apply_order_loyalty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_order_loyalty(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_shop_achievements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_public_badges(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_enroll_founding_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reward(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_badge(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_analytics_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_analytics_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.active_founding_campaign() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_founding_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_engagement_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_engagement_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.loyalty_on_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public.award_loyalty_points(
    NEW.user_id, NULL, 15, 'Left a review', 'review:platform:' || NEW.id::text, NULL, '{}'::jsonb
  );
  IF NEW.shop_id IS NOT NULL THEN
    PERFORM public.award_loyalty_points(
      NEW.user_id, NEW.shop_id, 15, 'Reviewed this shop', 'review:shop:' || NEW.id::text, NULL, '{}'::jsonb
    );
  END IF;
  PERFORM set_config('lagecto.allow_loyalty_eval', 'true', true);
  PERFORM public.evaluate_customer_engagement(NEW.user_id);
  IF NEW.shop_id IS NOT NULL THEN
    PERFORM public.evaluate_shop_achievements(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_on_rating ON public.ratings;
CREATE TRIGGER trg_loyalty_on_rating
AFTER INSERT ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.loyalty_on_rating();

CREATE OR REPLACE FUNCTION public.loyalty_on_saved_shop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_loyalty_points(
    NEW.user_id, NULL, 5, 'Saved a shop', 'saved_shop:' || NEW.shop_id::text, NULL, '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_on_saved_shop ON public.saved_shops;
CREATE TRIGGER trg_loyalty_on_saved_shop
AFTER INSERT ON public.saved_shops
FOR EACH ROW EXECUTE FUNCTION public.loyalty_on_saved_shop();
