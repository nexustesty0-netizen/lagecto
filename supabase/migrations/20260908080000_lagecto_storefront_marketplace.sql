-- LaGecto storefront, marketplace discovery, promotions, ads, and dashboard stats.
-- Extends existing shops/products/promotions. Does not replace payments or checkout.

-- ============================================================
-- SHOP PUBLIC SLUG + SEO
-- ============================================================
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_uidx
  ON public.shops (lower(slug))
  WHERE slug IS NOT NULL AND btrim(slug) <> '';

CREATE OR REPLACE FUNCTION public.slugify_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(
    trim(both '-' FROM regexp_replace(lower(regexp_replace(coalesce(p_text, ''), '[^a-zA-Z0-9]+', '-', 'g')), '-{2,}', '-', 'g')),
    60
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_slug_reserved(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_slug, '')) IN (
    'admin','api','app','auth','blog','cart','customer','login','logout','marketplace',
    'news','plans','s','shop','shops','signup','support','help','contact','about',
    'features','static','assets','www','lagecto','register-shop','forgot-password',
    'how-it-works','for-shops','for-customers','403','404','null','undefined'
  );
$$;

CREATE OR REPLACE FUNCTION public.allocate_shop_slug(p_shop_id UUID, p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base TEXT := public.slugify_text(p_name);
  candidate TEXT;
  n INTEGER := 1;
BEGIN
  IF base IS NULL OR base = '' OR public.shop_slug_reserved(base) THEN
    base := 'shop';
  END IF;
  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.shops
    WHERE lower(slug) = lower(candidate)
      AND id <> p_shop_id
  ) OR public.shop_slug_reserved(candidate) LOOP
    n := n + 1;
    candidate := left(base, 50) || '-' || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.shops_ensure_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.allocate_shop_slug(NEW.id, NEW.name);
  ELSE
    NEW.slug := public.slugify_text(NEW.slug);
    IF NEW.slug = '' OR public.shop_slug_reserved(NEW.slug) THEN
      NEW.slug := public.allocate_shop_slug(NEW.id, NEW.name);
    END IF;
    IF EXISTS (SELECT 1 FROM public.shops WHERE lower(slug) = lower(NEW.slug) AND id <> NEW.id) THEN
      NEW.slug := public.allocate_shop_slug(NEW.id, NEW.slug);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_ensure_slug_trg ON public.shops;
CREATE TRIGGER shops_ensure_slug_trg
  BEFORE INSERT OR UPDATE OF slug, name ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.shops_ensure_slug();

UPDATE public.shops
SET slug = public.allocate_shop_slug(id, name)
WHERE slug IS NULL OR btrim(slug) = '';

-- ============================================================
-- STOREFRONT CONFIG COLORS / PUBLISH
-- ============================================================
ALTER TABLE public.shop_storefront_config
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS background_color TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS cover_position TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cta_label TEXT DEFAULT 'Shop now';

ALTER TABLE public.shop_storefront_config
  DROP CONSTRAINT IF EXISTS shop_storefront_config_hex_primary;
ALTER TABLE public.shop_storefront_config
  ADD CONSTRAINT shop_storefront_config_hex_primary
  CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.shop_storefront_config
  DROP CONSTRAINT IF EXISTS shop_storefront_config_hex_secondary;
ALTER TABLE public.shop_storefront_config
  ADD CONSTRAINT shop_storefront_config_hex_secondary
  CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.shop_storefront_config
  DROP CONSTRAINT IF EXISTS shop_storefront_config_hex_accent;
ALTER TABLE public.shop_storefront_config
  ADD CONSTRAINT shop_storefront_config_hex_accent
  CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.shop_storefront_config
  DROP CONSTRAINT IF EXISTS shop_storefront_config_hex_bg;
ALTER TABLE public.shop_storefront_config
  ADD CONSTRAINT shop_storefront_config_hex_bg
  CHECK (background_color IS NULL OR background_color ~ '^#[0-9A-Fa-f]{6}$');

INSERT INTO public.shop_storefront_config (shop_id)
SELECT id FROM public.shops
ON CONFLICT (shop_id) DO NOTHING;

-- ============================================================
-- PRODUCT IMAGE GALLERY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'url')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id, sort_order);

CREATE OR REPLACE FUNCTION public.sync_product_primary_image()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pid UUID;
  next_url TEXT;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF TG_OP = 'DELETE' THEN
    SELECT url INTO next_url
    FROM public.product_images
    WHERE product_id = pid
    ORDER BY is_primary DESC, sort_order, created_at
    LIMIT 1;
    UPDATE public.products SET image = next_url, updated_at = NOW() WHERE id = pid;
    RETURN OLD;
  END IF;
  IF NEW.is_primary THEN
    UPDATE public.product_images
    SET is_primary = FALSE
    WHERE product_id = NEW.product_id AND id <> NEW.id AND is_primary = TRUE;
    UPDATE public.products SET image = NEW.url, updated_at = NOW() WHERE id = NEW.product_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.products WHERE id = NEW.product_id AND image IS NOT NULL AND btrim(image) <> '') THEN
    UPDATE public.products SET image = NEW.url, updated_at = NOW() WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_images_sync_trg ON public.product_images;
DROP TRIGGER IF EXISTS product_images_sync_del_trg ON public.product_images;
CREATE TRIGGER product_images_sync_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_primary_image();

INSERT INTO public.product_images (product_id, shop_id, url, is_primary, source, sort_order)
SELECT id, shop_id, image, TRUE, 'url', 0
FROM public.products
WHERE image IS NOT NULL AND btrim(image) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = products.id);

-- ============================================================
-- STOREFRONT MEDIA / VIDEOS / BLOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.storefront_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'url')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_media_shop ON public.storefront_media (shop_id, sort_order);

CREATE TABLE IF NOT EXISTS public.storefront_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'url')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_videos_shop ON public.storefront_videos (shop_id, sort_order);

CREATE TABLE IF NOT EXISTS public.storefront_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  slug TEXT,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover_image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_blog_shop ON public.storefront_blog_posts (shop_id, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS storefront_blog_shop_slug
  ON public.storefront_blog_posts (shop_id, lower(slug))
  WHERE slug IS NOT NULL AND btrim(slug) <> '';

-- ============================================================
-- PROMOTIONS (extend existing)
-- ============================================================
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE public.promotions
SET ends_at = (expiry_date::timestamptz + INTERVAL '1 day' - INTERVAL '1 second')
WHERE ends_at IS NULL AND expiry_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.promotion_dates_valid()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  product_price NUMERIC;
BEGIN
  IF NEW.discount IS NOT NULL AND (NEW.discount < 0 OR NEW.discount > 100) THEN
    RAISE EXCEPTION 'Discount must be between 0 and 100';
  END IF;
  IF NEW.promo_price IS NOT NULL AND NEW.promo_price < 0 THEN
    RAISE EXCEPTION 'Promotion price cannot be negative';
  END IF;
  IF NEW.original_price IS NOT NULL AND NEW.original_price < 0 THEN
    RAISE EXCEPTION 'Original price cannot be negative';
  END IF;
  IF NEW.starts_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN
    RAISE EXCEPTION 'Promotion end must be after start';
  END IF;
  IF NEW.product_id IS NOT NULL THEN
    SELECT price, shop_id INTO product_price, NEW.shop_id
    FROM public.products WHERE id = NEW.product_id;
    IF product_price IS NULL THEN
      RAISE EXCEPTION 'Promotion product was not found';
    END IF;
    IF NEW.original_price IS NULL THEN
      NEW.original_price := product_price;
    END IF;
    IF NEW.promo_price IS NOT NULL AND NEW.promo_price >= COALESCE(NEW.original_price, product_price) THEN
      RAISE EXCEPTION 'Promotion price must be lower than the original price';
    END IF;
  ELSIF NEW.promo_price IS NOT NULL THEN
    RAISE EXCEPTION 'A product must be selected when setting a promotional price';
  END IF;
  IF NEW.is_active AND NEW.promo_price IS NULL AND (NEW.discount IS NULL OR NEW.discount = 0) THEN
    RAISE EXCEPTION 'Set a discount percentage or a promotional price';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promotions_validate_trg ON public.promotions;
CREATE TRIGGER promotions_validate_trg
  BEFORE INSERT OR UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.promotion_dates_valid();

CREATE OR REPLACE FUNCTION public.promotion_is_live(p public.promotions)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p.is_active
    AND (p.starts_at IS NULL OR p.starts_at <= NOW())
    AND (
      (p.ends_at IS NOT NULL AND p.ends_at >= NOW())
      OR (p.ends_at IS NULL AND (p.expiry_date IS NULL OR p.expiry_date >= (timezone('Africa/Harare', NOW()))::date))
    );
$$;

CREATE OR REPLACE FUNCTION public.product_effective_price(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  promo public.promotions%ROWTYPE;
  sale_price NUMERIC;
  chosen public.promotions%ROWTYPE;
BEGIN
  SELECT * INTO product_row FROM public.products WHERE id = p_product_id;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  sale_price := product_row.price;

  FOR promo IN
    SELECT * FROM public.promotions
    WHERE shop_id = product_row.shop_id
      AND (product_id = product_row.id OR product_id IS NULL)
    ORDER BY
      CASE WHEN product_id = product_row.id THEN 0 ELSE 1 END,
      created_at DESC
  LOOP
    IF public.promotion_is_live(promo) THEN
      IF promo.product_id = product_row.id AND promo.promo_price IS NOT NULL
         AND promo.promo_price >= 0
         AND promo.promo_price < product_row.price THEN
        chosen := promo;
        sale_price := promo.promo_price;
        EXIT;
      ELSIF promo.discount IS NOT NULL AND promo.discount > 0 AND promo.discount <= 100 THEN
        chosen := promo;
        sale_price := round(product_row.price * (1 - promo.discount / 100.0), 2);
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF sale_price < 0 THEN
    sale_price := 0;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'product_id', product_row.id,
    'list_price', product_row.price,
    'unit_price', sale_price,
    'discount_amount', GREATEST(product_row.price - sale_price, 0),
    'promotion_id', chosen.id,
    'on_sale', sale_price < product_row.price
  );
END;
$$;

-- ============================================================
-- ADS + MARKETPLACE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketplace_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  ad_type TEXT NOT NULL DEFAULT 'banner'
    CHECK (ad_type IN ('banner', 'featured_shop', 'featured_product', 'sponsored')),
  destination_kind TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (destination_kind IN ('marketplace', 'shop', 'product', 'promotion', 'category')),
  destination_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_ads_active
  ON public.marketplace_ads (is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.marketplace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'product_view', 'shop_view', 'add_to_cart', 'search',
      'promotion_click', 'ad_click', 'purchase'
    )),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES public.marketplace_ads(id) ON DELETE SET NULL,
  query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_type_created
  ON public.marketplace_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_product
  ON public.marketplace_events (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_shop
  ON public.marketplace_events (shop_id, created_at DESC);

-- ============================================================
-- STORAGE BUCKETS (if storage schema exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      (
        'shop-media',
        'shop-media',
        TRUE,
        5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/gif']
      ),
      (
        'product-media',
        'product-media',
        TRUE,
        5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/gif']
      ),
      (
        'storefront-media',
        'storefront-media',
        TRUE,
        52428800,
        ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- RANKING / RECOMMENDATION / DASHBOARD FUNCTIONS
--
-- Trending product score (7-day window unless noted):
--   (units sold in 7 days * 5)
-- + (units sold in 30 days * 2)
-- + (product views in 7 days * 1)
-- + (add-to-cart events in 7 days * 2)
-- Time windows keep historical bestsellers from permanently dominating.
--
-- Most sold:
--   SUM(order_items.quantity) for orders with payment_status = 'paid'
--   AND status NOT IN ('cancelled','refunded')
--   UNION POS sale_items for completed sales with no order_id
--   (avoids double-counting marketplace orders that also create sales).
--
-- Top shops:
--   completed paid order count * 3
-- + paid sales volume * 0.01
-- + avg_rating * total_reviews * 0.5
--
-- Trending shops:
--   paid orders in 7 days * 4
-- + shop views in 7 days * 1
-- + products created in 7 days * 2
-- ============================================================

CREATE OR REPLACE FUNCTION public.paid_order_item_units(p_since TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (product_id UUID, shop_id UUID, units BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.product_id, oi.shop_id, SUM(oi.quantity)::bigint
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.payment_status = 'paid'
    AND o.status NOT IN ('cancelled', 'refunded')
    AND oi.product_id IS NOT NULL
    AND (p_since IS NULL OR o.created_at >= p_since)
  GROUP BY oi.product_id, oi.shop_id
  UNION ALL
  SELECT si.product_id, s.shop_id, SUM(si.quantity)::bigint
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE s.status = 'completed'
    AND s.order_id IS NULL
    AND si.product_id IS NOT NULL
    AND (p_since IS NULL OR s.sale_date >= p_since)
  GROUP BY si.product_id, s.shop_id;
$$;

CREATE OR REPLACE FUNCTION public.marketplace_most_sold_products(p_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  product_id UUID,
  shop_id UUID,
  units BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.product_id, u.shop_id, SUM(u.units)::bigint AS units
  FROM public.paid_order_item_units(NULL) u
  JOIN public.products p ON p.id = u.product_id AND p.is_available = TRUE
  JOIN public.shops sh ON sh.id = u.shop_id AND sh.status = 'active'
  GROUP BY u.product_id, u.shop_id
  ORDER BY SUM(u.units) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 48));
$$;

CREATE OR REPLACE FUNCTION public.marketplace_trending_products(p_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  product_id UUID,
  shop_id UUID,
  score NUMERIC,
  units_7d BIGINT,
  views_7d BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold_7 AS (
    SELECT product_id, shop_id, SUM(units) AS units
    FROM public.paid_order_item_units(NOW() - INTERVAL '7 days')
    GROUP BY product_id, shop_id
  ),
  sold_30 AS (
    SELECT product_id, shop_id, SUM(units) AS units
    FROM public.paid_order_item_units(NOW() - INTERVAL '30 days')
    GROUP BY product_id, shop_id
  ),
  views_7 AS (
    SELECT product_id, COUNT(*) AS views
    FROM public.marketplace_events
    WHERE event_type = 'product_view' AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY product_id
  ),
  carts_7 AS (
    SELECT product_id, COUNT(*) AS carts
    FROM public.marketplace_events
    WHERE event_type = 'add_to_cart' AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY product_id
  )
  SELECT
    p.id,
    p.shop_id,
    (
      COALESCE(s7.units, 0) * 5
      + COALESCE(s30.units, 0) * 2
      + COALESCE(v.views, 0) * 1
      + COALESCE(c.carts, 0) * 2
    )::numeric AS score,
    COALESCE(s7.units, 0)::bigint,
    COALESCE(v.views, 0)::bigint
  FROM public.products p
  JOIN public.shops sh ON sh.id = p.shop_id AND sh.status = 'active'
  LEFT JOIN sold_7 s7 ON s7.product_id = p.id
  LEFT JOIN sold_30 s30 ON s30.product_id = p.id
  LEFT JOIN views_7 v ON v.product_id = p.id
  LEFT JOIN carts_7 c ON c.product_id = p.id
  WHERE p.is_available = TRUE
    AND (
      COALESCE(s7.units, 0) + COALESCE(s30.units, 0) + COALESCE(v.views, 0) + COALESCE(c.carts, 0)
    ) > 0
  ORDER BY score DESC, p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 48));
$$;

CREATE OR REPLACE FUNCTION public.marketplace_top_shops(p_limit INTEGER DEFAULT 8)
RETURNS TABLE (
  shop_id UUID,
  score NUMERIC,
  paid_orders BIGINT,
  avg_rating NUMERIC,
  total_reviews INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH paid AS (
    SELECT o.shop_id, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS volume
    FROM public.orders o
    WHERE o.payment_status = 'paid' AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY o.shop_id
  )
  SELECT
    sh.id,
    (
      COALESCE(p.orders, 0) * 3
      + COALESCE(p.volume, 0) * 0.01
      + COALESCE(sh.avg_rating, 0) * COALESCE(sh.total_reviews, 0) * 0.5
    )::numeric,
    COALESCE(p.orders, 0)::bigint,
    COALESCE(sh.avg_rating, 0),
    COALESCE(sh.total_reviews, 0)
  FROM public.shops sh
  LEFT JOIN paid p ON p.shop_id = sh.id
  WHERE sh.status = 'active'
    AND (COALESCE(p.orders, 0) > 0 OR COALESCE(sh.total_reviews, 0) > 0)
  ORDER BY 2 DESC, sh.name
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 48));
$$;

CREATE OR REPLACE FUNCTION public.marketplace_trending_shops(p_limit INTEGER DEFAULT 8)
RETURNS TABLE (
  shop_id UUID,
  score NUMERIC,
  orders_7d BIGINT,
  views_7d BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH orders_7 AS (
    SELECT shop_id, COUNT(*) AS orders
    FROM public.orders
    WHERE payment_status = 'paid'
      AND status NOT IN ('cancelled', 'refunded')
      AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY shop_id
  ),
  views_7 AS (
    SELECT shop_id, COUNT(*) AS views
    FROM public.marketplace_events
    WHERE event_type = 'shop_view' AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY shop_id
  ),
  products_7 AS (
    SELECT shop_id, COUNT(*) AS added
    FROM public.products
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY shop_id
  )
  SELECT
    sh.id,
    (
      COALESCE(o.orders, 0) * 4
      + COALESCE(v.views, 0) * 1
      + COALESCE(pr.added, 0) * 2
    )::numeric,
    COALESCE(o.orders, 0)::bigint,
    COALESCE(v.views, 0)::bigint
  FROM public.shops sh
  LEFT JOIN orders_7 o ON o.shop_id = sh.id
  LEFT JOIN views_7 v ON v.shop_id = sh.id
  LEFT JOIN products_7 pr ON pr.shop_id = sh.id
  WHERE sh.status = 'active'
    AND (COALESCE(o.orders, 0) + COALESCE(v.views, 0) + COALESCE(pr.added, 0)) > 0
  ORDER BY 2 DESC, sh.name
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 48));
$$;

CREATE OR REPLACE FUNCTION public.marketplace_recommendations(
  p_user_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (product_id UUID, reason TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 8), 24));
BEGIN
  RETURN QUERY
  WITH purchased AS (
    SELECT DISTINCT oi.product_id, p.category, p.shop_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    WHERE p_user_id IS NOT NULL
      AND o.customer_id = p_user_id
      AND o.payment_status = 'paid'
      AND o.status NOT IN ('cancelled', 'refunded')
  ),
  viewed AS (
    SELECT DISTINCT e.product_id, p.category, p.shop_id
    FROM public.marketplace_events e
    JOIN public.products p ON p.id = e.product_id
    WHERE p_user_id IS NOT NULL
      AND e.user_id = p_user_id
      AND e.event_type = 'product_view'
      AND e.created_at >= NOW() - INTERVAL '30 days'
  ),
  seed AS (
    SELECT category, shop_id FROM purchased
    UNION
    SELECT category, shop_id FROM viewed
    UNION
    SELECT p.category, p.shop_id FROM public.products p WHERE p.id = p_product_id
    UNION
    SELECT NULL::text, p_shop_id WHERE p_shop_id IS NOT NULL
  ),
  ranked AS (
    SELECT p.id,
      CASE
        WHEN p_product_id IS NOT NULL AND p.shop_id = (SELECT shop_id FROM public.products WHERE id = p_product_id) THEN 'more_from_shop'
        WHEN p.category IN (SELECT category FROM seed WHERE category IS NOT NULL) THEN 'similar'
        WHEN p.shop_id IN (SELECT shop_id FROM seed WHERE shop_id IS NOT NULL) THEN 'more_from_shop'
        ELSE 'popular'
      END AS reason,
      p.is_popular,
      p.created_at
    FROM public.products p
    JOIN public.shops sh ON sh.id = p.shop_id AND sh.status = 'active'
    WHERE p.is_available = TRUE
      AND (p_product_id IS NULL OR p.id <> p_product_id)
  )
  SELECT r.id, r.reason
  FROM ranked r
  ORDER BY
    CASE r.reason WHEN 'more_from_shop' THEN 0 WHEN 'similar' THEN 1 ELSE 2 END,
    r.is_popular DESC,
    r.created_at DESC
  LIMIT cap;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT t.product_id, 'trending'::text
    FROM public.marketplace_trending_products(cap) t;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_day_bounds(p_period TEXT, p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS TABLE (starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  today DATE := (timezone('Africa/Harare', NOW()))::date;
  start_d DATE;
  end_d DATE;
BEGIN
  -- Platform calendar days use Africa/Harare (Bulawayo). All dashboard date filters
  -- convert those dates to timestamptz so UTC storage is not mixed with local days.
  IF p_from IS NOT NULL AND p_to IS NOT NULL THEN
    start_d := p_from;
    end_d := p_to;
  ELSIF p_period = 'today' THEN
    start_d := today;
    end_d := today;
  ELSIF p_period = 'week' THEN
    start_d := today - ((EXTRACT(ISODOW FROM today)::int) - 1);
    end_d := today;
  ELSIF p_period = 'month' THEN
    start_d := date_trunc('month', today)::date;
    end_d := today;
  ELSIF p_period = 'year' THEN
    start_d := date_trunc('year', today)::date;
    end_d := today;
  ELSE
    start_d := NULL;
    end_d := NULL;
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
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
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
      AND COALESCE(paid_at, created_at) >= start_at
      AND COALESCE(paid_at, created_at) < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO refunded_volume
    FROM public.payment_refunds
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND COALESCE(completed_at, created_at) >= start_at
      AND COALESCE(completed_at, created_at) < end_at;
  END IF;

  SELECT COUNT(*) INTO pending_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'pending';
  SELECT COUNT(*) INTO completed_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'completed';
  SELECT COUNT(*) INTO product_count FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO service_count FROM public.products WHERE shop_id = p_shop_id AND type = 'service';
  SELECT COUNT(*) INTO customer_count
  FROM (
    SELECT user_id AS cid FROM public.customers WHERE shop_id = p_shop_id AND user_id IS NOT NULL
    UNION
    SELECT customer_id FROM public.orders
    WHERE shop_id = p_shop_id AND payment_status = 'paid' AND customer_id IS NOT NULL
  ) paid_customers;
  SELECT COALESCE(SUM(stock), 0) INTO inventory_units FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO low_stock FROM public.products WHERE shop_id = p_shop_id AND type = 'product' AND stock <= COALESCE(low_stock_threshold, 5);
  SELECT COUNT(*) INTO active_promos FROM public.promotions promo WHERE promo.shop_id = p_shop_id AND public.promotion_is_live(promo);
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

CREATE OR REPLACE FUNCTION public.record_marketplace_event(
  p_event_type TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_promotion_id UUID DEFAULT NULL,
  p_ad_id UUID DEFAULT NULL,
  p_query TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kind TEXT := lower(coalesce(p_event_type, ''));
BEGIN
  IF kind NOT IN ('product_view', 'shop_view', 'add_to_cart', 'search', 'promotion_click', 'ad_click') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsupported event');
  END IF;

  INSERT INTO public.marketplace_events (
    event_type, user_id, shop_id, product_id, promotion_id, ad_id, query
  ) VALUES (
    kind,
    auth.uid(),
    p_shop_id,
    p_product_id,
    p_promotion_id,
    p_ad_id,
    left(coalesce(p_query, ''), 80)
  );

  IF p_ad_id IS NOT NULL AND kind = 'ad_click' THEN
    UPDATE public.marketplace_ads SET clicks = clicks + 1 WHERE id = p_ad_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ad_is_live(p public.marketplace_ads)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT p.is_active
    AND (p.starts_at IS NULL OR p.starts_at <= NOW())
    AND (p.ends_at IS NULL OR p.ends_at >= NOW());
$$;

CREATE OR REPLACE FUNCTION public.record_ad_impression(p_ad_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_ads SET impressions = impressions + 1
  WHERE id = p_ad_id AND public.ad_is_live(marketplace_ads);
END;
$$;

CREATE OR REPLACE FUNCTION public.live_marketplace_ads(p_limit INTEGER DEFAULT 6)
RETURNS SETOF public.marketplace_ads
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.marketplace_ads a
  WHERE public.ad_is_live(a)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 6), 24));
$$;

-- ============================================================
-- CHECKOUT: apply live promotions server-side
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_customer_order(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  profile public.users%ROWTYPE;
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
  subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  line_total NUMERIC;
  unit_price NUMERIC;
  pricing JSONB;
  order_id UUID;
  period UUID;
  built_items JSONB := '[]'::jsonb;
  order_no TEXT;
  method TEXT;
  shop_currency TEXT;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);

  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT * INTO profile FROM public.users WHERE id = uid;
  IF profile.role <> 'customer' OR profile.account_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only active customers can place orders');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop is not available');
  END IF;

  method := public.normalize_payment_method(p_payment_method);
  IF method IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose a valid payment method');
  END IF;
  IF NOT public.shop_accepts_payment_method(p_shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;

  SELECT currency INTO shop_currency FROM public.shops WHERE id = p_shop_id;
  period := public.current_financial_period_id(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A product in your cart is no longer available');
    END IF;
    IF product_row.type = 'product' AND product_row.stock < qty THEN
      RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    line_total := unit_price * qty;
    subtotal := subtotal + (product_row.price * qty);
    discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
    built_items := built_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'quantity', qty,
      'list_price', product_row.price,
      'price', unit_price,
      'promotion_id', pricing->>'promotion_id'
    ));
  END LOOP;

  order_no := public.next_order_number();
  INSERT INTO public.orders (
    order_number, shop_id, customer_id, period_id, customer_name, customer_email, customer_phone,
    items, subtotal, discount, total, status, payment_method, payment_status, currency, notes
  ) VALUES (
    order_no, p_shop_id, uid, period, profile.name, profile.email, profile.phone,
    built_items, subtotal, discount_total, subtotal - discount_total, 'pending', method, 'pending', COALESCE(shop_currency, 'USD'),
    left(COALESCE(p_notes, ''), 400)
  )
  RETURNING id INTO order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(built_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, shop_id, product_name, quantity, unit_price)
    VALUES (
      order_id,
      (item->>'product_id')::uuid,
      p_shop_id,
      item->>'name',
      (item->>'quantity')::int,
      (item->>'price')::numeric
    );
  END LOOP;

  INSERT INTO public.shop_notifications (shop_id, title, message, type)
  VALUES (p_shop_id, 'New order', 'Order ' || order_no || ' was placed.', 'order');

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (uid, 'Order placed', 'Your order ' || order_no || ' was submitted.', 'order', order_id);

  INSERT INTO public.marketplace_events (event_type, user_id, shop_id, query)
  VALUES ('purchase', uid, p_shop_id, order_no);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'order_number', order_no,
    'subtotal', subtotal,
    'discount', discount_total,
    'total', subtotal - discount_total,
    'currency', COALESCE(shop_currency, 'USD'),
    'payment_method', method,
    'payment_status', 'pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_customer_cart(p_shop_id UUID, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
  pricing JSONB;
  unit_price NUMERIC;
  lines JSONB := '[]'::jsonb;
  subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop is not available');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A product in your cart is no longer available');
    END IF;
    IF product_row.type = 'product' AND product_row.stock < qty THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', product_row.name || ' does not have enough stock',
        'product_id', product_row.id
      );
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    subtotal := subtotal + (product_row.price * qty);
    discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'quantity', qty,
      'list_price', product_row.price,
      'unit_price', unit_price,
      'line_total', unit_price * qty,
      'in_stock', CASE WHEN product_row.type = 'service' THEN TRUE ELSE product_row.stock >= qty END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'items', lines,
    'subtotal', subtotal,
    'discount', discount_total,
    'total', subtotal - discount_total
  );
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_images_read ON public.product_images;
CREATE POLICY product_images_read ON public.product_images FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS product_images_write ON public.product_images;
CREATE POLICY product_images_write ON public.product_images FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS storefront_media_read ON public.storefront_media;
CREATE POLICY storefront_media_read ON public.storefront_media FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS storefront_media_write ON public.storefront_media;
CREATE POLICY storefront_media_write ON public.storefront_media FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS storefront_videos_read ON public.storefront_videos;
CREATE POLICY storefront_videos_read ON public.storefront_videos FOR SELECT
  USING (is_published = TRUE OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
DROP POLICY IF EXISTS storefront_videos_write ON public.storefront_videos;
CREATE POLICY storefront_videos_write ON public.storefront_videos FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS storefront_blog_read ON public.storefront_blog_posts;
CREATE POLICY storefront_blog_read ON public.storefront_blog_posts FOR SELECT
  USING (status = 'published' OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
DROP POLICY IF EXISTS storefront_blog_write ON public.storefront_blog_posts;
CREATE POLICY storefront_blog_write ON public.storefront_blog_posts FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS marketplace_ads_read ON public.marketplace_ads;
CREATE POLICY marketplace_ads_read ON public.marketplace_ads FOR SELECT
  USING (public.ad_is_live(marketplace_ads) OR public.is_platform_admin());
DROP POLICY IF EXISTS marketplace_ads_write ON public.marketplace_ads;
CREATE POLICY marketplace_ads_write ON public.marketplace_ads FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS marketplace_events_read ON public.marketplace_events;
CREATE POLICY marketplace_events_read ON public.marketplace_events FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id) OR user_id = auth.uid());
DROP POLICY IF EXISTS marketplace_events_insert ON public.marketplace_events;
CREATE POLICY marketplace_events_insert ON public.marketplace_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

GRANT EXECUTE ON FUNCTION public.product_effective_price(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_most_sold_products(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_trending_products(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_top_shops(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_trending_shops(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_recommendations(UUID, UUID, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketplace_event(TEXT, UUID, UUID, UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_marketplace_ads(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_customer_cart(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_dashboard_stats(UUID, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_customer_order(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slugify_text(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_shop_slug(UUID, TEXT) TO authenticated;
