CREATE TABLE IF NOT EXISTS public.storefront_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  cover_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video')),
  media_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storefront_projects_shop
  ON public.storefront_projects (shop_id, sort_order, created_at DESC);

ALTER TABLE public.storefront_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_projects_read ON public.storefront_projects;
CREATE POLICY storefront_projects_read ON public.storefront_projects FOR SELECT
  USING (is_published = TRUE OR public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS storefront_projects_write ON public.storefront_projects;
CREATE POLICY storefront_projects_write ON public.storefront_projects FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
