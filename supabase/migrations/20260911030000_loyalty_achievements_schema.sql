-- LaGecto loyalty, achievements, promo codes, campaigns, and news extensions.
-- Extends existing loyalty_wallets, loyalty_transactions, customer_badge_definitions,
-- customer_badges, promotions, and lagecto_news_articles. Does not replace payments.

-- ============================================================
-- EXISTING TABLE EXTENSIONS
-- ============================================================

ALTER TABLE public.loyalty_wallets
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'shop',
  ADD COLUMN IF NOT EXISTS lifetime_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.loyalty_wallets
SET scope = CASE WHEN shop_id IS NULL THEN 'platform' ELSE 'shop' END
WHERE scope IS NULL OR (scope = 'shop' AND shop_id IS NULL);

ALTER TABLE public.loyalty_wallets
  DROP CONSTRAINT IF EXISTS loyalty_wallets_scope_check;
ALTER TABLE public.loyalty_wallets
  ADD CONSTRAINT loyalty_wallets_scope_check
  CHECK (
    (scope = 'platform' AND shop_id IS NULL)
    OR (scope = 'shop' AND shop_id IS NOT NULL)
  );

ALTER TABLE public.loyalty_wallets
  DROP CONSTRAINT IF EXISTS loyalty_wallets_user_id_shop_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_wallets_platform_user_idx
  ON public.loyalty_wallets (user_id) WHERE scope = 'platform';
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_wallets_shop_user_idx
  ON public.loyalty_wallets (user_id, shop_id) WHERE scope = 'shop';

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'earn',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.loyalty_transactions
  DROP CONSTRAINT IF EXISTS loyalty_transactions_kind_check;
ALTER TABLE public.loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_kind_check
  CHECK (kind IN ('earn', 'redeem', 'reverse', 'adjust', 'expire'));

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tx_idempotency_idx
  ON public.loyalty_transactions (wallet_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.customer_badge_definitions
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'getting_started',
  ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'award',
  ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.customer_badge_definitions
  DROP CONSTRAINT IF EXISTS customer_badge_definitions_audience_check;
ALTER TABLE public.customer_badge_definitions
  ADD CONSTRAINT customer_badge_definitions_audience_check
  CHECK (audience IN ('customer', 'shop', 'platform'));

ALTER TABLE public.customer_badge_definitions
  DROP CONSTRAINT IF EXISTS customer_badge_definitions_rarity_check;
ALTER TABLE public.customer_badge_definitions
  ADD CONSTRAINT customer_badge_definitions_rarity_check
  CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));

ALTER TABLE public.customer_badges
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'engine',
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grant_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.lagecto_news_articles
  DROP CONSTRAINT IF EXISTS lagecto_news_articles_status_check;
ALTER TABLE public.lagecto_news_articles
  ADD CONSTRAINT lagecto_news_articles_status_check
  CHECK (status IN ('draft', 'scheduled', 'published', 'unpublished', 'archived'));

ALTER TABLE public.lagecto_news_articles
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS reading_minutes INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS lagecto_news_slug_idx
  ON public.lagecto_news_articles (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS loyalty_reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS free_delivery BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'shop')),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope = 'platform' AND shop_id IS NULL)
    OR (scope = 'shop' AND shop_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_programs_platform_idx
  ON public.loyalty_programs ((TRUE)) WHERE scope = 'platform';
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_programs_shop_idx
  ON public.loyalty_programs (shop_id) WHERE scope = 'shop';

CREATE TABLE IF NOT EXISTS public.loyalty_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'sparkles',
  rank INTEGER NOT NULL DEFAULT 1,
  min_points INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_slug TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, slug),
  UNIQUE (program_id, rank)
);

CREATE INDEX IF NOT EXISTS loyalty_levels_program_idx ON public.loyalty_levels (program_id, rank);

ALTER TABLE public.loyalty_wallets
  DROP CONSTRAINT IF EXISTS loyalty_wallets_level_id_fkey;
ALTER TABLE public.loyalty_wallets
  ADD CONSTRAINT loyalty_wallets_level_id_fkey
  FOREIGN KEY (level_id) REFERENCES public.loyalty_levels(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN (
    'percent_discount', 'fixed_discount', 'free_delivery', 'promo_code',
    'badge', 'early_access', 'exclusive_deal'
  )),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  usage_limit INTEGER,
  per_customer_limit INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rewards_program_idx ON public.rewards (program_id, is_active);
CREATE INDEX IF NOT EXISTS rewards_shop_idx ON public.rewards (shop_id, is_active);
CREATE INDEX IF NOT EXISTS rewards_dates_idx ON public.rewards (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'used', 'expired', 'revoked')),
  promo_code_id UUID,
  idempotency_key TEXT,
  used_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE (reward_id, user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS reward_claims_user_idx ON public.reward_claims (user_id, status);
CREATE INDEX IF NOT EXISTS reward_claims_reward_idx ON public.reward_claims (reward_id, status);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_scope TEXT NOT NULL CHECK (owner_scope IN ('platform', 'shop')),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free_delivery')),
  percent_off NUMERIC(5,2) CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off NUMERIC(12,2) CHECK (amount_off IS NULL OR amount_off > 0),
  max_discount NUMERIC(12,2),
  min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  total_usage_limit INTEGER,
  per_customer_limit INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  eligible_customer_ids UUID[] NOT NULL DEFAULT '{}',
  eligible_product_ids UUID[] NOT NULL DEFAULT '{}',
  eligible_service_ids UUID[] NOT NULL DEFAULT '{}',
  eligible_shop_ids UUID[] NOT NULL DEFAULT '{}',
  customer_segment TEXT NOT NULL DEFAULT 'all' CHECK (customer_segment IN (
    'all', 'new', 'existing', 'loyalty', 'level'
  )),
  required_loyalty_level_id UUID REFERENCES public.loyalty_levels(id) ON DELETE SET NULL,
  loyalty_only BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (owner_scope = 'platform' AND shop_id IS NULL)
    OR (owner_scope = 'shop' AND shop_id IS NOT NULL)
  ),
  CHECK (
    (discount_type = 'percent' AND percent_off IS NOT NULL)
    OR (discount_type = 'fixed' AND amount_off IS NOT NULL)
    OR (discount_type = 'free_delivery')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_idx ON public.promo_codes (code);
CREATE INDEX IF NOT EXISTS promo_codes_shop_idx ON public.promo_codes (shop_id, is_active);
CREATE INDEX IF NOT EXISTS promo_codes_status_idx ON public.promo_codes (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS promo_codes_created_idx ON public.promo_codes (created_at DESC);

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_promo_code_id_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_promo_code_id_fkey
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

ALTER TABLE public.reward_claims
  DROP CONSTRAINT IF EXISTS reward_claims_promo_code_id_fkey;
ALTER TABLE public.reward_claims
  ADD CONSTRAINT reward_claims_promo_code_id_fkey
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'voided')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_code_id, order_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON public.promo_redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS promo_redemptions_code_idx ON public.promo_redemptions (promo_code_id, status);
CREATE INDEX IF NOT EXISTS promo_redemptions_shop_idx ON public.promo_redemptions (shop_id);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('founding_users', 'loyalty', 'promotion', 'seasonal')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_enrollments INTEGER,
  enrollment_count INTEGER NOT NULL DEFAULT 0,
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefit JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_kind_idx ON public.campaigns (kind, is_active);
CREATE INDEX IF NOT EXISTS campaigns_dates_idx ON public.campaigns (starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  benefit_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, shop_id)
);

CREATE INDEX IF NOT EXISTS campaign_enrollments_shop_idx ON public.campaign_enrollments (shop_id, status);
CREATE INDEX IF NOT EXISTS campaign_enrollments_user_idx ON public.campaign_enrollments (user_id);

CREATE TABLE IF NOT EXISTS public.shop_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.customer_badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'engine',
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  grant_reason TEXT,
  UNIQUE (shop_id, badge_id)
);

CREATE INDEX IF NOT EXISTS shop_badges_shop_idx ON public.shop_badges (shop_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS shop_badges_badge_idx ON public.shop_badges (badge_id);

CREATE TABLE IF NOT EXISTS public.badge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.customer_badge_definitions(id) ON DELETE CASCADE,
  current_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_value NUMERIC(12,2) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id),
  UNIQUE (shop_id, badge_id)
);

CREATE INDEX IF NOT EXISTS badge_progress_user_idx ON public.badge_progress (user_id, badge_id);
CREATE INDEX IF NOT EXISTS badge_progress_shop_idx ON public.badge_progress (shop_id, badge_id);

CREATE TABLE IF NOT EXISTS public.loyalty_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, slug)
);

CREATE INDEX IF NOT EXISTS loyalty_challenges_program_idx ON public.loyalty_challenges (program_id, is_active);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.loyalty_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_progress_user_idx ON public.challenge_progress (user_id, completed_at);

CREATE TABLE IF NOT EXISTS public.loyalty_visits (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, visit_date)
);

CREATE TABLE IF NOT EXISTS public.news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.lagecto_news_articles
  DROP CONSTRAINT IF EXISTS lagecto_news_articles_category_id_fkey;
ALTER TABLE public.lagecto_news_articles
  ADD CONSTRAINT lagecto_news_articles_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.news_categories(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.loyalty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loyalty_audit_created_idx ON public.loyalty_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_audit_entity_idx ON public.loyalty_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS customer_badges_user_idx ON public.customer_badges (user_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS customer_badges_badge_idx ON public.customer_badges (badge_id);
CREATE INDEX IF NOT EXISTS loyalty_wallets_user_idx ON public.loyalty_wallets (user_id);
CREATE INDEX IF NOT EXISTS loyalty_wallets_shop_idx ON public.loyalty_wallets (shop_id);

-- ============================================================
-- RLS
-- Customers cannot write wallets, badges, promo usage, or reward values.
-- Shop owners can only see/manage their own shop's loyalty objects.
-- ============================================================

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_own ON public.loyalty_wallets;
CREATE POLICY loyalty_wallets_select ON public.loyalty_wallets FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );

DROP POLICY IF EXISTS loyalty_tx ON public.loyalty_transactions;
CREATE POLICY loyalty_tx_select ON public.loyalty_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.loyalty_wallets w
    WHERE w.id = wallet_id
      AND (
        w.user_id = auth.uid()
        OR public.is_platform_admin()
        OR (w.shop_id IS NOT NULL AND public.user_owns_shop(w.shop_id))
      )
  ));

DROP POLICY IF EXISTS badges_def_read ON public.customer_badge_definitions;
CREATE POLICY badges_def_read ON public.customer_badge_definitions FOR SELECT USING (TRUE);
CREATE POLICY badges_def_admin ON public.customer_badge_definitions FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS badges_own ON public.customer_badges;
DROP POLICY IF EXISTS badges_earn ON public.customer_badges;
CREATE POLICY badges_own_select ON public.customer_badges FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY loyalty_programs_read ON public.loyalty_programs FOR SELECT
  USING (
    is_active = TRUE
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );
CREATE POLICY loyalty_programs_admin ON public.loyalty_programs FOR ALL
  USING (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)))
  WITH CHECK (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)));

CREATE POLICY loyalty_levels_read ON public.loyalty_levels FOR SELECT USING (TRUE);
CREATE POLICY loyalty_levels_write ON public.loyalty_levels FOR ALL
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.loyalty_programs p
      WHERE p.id = program_id AND p.shop_id IS NOT NULL AND public.user_owns_shop(p.shop_id)
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.loyalty_programs p
      WHERE p.id = program_id AND p.shop_id IS NOT NULL AND public.user_owns_shop(p.shop_id)
    )
  );

CREATE POLICY rewards_read ON public.rewards FOR SELECT
  USING (
    (is_active = TRUE AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW()))
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );
CREATE POLICY rewards_write ON public.rewards FOR ALL
  USING (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)))
  WITH CHECK (
    public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id) AND program_id IN (
      SELECT id FROM public.loyalty_programs WHERE shop_id = rewards.shop_id
    ))
  );

CREATE POLICY reward_claims_own ON public.reward_claims FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)));

CREATE POLICY promo_codes_read ON public.promo_codes FOR SELECT
  USING (
    public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
    OR (
      is_active = TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
      AND (
        cardinality(eligible_customer_ids) = 0
        OR auth.uid() = ANY (eligible_customer_ids)
      )
    )
  );
CREATE POLICY promo_codes_write ON public.promo_codes FOR ALL
  USING (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)))
  WITH CHECK (
    public.is_platform_admin()
    OR (owner_scope = 'shop' AND shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );

CREATE POLICY promo_redemptions_read ON public.promo_redemptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );

CREATE POLICY campaigns_read ON public.campaigns FOR SELECT
  USING (is_active = TRUE OR public.is_platform_admin());
CREATE POLICY campaigns_admin ON public.campaigns FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY campaign_enrollments_read ON public.campaign_enrollments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );

CREATE POLICY shop_badges_read ON public.shop_badges FOR SELECT USING (TRUE);
CREATE POLICY shop_badges_admin ON public.shop_badges FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY badge_progress_own ON public.badge_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );

CREATE POLICY challenges_read ON public.loyalty_challenges FOR SELECT
  USING (
    is_active = TRUE
    OR public.is_platform_admin()
    OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id))
  );
CREATE POLICY challenges_write ON public.loyalty_challenges FOR ALL
  USING (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)))
  WITH CHECK (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_owns_shop(shop_id)));

CREATE POLICY challenge_progress_own ON public.challenge_progress FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY loyalty_visits_own ON public.loyalty_visits FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY news_categories_read ON public.news_categories FOR SELECT USING (TRUE);
CREATE POLICY news_categories_admin ON public.news_categories FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY loyalty_audit_admin ON public.loyalty_audit_log FOR SELECT
  USING (public.is_platform_admin());

-- Prevent shop owners from editing platform programs/rewards/codes via WITH CHECK above.
CREATE OR REPLACE FUNCTION public.protect_platform_loyalty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  -- Migrations and the Supabase SQL editor run as postgres, not as a JWT admin.
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

DROP TRIGGER IF EXISTS trg_protect_platform_loyalty_programs ON public.loyalty_programs;
CREATE TRIGGER trg_protect_platform_loyalty_programs
BEFORE INSERT OR UPDATE ON public.loyalty_programs
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_loyalty();

DROP TRIGGER IF EXISTS trg_protect_platform_rewards ON public.rewards;
CREATE TRIGGER trg_protect_platform_rewards
BEFORE INSERT OR UPDATE ON public.rewards
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_loyalty();

DROP TRIGGER IF EXISTS trg_protect_platform_promos ON public.promo_codes;
CREATE TRIGGER trg_protect_platform_promos
BEFORE INSERT OR UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_loyalty();

DROP TRIGGER IF EXISTS trg_protect_badge_defs ON public.customer_badge_definitions;
CREATE TRIGGER trg_protect_badge_defs
BEFORE INSERT OR UPDATE ON public.customer_badge_definitions
FOR EACH ROW EXECUTE FUNCTION public.protect_platform_loyalty();
