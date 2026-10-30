-- Seed platform loyalty, 100 customer badges, shop badges, news, founding campaign.
-- The SQL editor / migrations run as postgres, so the platform-loyalty trigger
-- must allow that role or this file fails with P0001.

CREATE OR REPLACE FUNCTION public.protect_platform_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'loyalty_programs' AND NEW.scope = 'platform' THEN
    RAISE EXCEPTION 'Only LaGecto admins can change platform loyalty';
  END IF;
  IF TG_TABLE_NAME = 'rewards' AND NEW.shop_id IS NULL THEN
    RAISE EXCEPTION 'Only LaGecto admins can change platform rewards';
  END IF;
  IF TG_TABLE_NAME = 'promo_codes' AND NEW.owner_scope = 'platform' THEN
    RAISE EXCEPTION 'Only LaGecto admins can change platform promo codes';
  END IF;
  IF TG_TABLE_NAME = 'customer_badge_definitions' THEN
    RAISE EXCEPTION 'Only LaGecto admins can change badge definitions';
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.loyalty_programs (scope, name, description, is_active)
SELECT 'platform', 'LaGecto Loyalty', 'Earn rewards from shopping across the LaGecto marketplace.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_programs WHERE scope = 'platform');

INSERT INTO public.loyalty_levels (program_id, slug, name, description, icon, rank, min_points, discount_percent, benefits)
SELECT p.id, v.slug, v.name, v.description, v.icon, v.rank, v.min_points, v.discount_percent, v.benefits::jsonb
FROM public.loyalty_programs p
CROSS JOIN (VALUES
  ('newcomer', 'Newcomer', 'Welcome to LaGecto Loyalty.', 'sparkles', 1, 0, 0, '["Track your journey"]'),
  ('explorer', 'Explorer', 'You are starting to discover the marketplace.', 'compass', 2, 80, 0, '["Explorer offers"]'),
  ('regular', 'Regular', 'You come back to LaGecto.', 'repeat', 3, 200, 2, '["2% loyalty pricing eligibility"]'),
  ('loyal', 'Loyal', 'You shop with us consistently.', 'heart', 4, 450, 5, '["5% loyalty pricing eligibility"]'),
  ('vip', 'VIP', 'A recognised LaGecto regular.', 'star', 5, 900, 8, '["VIP promotions"]'),
  ('elite', 'LaGecto Elite', 'The highest configurable platform level.', 'crown', 6, 1800, 12, '["Elite-only promotions"]')
) AS v(slug, name, description, icon, rank, min_points, discount_percent, benefits)
WHERE p.scope = 'platform'
ON CONFLICT (program_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  min_points = EXCLUDED.min_points,
  discount_percent = EXCLUDED.discount_percent,
  benefits = EXCLUDED.benefits,
  is_active = TRUE;

INSERT INTO public.news_categories (slug, name, sort_order) VALUES
  ('platform', 'Platform', 1),
  ('business', 'For businesses', 2),
  ('customers', 'For customers', 3),
  ('loyalty', 'Loyalty', 4),
  ('promotions', 'Promotions', 5)
ON CONFLICT (slug) DO NOTHING;

-- Helper: upsert a badge definition.
CREATE OR REPLACE FUNCTION public._seed_badge(
  p_slug TEXT, p_name TEXT, p_description TEXT, p_audience TEXT, p_category TEXT,
  p_rarity TEXT, p_icon TEXT, p_metric TEXT, p_gte NUMERIC, p_sort INTEGER, p_bool BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  req JSONB;
BEGIN
  IF p_bool THEN
    req := jsonb_build_object('all', jsonb_build_array(jsonb_build_object('metric', p_metric, 'eq', true)));
  ELSE
    req := jsonb_build_object('all', jsonb_build_array(jsonb_build_object('metric', p_metric, 'gte', p_gte)));
  END IF;
  INSERT INTO public.customer_badge_definitions (
    slug, name, description, audience, category, rarity, icon, requirements, threshold, sort_order, is_active, is_visible
  ) VALUES (
    p_slug, p_name, p_description, p_audience, p_category, p_rarity, p_icon, req, COALESCE(p_gte, 1)::int, p_sort, TRUE, TRUE
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    audience = EXCLUDED.audience,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    icon = EXCLUDED.icon,
    requirements = EXCLUDED.requirements,
    threshold = EXCLUDED.threshold,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    is_visible = TRUE,
    updated_at = NOW();
END;
$$;

DO $$
BEGIN
  -- Getting started (10)
  PERFORM public._seed_badge('welcome_lagecto', 'Welcome to LaGecto', 'Open LaGecto and start your journey.', 'customer', 'getting_started', 'common', 'sparkles', 'visit_days', 1, 1);
  PERFORM public._seed_badge('profile_complete', 'Profile Complete', 'Add your name, phone, address and username.', 'customer', 'getting_started', 'common', 'user', 'profile_complete', 1, 2, TRUE);
  PERFORM public._seed_badge('first_login', 'First Login', 'Visit LaGecto while signed in.', 'customer', 'getting_started', 'common', 'log-in', 'visit_days', 1, 3);
  PERFORM public._seed_badge('first_shop_viewed', 'First Shop Viewed', 'Open a shop storefront.', 'customer', 'getting_started', 'common', 'store', 'shop_views', 1, 4);
  PERFORM public._seed_badge('first_product_viewed', 'First Product Viewed', 'View a product or service.', 'customer', 'getting_started', 'common', 'package', 'product_views', 1, 5);
  PERFORM public._seed_badge('first_search', 'First Search', 'Search the marketplace.', 'customer', 'getting_started', 'common', 'search', 'searches', 1, 6);
  PERFORM public._seed_badge('first_wishlist', 'First Wishlist', 'Save a shop you want to return to.', 'customer', 'getting_started', 'common', 'bookmark', 'saved_shops', 1, 7);
  PERFORM public._seed_badge('first_cart', 'First Cart', 'Add an item to your cart.', 'customer', 'getting_started', 'common', 'shopping-cart', 'cart_adds', 1, 8);
  PERFORM public._seed_badge('first_order', 'First Order', 'Complete your first valid LaGecto order.', 'customer', 'getting_started', 'uncommon', 'receipt', 'completed_orders', 1, 9);
  PERFORM public._seed_badge('getting_started_review', 'First Review', 'Leave your first shop review.', 'customer', 'getting_started', 'common', 'star', 'reviews_count', 1, 10);

  -- Shopping (10)
  PERFORM public._seed_badge('first_purchase', 'First Purchase', 'Complete a paid or confirmed order.', 'customer', 'shopping', 'uncommon', 'shopping-bag', 'completed_order_value', 0.01, 11);
  PERFORM public._seed_badge('returning_shopper', 'Returning Shopper', 'Complete 2 valid orders.', 'customer', 'shopping', 'common', 'repeat', 'completed_orders', 2, 12);
  PERFORM public._seed_badge('regular', 'Regular Shopper', 'Complete 3 valid orders.', 'customer', 'shopping', 'common', 'calendar', 'completed_orders', 3, 13);
  PERFORM public._seed_badge('orders_5', '5 Orders', 'Complete 5 valid orders.', 'customer', 'shopping', 'uncommon', 'layers', 'completed_orders', 5, 14);
  PERFORM public._seed_badge('orders_10', '10 Orders', 'Complete 10 valid orders.', 'customer', 'shopping', 'uncommon', 'layers', 'completed_orders', 10, 15);
  PERFORM public._seed_badge('orders_25', '25 Orders', 'Complete 25 valid orders.', 'customer', 'shopping', 'rare', 'layers', 'completed_orders', 25, 16);
  PERFORM public._seed_badge('orders_50', '50 Orders', 'Complete 50 valid orders.', 'customer', 'shopping', 'epic', 'layers', 'completed_orders', 50, 17);
  PERFORM public._seed_badge('orders_100', '100 Orders', 'Complete 100 valid orders.', 'customer', 'shopping', 'legendary', 'layers', 'completed_orders', 100, 18);
  PERFORM public._seed_badge('multi_shop_shopper', 'Multi-Shop Shopper', 'Buy from 2 different shops.', 'customer', 'shopping', 'uncommon', 'store', 'distinct_shops_purchased', 2, 19);
  PERFORM public._seed_badge('shop_explorer', 'Shop Explorer', 'Buy from 5 different shops.', 'customer', 'shopping', 'rare', 'compass', 'distinct_shops_purchased', 5, 20);

  -- Reviews (10)
  PERFORM public._seed_badge('review_writer', 'Review Writer', 'Write a review with comments.', 'customer', 'reviews', 'common', 'pen', 'reviews_with_text', 1, 21);
  PERFORM public._seed_badge('reviews_5', '5 Reviews', 'Leave 5 reviews.', 'customer', 'reviews', 'uncommon', 'star', 'reviews_count', 5, 22);
  PERFORM public._seed_badge('reviews_10', '10 Reviews', 'Leave 10 reviews.', 'customer', 'reviews', 'uncommon', 'star', 'reviews_count', 10, 23);
  PERFORM public._seed_badge('reviews_25', '25 Reviews', 'Leave 25 reviews.', 'customer', 'reviews', 'rare', 'star', 'reviews_count', 25, 24);
  PERFORM public._seed_badge('helpful_reviewer', 'Helpful Reviewer', 'Write 3 detailed reviews.', 'customer', 'reviews', 'uncommon', 'message-circle', 'reviews_with_text', 3, 25);
  PERFORM public._seed_badge('review_explorer', 'Review Explorer', 'Review 3 different shops.', 'customer', 'reviews', 'uncommon', 'map', 'distinct_shops_reviewed', 3, 26);
  PERFORM public._seed_badge('feedback_champion', 'Feedback Champion', 'Leave 15 reviews.', 'customer', 'reviews', 'rare', 'megaphone', 'reviews_count', 15, 27);
  PERFORM public._seed_badge('community_voice', 'Community Voice', 'Leave 20 reviews.', 'customer', 'reviews', 'rare', 'users', 'reviews_count', 20, 28);
  PERFORM public._seed_badge('trusted_reviewer', 'Trusted Reviewer', 'Write 5 detailed reviews.', 'customer', 'reviews', 'rare', 'shield', 'reviews_with_text', 5, 29);
  PERFORM public._seed_badge('review_master', 'Review Master', 'Complete 25 reviews.', 'customer', 'reviews', 'epic', 'award', 'reviews_count', 25, 30);

  -- Discovery (10)
  PERFORM public._seed_badge('product_explorer', 'Product Explorer', 'View 10 products or services.', 'customer', 'discovery', 'common', 'scan', 'product_views', 10, 31);
  PERFORM public._seed_badge('explorer', 'Marketplace Explorer', 'View 10 shops.', 'customer', 'discovery', 'uncommon', 'globe', 'shop_views', 10, 32);
  PERFORM public._seed_badge('trend_finder', 'Trend Finder', 'Open a live promotion.', 'customer', 'discovery', 'common', 'flame', 'promotion_clicks', 1, 33);
  PERFORM public._seed_badge('new_shop_supporter', 'New Shop Supporter', 'Buy from a shop in its first 30 days.', 'customer', 'discovery', 'rare', 'sprout', 'new_shop_purchases', 1, 34);
  PERFORM public._seed_badge('local_discovery', 'Local Discovery', 'View 5 different shops.', 'customer', 'discovery', 'common', 'map-pin', 'distinct_shops_viewed', 5, 35);
  PERFORM public._seed_badge('category_explorer', 'Category Explorer', 'Browse 3 shop categories.', 'customer', 'discovery', 'uncommon', 'layout-grid', 'distinct_categories_viewed', 3, 36);
  PERFORM public._seed_badge('hidden_gem_finder', 'Hidden Gem Finder', 'Support a shop with fewer than 10 reviews.', 'customer', 'discovery', 'rare', 'gem', 'hidden_gem_purchases', 1, 37);
  PERFORM public._seed_badge('shop_collector', 'Shop Collector', 'Save 5 shops.', 'customer', 'discovery', 'uncommon', 'library', 'saved_shops', 5, 38);
  PERFORM public._seed_badge('marketplace_regular', 'Marketplace Regular', 'View shops 20 times.', 'customer', 'discovery', 'rare', 'building', 'shop_views', 20, 39);
  PERFORM public._seed_badge('browse_curious', 'Curious Browser', 'View 5 products.', 'customer', 'discovery', 'common', 'eye', 'product_views', 5, 40);

  -- Loyalty (10)
  PERFORM public._seed_badge('loyal_customer', 'Loyal Customer', 'Reach Regular level.', 'customer', 'loyalty', 'uncommon', 'heart', 'platform_level_rank', 3, 41);
  PERFORM public._seed_badge('super_loyal', 'Super Loyal', 'Reach Loyal level.', 'customer', 'loyalty', 'rare', 'heart', 'platform_level_rank', 4, 42);
  PERFORM public._seed_badge('vip_customer', 'VIP Customer', 'Reach VIP level.', 'customer', 'loyalty', 'epic', 'star', 'platform_level_rank', 5, 43);
  PERFORM public._seed_badge('elite_customer', 'Elite Customer', 'Reach LaGecto Elite.', 'customer', 'loyalty', 'legendary', 'crown', 'platform_level_rank', 6, 44);
  PERFORM public._seed_badge('loyalty_level_up', 'Loyalty Level Up', 'Move beyond Newcomer.', 'customer', 'loyalty', 'common', 'trending-up', 'platform_level_rank', 2, 45);
  PERFORM public._seed_badge('reward_hunter', 'Reward Hunter', 'Claim a loyalty reward.', 'customer', 'loyalty', 'uncommon', 'gift', 'rewards_claimed', 1, 46);
  PERFORM public._seed_badge('reward_collector', 'Reward Collector', 'Claim 5 rewards.', 'customer', 'loyalty', 'rare', 'gift', 'rewards_claimed', 5, 47);
  PERFORM public._seed_badge('promotion_hunter', 'Promotion Hunter', 'Redeem 3 promo codes.', 'customer', 'loyalty', 'uncommon', 'ticket', 'promo_redemptions', 3, 48);
  PERFORM public._seed_badge('deal_finder', 'Deal Finder', 'Redeem a promo code.', 'customer', 'loyalty', 'common', 'percent', 'promo_redemptions', 1, 49);
  PERFORM public._seed_badge('savings_master', 'Savings Master', 'Save $20 with promo codes.', 'customer', 'loyalty', 'epic', 'piggy-bank', 'promo_savings', 20, 50);

  -- Challenges (8)
  PERFORM public._seed_badge('challenge_starter', 'Challenge Starter', 'Start a loyalty challenge.', 'customer', 'challenges', 'common', 'flag', 'challenges_started', 1, 51);
  PERFORM public._seed_badge('challenge_finisher', 'Challenge Finisher', 'Complete a challenge.', 'customer', 'challenges', 'uncommon', 'check', 'challenges_completed', 1, 52);
  PERFORM public._seed_badge('challenges_3', '3 Challenges', 'Complete 3 challenges.', 'customer', 'challenges', 'uncommon', 'list-checks', 'challenges_completed', 3, 53);
  PERFORM public._seed_badge('challenges_5', '5 Challenges', 'Complete 5 challenges.', 'customer', 'challenges', 'rare', 'list-checks', 'challenges_completed', 5, 54);
  PERFORM public._seed_badge('challenges_10', '10 Challenges', 'Complete 10 challenges.', 'customer', 'challenges', 'epic', 'list-checks', 'challenges_completed', 10, 55);
  PERFORM public._seed_badge('challenge_champion', 'Challenge Champion', 'Complete 10 challenges.', 'customer', 'challenges', 'legendary', 'trophy', 'challenges_completed', 10, 56);
  PERFORM public._seed_badge('challenge_explorer', 'Challenge Explorer', 'Start 3 challenges.', 'customer', 'challenges', 'uncommon', 'map', 'challenges_started', 3, 57);
  PERFORM public._seed_badge('challenge_collector', 'Challenge Collector', 'Complete 5 challenges.', 'customer', 'challenges', 'rare', 'folder', 'challenges_completed', 5, 58);

  -- Consistency (8)
  PERFORM public._seed_badge('streak_starter', 'Streak Starter', 'Visit LaGecto 2 days in a row.', 'customer', 'consistency', 'common', 'flame', 'current_streak', 2, 59);
  PERFORM public._seed_badge('streak_builder', 'Streak Builder', 'Keep a 5-day visit streak.', 'customer', 'consistency', 'uncommon', 'flame', 'current_streak', 5, 60);
  PERFORM public._seed_badge('streak_master', 'Streak Master', 'Keep a 14-day visit streak.', 'customer', 'consistency', 'rare', 'flame', 'current_streak', 14, 61);
  PERFORM public._seed_badge('streak_7', 'Week Streak', 'Visit 7 days in a row.', 'customer', 'consistency', 'uncommon', 'calendar', 'current_streak', 7, 62);
  PERFORM public._seed_badge('streak_30', 'Monthly Streak', 'Visit 30 days in a row.', 'customer', 'consistency', 'legendary', 'calendar', 'current_streak', 30, 63);
  PERFORM public._seed_badge('weekend_shopper', 'Weekend Shopper', 'Complete an order on Saturday or Sunday.', 'customer', 'consistency', 'common', 'sun', 'weekend_orders', 1, 64);
  PERFORM public._seed_badge('monthly_regular', 'Monthly Regular', 'Complete orders in 2 different months.', 'customer', 'consistency', 'uncommon', 'calendar-days', 'distinct_order_months', 2, 65);
  PERFORM public._seed_badge('always_back', 'Always Back', 'Complete orders on 5 different days.', 'customer', 'consistency', 'rare', 'refresh-cw', 'distinct_order_days', 5, 66);

  -- Supporting businesses (8)
  PERFORM public._seed_badge('business_supporter', 'Business Supporter', 'Complete an order with a LaGecto shop.', 'customer', 'supporting', 'common', 'handshake', 'completed_orders', 1, 67);
  PERFORM public._seed_badge('small_business_supporter', 'Small Business Supporter', 'Buy from 3 shops.', 'customer', 'supporting', 'uncommon', 'store', 'distinct_shops_purchased', 3, 68);
  PERFORM public._seed_badge('founding_shop_supporter', 'Founding Shop Supporter', 'Buy from a founding shop.', 'customer', 'supporting', 'rare', 'flag', 'founding_shop_purchases', 1, 69);
  PERFORM public._seed_badge('local_champion', 'Local Champion', 'Buy from 5 shops.', 'customer', 'supporting', 'rare', 'map-pin', 'distinct_shops_purchased', 5, 70);
  PERFORM public._seed_badge('shop_fan', 'Shop Fan', 'Complete 3 orders at the same shop.', 'customer', 'supporting', 'uncommon', 'heart', 'max_orders_single_shop', 3, 71);
  PERFORM public._seed_badge('shop_regular_customer', 'Shop Regular', 'Complete 5 orders at the same shop.', 'customer', 'supporting', 'rare', 'repeat', 'max_orders_single_shop', 5, 72);
  PERFORM public._seed_badge('business_champion', 'Business Champion', 'Complete 20 valid orders.', 'customer', 'supporting', 'epic', 'award', 'completed_orders', 20, 73);
  PERFORM public._seed_badge('marketplace_supporter', 'Marketplace Supporter', 'Buy from 4 shops.', 'customer', 'supporting', 'rare', 'globe', 'distinct_shops_purchased', 4, 74);

  -- Promotions (8)
  PERFORM public._seed_badge('first_promo', 'First Promo', 'Use a promo code on a valid order.', 'customer', 'promotions', 'common', 'ticket', 'promo_redemptions', 1, 75);
  PERFORM public._seed_badge('promo_user', 'Promo User', 'Use 2 promo codes.', 'customer', 'promotions', 'common', 'ticket', 'promo_redemptions', 2, 76);
  PERFORM public._seed_badge('promo_code_hunter', 'Promo Hunter', 'Use 5 promo codes.', 'customer', 'promotions', 'rare', 'ticket', 'promo_redemptions', 5, 77);
  PERFORM public._seed_badge('savings_starter', 'Savings Starter', 'Save $5 with promo codes.', 'customer', 'promotions', 'common', 'badge-percent', 'promo_savings', 5, 78);
  PERFORM public._seed_badge('savings_builder', 'Savings Builder', 'Save $10 with promo codes.', 'customer', 'promotions', 'uncommon', 'badge-percent', 'promo_savings', 10, 79);
  PERFORM public._seed_badge('promotion_pro', 'Promotion Pro', 'Use 3 promo codes.', 'customer', 'promotions', 'uncommon', 'sparkles', 'promo_redemptions', 3, 80);
  PERFORM public._seed_badge('smart_shopper', 'Smart Shopper', 'Use a loyalty-only promo.', 'customer', 'promotions', 'rare', 'brain', 'loyalty_only_redemptions', 1, 81);
  PERFORM public._seed_badge('savings_champion', 'Savings Champion', 'Save $50 with promo codes.', 'customer', 'promotions', 'legendary', 'trophy', 'promo_savings', 50, 82);

  -- Advanced (8)
  PERFORM public._seed_badge('lagecto_regular', 'LaGecto Regular', 'Visit LaGecto on 5 different days.', 'customer', 'advanced', 'uncommon', 'calendar', 'visit_days', 5, 83);
  PERFORM public._seed_badge('lagecto_explorer', 'LaGecto Explorer', 'View 10 shops and complete an order.', 'customer', 'advanced', 'uncommon', 'compass', 'shop_views', 10, 84);
  PERFORM public._seed_badge('lagecto_insider', 'LaGecto Insider', 'Complete your profile.', 'customer', 'advanced', 'rare', 'key', 'profile_complete', 1, 85, TRUE);
  PERFORM public._seed_badge('lagecto_champion', 'LaGecto Champion', 'Complete 25 orders.', 'customer', 'advanced', 'epic', 'trophy', 'completed_orders', 25, 86);
  PERFORM public._seed_badge('lagecto_veteran', 'LaGecto Veteran', 'Keep an account for 30 days.', 'customer', 'advanced', 'rare', 'shield', 'account_age_days', 30, 87);
  PERFORM public._seed_badge('lagecto_expert', 'LaGecto Expert', 'Complete 50 orders.', 'customer', 'advanced', 'epic', 'graduation-cap', 'completed_orders', 50, 88);
  PERFORM public._seed_badge('lagecto_master', 'LaGecto Master', 'Leave 10 reviews.', 'customer', 'advanced', 'epic', 'gem', 'reviews_count', 10, 89);
  PERFORM public._seed_badge('lagecto_legend', 'LaGecto Legend', 'Buy from 5 shops after 50 orders.', 'customer', 'advanced', 'legendary', 'crown', 'distinct_shops_purchased', 5, 90);

  -- Special (10)
  PERFORM public._seed_badge('founding_user', 'Founding User', 'List a shop during the Founding Users campaign.', 'customer', 'special', 'legendary', 'flag', 'is_founding_user', 1, 91, TRUE);
  PERFORM public._seed_badge('founding_supporter', 'Founding Supporter', 'Shop with a founding business.', 'customer', 'special', 'epic', 'handshake', 'founding_shop_purchases', 1, 92);
  PERFORM public._seed_badge('early_adopter', 'Early Adopter', 'Join LaGecto during the founding campaign window.', 'customer', 'special', 'rare', 'rocket', 'is_early_adopter', 1, 93, TRUE);
  PERFORM public._seed_badge('community_builder', 'Community Builder', 'Leave 10 reviews.', 'customer', 'special', 'rare', 'users', 'reviews_count', 10, 94);
  PERFORM public._seed_badge('marketplace_pioneer', 'Marketplace Pioneer', 'Be among the first 100 customer accounts.', 'customer', 'special', 'epic', 'sunrise', 'is_marketplace_pioneer', 1, 95, TRUE);
  PERFORM public._seed_badge('lagecto_ambassador', 'LaGecto Ambassador', 'Save 10 shops.', 'customer', 'special', 'epic', 'share-2', 'saved_shops', 10, 96);
  PERFORM public._seed_badge('super_supporter', 'Super Supporter', 'Complete 15 valid orders.', 'customer', 'special', 'rare', 'heart', 'completed_orders', 15, 97);
  PERFORM public._seed_badge('legacy_member', 'Legacy Member', 'Keep an account for 90 days.', 'customer', 'special', 'epic', 'hourglass', 'account_age_days', 90, 98);
  PERFORM public._seed_badge('lagecto_100', 'LaGecto 100', 'Unlock 99 other badges.', 'customer', 'special', 'legendary', 'medal', 'badges_unlocked', 99, 99);
  PERFORM public._seed_badge('ultimate_lagecto_champion', 'Ultimate LaGecto Champion', 'Unlock every customer badge.', 'customer', 'special', 'legendary', 'crown', 'badges_unlocked', 100, 100);

  -- Shop badges
  PERFORM public._seed_badge('new_shop', 'New Shop', 'The shop is live on LaGecto.', 'shop', 'shop', 'common', 'store', 'is_new_shop', 1, 1, TRUE);
  PERFORM public._seed_badge('verified_shop', 'Verified Shop', 'The shop holds a current paid or campaign listing.', 'shop', 'shop', 'uncommon', 'badge-check', 'is_verified', 1, 2, TRUE);
  PERFORM public._seed_badge('growing_shop', 'Growing Shop', 'Complete 10 customer orders.', 'shop', 'shop', 'uncommon', 'trending-up', 'completed_orders', 10, 3);
  PERFORM public._seed_badge('popular_shop', 'Popular Shop', 'Complete 50 customer orders.', 'shop', 'shop', 'rare', 'flame', 'completed_orders', 50, 4);
  PERFORM public._seed_badge('customer_favourite', 'Customer Favourite', 'Reach 4.5 rating with 10 reviews.', 'shop', 'shop', 'epic', 'heart', 'avg_rating', 4.5, 5);
  PERFORM public._seed_badge('top_seller', 'Top Seller', 'Complete 100 customer orders.', 'shop', 'shop', 'epic', 'trophy', 'completed_orders', 100, 6);
  PERFORM public._seed_badge('fast_growing', 'Fast Growing', 'Complete 10 orders in the first 30 days.', 'shop', 'shop', 'rare', 'zap', 'first_month_orders', 10, 7);
  PERFORM public._seed_badge('review_champion_shop', 'Review Champion', 'Collect 25 reviews.', 'shop', 'shop', 'rare', 'star', 'reviews_count', 25, 8);
  PERFORM public._seed_badge('trusted_shop', 'Trusted Shop', 'Reach 4.0 rating with 5 reviews.', 'shop', 'shop', 'uncommon', 'shield', 'avg_rating', 4.0, 9);
  PERFORM public._seed_badge('marketplace_leader', 'Marketplace Leader', 'Complete 500 orders.', 'shop', 'shop', 'legendary', 'crown', 'completed_orders', 500, 10);
  PERFORM public._seed_badge('promotion_pro_shop', 'Promotion Pro', 'Run 3 active promotions.', 'shop', 'shop', 'uncommon', 'megaphone', 'active_promotions', 3, 11);
  PERFORM public._seed_badge('customer_loyalty_champion', 'Customer Loyalty Champion', 'Have 10 shop loyalty members.', 'shop', 'shop', 'rare', 'heart', 'loyalty_members', 10, 12);
  PERFORM public._seed_badge('inventory_master', 'Inventory Master', 'List 20 products or services.', 'shop', 'shop', 'uncommon', 'boxes', 'products_listed', 20, 13);
  PERFORM public._seed_badge('active_shop', 'Active Shop', 'Complete 5 orders in 30 days.', 'shop', 'shop', 'common', 'activity', 'recent_orders_30d', 5, 14);
  PERFORM public._seed_badge('community_shop', 'Community Shop', 'Collect 10 reviews.', 'shop', 'shop', 'uncommon', 'users', 'reviews_count', 10, 15);
  PERFORM public._seed_badge('shop_orders_100', '100 Orders', 'Complete 100 orders.', 'shop', 'shop', 'rare', 'hash', 'completed_orders', 100, 16);
  PERFORM public._seed_badge('shop_orders_500', '500 Orders', 'Complete 500 orders.', 'shop', 'shop', 'epic', 'hash', 'completed_orders', 500, 17);
  PERFORM public._seed_badge('shop_orders_1000', '1,000 Orders', 'Complete 1,000 orders.', 'shop', 'shop', 'legendary', 'hash', 'completed_orders', 1000, 18);
  PERFORM public._seed_badge('shop_reviews_100', '100 Reviews', 'Collect 100 reviews.', 'shop', 'shop', 'epic', 'message-circle', 'reviews_count', 100, 19);
  PERFORM public._seed_badge('excellent_rating', 'Excellent Rating', 'Reach 4.8 rating with 20 reviews.', 'shop', 'shop', 'legendary', 'star', 'avg_rating', 4.8, 20);
  PERFORM public._seed_badge('founding_shop', 'Founding Shop', 'Enrolled in the Founding Users campaign.', 'shop', 'shop', 'legendary', 'flag', 'is_founding_shop', 1, 21, TRUE);
END $$;

-- Extra AND conditions for a few badges that need two metrics are stored as a second rule.
UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'avg_rating', 'gte', 4.5),
  jsonb_build_object('metric', 'reviews_count', 'gte', 10)
))
WHERE slug = 'customer_favourite';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'avg_rating', 'gte', 4.0),
  jsonb_build_object('metric', 'reviews_count', 'gte', 5)
))
WHERE slug = 'trusted_shop';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'avg_rating', 'gte', 4.8),
  jsonb_build_object('metric', 'reviews_count', 'gte', 20)
))
WHERE slug = 'excellent_rating';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'shop_views', 'gte', 10),
  jsonb_build_object('metric', 'completed_orders', 'gte', 1)
))
WHERE slug = 'lagecto_explorer';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'profile_complete', 'eq', true),
  jsonb_build_object('metric', 'completed_orders', 'gte', 1),
  jsonb_build_object('metric', 'reviews_count', 'gte', 1)
))
WHERE slug = 'lagecto_insider';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'account_age_days', 'gte', 30),
  jsonb_build_object('metric', 'completed_orders', 'gte', 10)
))
WHERE slug = 'lagecto_veteran';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'completed_orders', 'gte', 20),
  jsonb_build_object('metric', 'reviews_count', 'gte', 10)
))
WHERE slug = 'lagecto_master';

UPDATE public.customer_badge_definitions
SET requirements = jsonb_build_object('all', jsonb_build_array(
  jsonb_build_object('metric', 'completed_orders', 'gte', 50),
  jsonb_build_object('metric', 'distinct_shops_purchased', 'gte', 5)
))
WHERE slug = 'lagecto_legend';

DROP FUNCTION IF EXISTS public._seed_badge(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, BOOLEAN);
