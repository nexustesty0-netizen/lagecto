-- Shop-owned privacy policy and terms for each storefront.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
  ADD COLUMN IF NOT EXISTS terms_of_service TEXT;
