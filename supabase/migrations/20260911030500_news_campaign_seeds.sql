-- News articles, founding campaign, default rewards, challenges, example promo codes.
-- Platform rewards/codes also hit protect_platform_loyalty(); allow postgres/SQL editor.

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

INSERT INTO public.campaigns (slug, name, description, kind, is_active, starts_at, ends_at, max_enrollments, eligibility, benefit)
SELECT
  'founding-users',
  'Founding Users',
  'List your shop on LaGecto FREE for 3 months during the founding period. This is a promotional offer with a start and end date, not a permanent entitlement.',
  'founding_users',
  TRUE,
  NOW(),
  NOW() + INTERVAL '90 days',
  500,
  jsonb_build_object('shop_must_be_new', true, 'include_customers', true),
  jsonb_build_object('package_key', 'thabi', 'duration_months', 3, 'amount', 0, 'listing', 'free_for_3_months')
WHERE NOT EXISTS (SELECT 1 FROM public.campaigns WHERE slug = 'founding-users');

INSERT INTO public.rewards (program_id, name, description, reward_type, value, requirements, starts_at, per_customer_limit, is_active)
SELECT p.id, v.name, v.description, v.reward_type, v.value, v.req::jsonb, NOW(), 1, TRUE
FROM public.loyalty_programs p
CROSS JOIN (VALUES
  ('Profile complete 10%', 'A 10% platform promo after you finish your profile.', 'percent_discount', 10,
    '{"all":[{"metric":"profile_complete","eq":true}]}'),
  ('First order thank-you', '$5 off a later order after your first completed purchase.', 'fixed_discount', 5,
    '{"all":[{"metric":"completed_orders","gte":1}]}'),
  ('Reviewer reward', '10% off after you leave a review.', 'percent_discount', 10,
    '{"all":[{"metric":"reviews_count","gte":1}]}')
) AS v(name, description, reward_type, value, req)
WHERE p.scope = 'platform'
  AND NOT EXISTS (SELECT 1 FROM public.rewards r WHERE r.program_id = p.id AND r.name = v.name);

INSERT INTO public.loyalty_challenges (program_id, slug, name, description, requirements, reward_points, is_active)
SELECT p.id, v.slug, v.name, v.description, v.req::jsonb, v.points, TRUE
FROM public.loyalty_programs p
CROSS JOIN (VALUES
  ('complete-profile', 'Complete your profile', 'Add name, phone, address and username.', '{"all":[{"metric":"profile_complete","eq":true}]}', 25),
  ('first-order', 'Place your first order', 'Complete a valid order on LaGecto.', '{"all":[{"metric":"completed_orders","gte":1}]}', 50),
  ('first-review', 'Leave a review', 'Review a shop you bought from.', '{"all":[{"metric":"reviews_count","gte":1}]}', 20),
  ('discover-shops', 'Discover shops', 'View 5 different shops.', '{"all":[{"metric":"distinct_shops_viewed","gte":5}]}', 15),
  ('save-a-shop', 'Save a favourite', 'Save a shop to return later.', '{"all":[{"metric":"saved_shops","gte":1}]}', 10)
) AS v(slug, name, description, req, points)
WHERE p.scope = 'platform'
ON CONFLICT (program_id, slug) DO NOTHING;

INSERT INTO public.promo_codes (
  code, name, description, owner_scope, discount_type, percent_off, amount_off, min_order_amount,
  starts_at, ends_at, total_usage_limit, per_customer_limit, customer_segment, loyalty_only, is_active
)
SELECT v.code, v.name, v.description, 'platform', v.discount_type, v.percent_off, v.amount_off, v.min_order,
       NOW(), NOW() + INTERVAL '180 days', 5000, 1, v.segment, v.loyalty_only, TRUE
FROM (VALUES
  ('WELCOME10', 'Welcome 10%', '10% off your first completed checkout as a new customer of that shop.', 'percent', 10, NULL::numeric, 0, 'new', FALSE),
  ('SAVE5', 'Save $5', '$5 off orders above $30.', 'fixed', NULL::numeric, 5, 30, 'all', FALSE),
  ('LOYAL20', 'Loyal 20%', '20% off for Loyal-level (or higher) customers.', 'percent', 20, NULL::numeric, 0, 'level', TRUE),
  ('FOUNDING3', 'Founding customer', '3% off during the founding period.', 'percent', 3, NULL::numeric, 0, 'all', FALSE)
) AS v(code, name, description, discount_type, percent_off, amount_off, min_order, segment, loyalty_only)
WHERE NOT EXISTS (SELECT 1 FROM public.promo_codes p WHERE p.code = v.code);

UPDATE public.promo_codes pc
SET required_loyalty_level_id = l.id
FROM public.loyalty_levels l
JOIN public.loyalty_programs p ON p.id = l.program_id
WHERE pc.code = 'LOYAL20' AND p.scope = 'platform' AND l.slug = 'loyal';

INSERT INTO public.lagecto_news_articles (
  title, slug, excerpt, body, audience, category, status, published_at, featured,
  seo_title, seo_description, tags, author_name, cover_image_url
)
SELECT * FROM (VALUES
(
  'What is LaGecto?',
  'what-is-lagecto',
  'LaGecto is a digital marketplace and business platform connecting customers with local shops.',
  $b$LaGecto is a digital marketplace based in Bulawayo. Customers discover shops, products and services; businesses run a storefront, take orders, and keep operational tools in one place.

On LaGecto you can:

• Browse active shops and their catalogues
• Place orders and pay with the methods a shop has enabled (including cash, EcoCash, Visa or Mastercard where configured)
• Keep digital receipts for completed orders
• Message shops, leave reviews, and follow LaGecto News

Businesses get a shop dashboard with products or services, inventory, POS, promotions, customers, and — where their package allows — receipts, payroll, expenses and analytics.

LaGecto does not take shop sales as its own revenue. Shop company money stays with the shop. Package subscriptions and LaGecto’s own POS activity are separate.

Khula nathi, mhlobo — grow with us.$b$,
  'all', 'platform', 'published', NOW() - INTERVAL '8 days', TRUE,
  'What is LaGecto? Digital marketplace in Bulawayo',
  'LaGecto connects customers and businesses: shop discovery, orders, receipts, and business tools.',
  ARRAY['lagecto','marketplace','bulawayo'],
  'LaGecto Editorial',
  NULL
),
(
  'Why your business needs LaGecto',
  'why-your-business-needs-lagecto',
  'A digital storefront, marketplace discovery, and the operating tools shops already use on LaGecto.',
  $b$If you sell products or services, customers already look for you online. LaGecto gives your business a place to be found and a place to work.

What shops can use today:

• Digital storefront with your brand, hours and catalogue
• Product and service listings visible in the marketplace
• Orders, POS and inventory
• Promotions with sale prices validated at checkout
• Customer reviews (on paid packages)
• Digital receipts
• Messages with customers
• Business diary, expenses, payroll and reports on higher packages
• Loyalty rewards for your own customers
• Promo codes that apply only to your shop

Listing starts on the Free package. Verified listing and extra tools unlock with Thabi, Kristen or Sandra while that subscription is current.

The Founding Users offer — when it is active — lists eligible new shops free for three months. Check News or Register a shop for dates. It is a campaign, not a lifetime promise.$b$,
  'shop_owners', 'business', 'published', NOW() - INTERVAL '7 days', FALSE,
  'Why your business needs LaGecto',
  'Storefront, marketplace discovery, POS, promotions, loyalty and receipts for Zimbabwean shops.',
  ARRAY['business','shops','pos'],
  'LaGecto Editorial',
  NULL
),
(
  'Take your business online with LaGecto',
  'take-your-business-online-with-lagecto',
  'Register a shop, get a Shop ID after review, then publish a catalogue customers can actually buy from.',
  $b$Going online on LaGecto is a practical sequence, not a slogan.

1. Submit a shop registration. Administrators review it.
2. When the shop is ready you receive a Shop ID (for example gectotech@lg23). Shop owners sign in with that ID.
3. Add products or services, hours, contact details and storefront media.
4. Customers find you in the marketplace and on your public storefront link.
5. Orders and POS sales stay in your dashboard. Payments follow the methods you switched on.

You can start on Free. If the Founding Users campaign is open, eligible new shops receive a complimentary Thabi listing for three months — verified presence without paying that package fee for the campaign window.

Nothing here replaces your existing accounts or bank. LaGecto never asks for card numbers, CVV codes or EcoCash PINs on its own screens.$b$,
  'shop_owners', 'business', 'published', NOW() - INTERVAL '6 days', FALSE,
  'Take your business online with LaGecto',
  'How businesses create a LaGecto shop, get a Shop ID, and start selling.',
  ARRAY['onboarding','shops'],
  'LaGecto Editorial',
  NULL
),
(
  'Smart shopping starts with LaGecto',
  'smart-shopping-with-lagecto',
  'Discover businesses, compare products and services, use promotions, and keep receipts in one account.',
  $b$Smart shopping on LaGecto means using real shop data — not invented recommendations.

You can:

• Search shops, products and services
• Open a storefront and see live promotion prices
• Save shops you want to revisit
• Check out with a promo code when you are signed in
• Earn LaGecto loyalty points and shop-specific loyalty separately
• Unlock achievement badges for things you actually did
• Review shops
• Keep digital receipts after orders complete
• Message a shop when you need to follow up

Guest checkout via WhatsApp is available when a shop has a number. Signed-in checkout uses that shop’s enabled payment methods. Totals always come from the server, never from the browser’s guess.

Your loyalty balance and badges are private to you. Shops see only their own loyalty members, not your full LaGecto history.$b$,
  'customers', 'customers', 'published', NOW() - INTERVAL '5 days', FALSE,
  'Smart shopping starts with LaGecto',
  'Discover shops, use promotions, earn loyalty, and keep receipts on LaGecto.',
  ARRAY['customers','shopping','loyalty'],
  'LaGecto Editorial',
  NULL
),
(
  'Meet the LaGecto marketplace',
  'meet-the-lagecto-marketplace',
  'How discovery, shops, promotions and storefronts fit together.',
  $b$The marketplace is the public face of LaGecto.

Shops appear when they are active. Verified shops show a badge while a current paid or campaign listing is in force. High-value shop achievements — such as Customer Favourite or Top Seller — appear only after the shop has earned them from real orders and reviews.

Inside a storefront you will find catalogues, promotions, about pages, and contact options the owner actually configured. Sale prices are calculated on the server. Expired promotions do not apply at checkout.

LaGecto News, plans, and support sit alongside the marketplace so customers and owners share the same product story.$b$,
  'all', 'platform', 'published', NOW() - INTERVAL '4 days', FALSE,
  'Meet the LaGecto marketplace',
  'How the LaGecto marketplace presents shops, promotions and verified listings.',
  ARRAY['marketplace','discovery'],
  'LaGecto Editorial',
  NULL
),
(
  'Why customer loyalty matters',
  'why-customer-loyalty-matters',
  'Repeat customers are earned with real purchases, not fake scores.',
  $b$Loyalty on LaGecto is split on purpose.

LaGecto platform loyalty rewards activity across the marketplace: completed orders, reviews, discovery, challenges.

Each shop also has its own loyalty programme. Points you earn at Shop A never mix with Shop B, and never mix with platform points.

Shop owners can create milestones, discounts, promo codes and badges for their own buyers. They cannot see another shop’s loyalty data.

Cancelled and fully refunded orders do not keep purchase rewards. That is deliberate. A marketplace only stays trustworthy if rewards follow valid completed trade.

Use loyalty to say thank you to people who actually come back — not to inflate a dashboard.$b$,
  'shop_owners', 'loyalty', 'published', NOW() - INTERVAL '3 days', FALSE,
  'Why customer loyalty matters on LaGecto',
  'Platform loyalty and shop loyalty stay separate. Rewards follow real completed orders.',
  ARRAY['loyalty','shops'],
  'LaGecto Editorial',
  NULL
),
(
  'Introducing LaGecto Loyalty and Achievements',
  'introducing-lagecto-loyalty-achievements',
  'Levels, rewards, 100 customer badges, shop achievements and promo codes — all based on real activity.',
  $b$LaGecto Loyalty has two layers: platform and shop. You can hold both. They never share a balance.

Customers earn points and badges when the server confirms an action: a completed order, a review, a saved shop, a finished profile, a challenge, a valid promo redemption.

There are 100 customer achievement badges, grouped by category, with configurable rarity. Admins can edit names, rules and visibility. You cannot unlock a badge from the browser.

Shop owners earn their own badges from orders, reviews, catalogue size and verification — displayed sparingly on storefronts and marketplace cards.

Promo codes are validated on the server. Usage limits, dates, shop scope and loyalty eligibility are enforced in a database transaction so two checkouts cannot burn the same remaining use.

Open Loyalty, Achievements, Rewards and Promotions from your customer menu. Shop owners manage Customer Loyalty from the shop dashboard.$b$,
  'all', 'loyalty', 'published', NOW() - INTERVAL '2 days', FALSE,
  'Introducing LaGecto Loyalty and Achievements',
  'How LaGecto levels, rewards, badges and promo codes work — server-side and data-driven.',
  ARRAY['loyalty','badges','promotions'],
  'LaGecto Editorial',
  NULL
),
(
  'Founding Users: list your shop free for 3 months',
  'founding-users-free-shop-listing',
  'Join LaGecto as a founding app user and get your shop listed FREE for 3 months while the campaign is open.',
  $b$Are you building a business and looking for a place to showcase your products or services?

Join LaGecto as a founding app user and get your shop listed FREE for 3 months.

What this offer is
During the active Founding Users campaign, eligible new shops receive a complimentary Thabi listing for three months. That includes a verified public badge while the complimentary period is current.

What this offer is not
It is not a lifetime free paid package. When the three months end, the shop remains on LaGecto on the Free package unless you subscribe. Campaign dates and remaining places are configurable by LaGecto administrators.

How to join
Register your business. When the shop is created during the campaign window, enrolment is recorded automatically if places remain. You will also receive the Founding User achievement if the campaign rules award it.

Become a Founding User: open Register a shop and submit your business details.

This promotion can expire. Check the campaign dates on this page or ask LaGecto support.$b$,
  'shop_owners', 'promotions', 'published', NOW() - INTERVAL '1 day', TRUE,
  'Founding Users — list your shop free for 3 months',
  'Founding Users promotional offer: complimentary 3-month shop listing on LaGecto while the campaign is active.',
  ARRAY['founding-users','shops','promotion'],
  'LaGecto Editorial',
  NULL
)
) AS v(title, slug, excerpt, body, audience, category, status, published_at, featured, seo_title, seo_description, tags, author_name, cover_image_url)
WHERE NOT EXISTS (SELECT 1 FROM public.lagecto_news_articles a WHERE a.slug = v.slug);

UPDATE public.lagecto_news_articles a
SET category_id = c.id
FROM public.news_categories c
WHERE a.slug IN (
  'what-is-lagecto', 'why-your-business-needs-lagecto', 'take-your-business-online-with-lagecto',
  'smart-shopping-with-lagecto', 'meet-the-lagecto-marketplace', 'why-customer-loyalty-matters',
  'introducing-lagecto-loyalty-achievements', 'founding-users-free-shop-listing'
) AND c.slug = CASE a.slug
  WHEN 'what-is-lagecto' THEN 'platform'
  WHEN 'meet-the-lagecto-marketplace' THEN 'platform'
  WHEN 'why-your-business-needs-lagecto' THEN 'business'
  WHEN 'take-your-business-online-with-lagecto' THEN 'business'
  WHEN 'smart-shopping-with-lagecto' THEN 'customers'
  WHEN 'why-customer-loyalty-matters' THEN 'loyalty'
  WHEN 'introducing-lagecto-loyalty-achievements' THEN 'loyalty'
  WHEN 'founding-users-free-shop-listing' THEN 'promotions'
END;

DO $$
DECLARE
  customer_n INTEGER;
BEGIN
  SELECT COUNT(*) INTO customer_n FROM public.customer_badge_definitions WHERE audience = 'customer';
  IF customer_n <> 100 THEN
    RAISE EXCEPTION 'Expected exactly 100 customer badges, found %', customer_n;
  END IF;
END $$;
