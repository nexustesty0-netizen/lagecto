-- Optional storefront layout + per-page hero images.
-- Classic shops stay unchanged unless layout_template is set to 'tech'.

ALTER TABLE public.shop_storefront_config
  ADD COLUMN IF NOT EXISTS layout_template TEXT,
  ADD COLUMN IF NOT EXISTS hero_home_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_about_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_services_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_promotions_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_contact_url TEXT;

ALTER TABLE public.shop_storefront_config
  DROP CONSTRAINT IF EXISTS shop_storefront_config_layout_template;
ALTER TABLE public.shop_storefront_config
  ADD CONSTRAINT shop_storefront_config_layout_template
  CHECK (layout_template IS NULL OR layout_template IN ('classic', 'tech'));
