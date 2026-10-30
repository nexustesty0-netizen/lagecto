-- Any active assigned package verifies the shop. Manual verification UI is no longer used.

CREATE OR REPLACE FUNCTION public.sync_shop_verification(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  paid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND s.renewal_date >= CURRENT_DATE
  ) INTO paid;
  PERFORM set_config('lagecto.allow_verification_sync', 'true', true);
  UPDATE public.shops
  SET verification_status = CASE WHEN paid THEN 'verified' ELSE
    CASE WHEN verification_status = 'verified' THEN 'unverified' ELSE verification_status END
  END
  WHERE id = p_shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_is_verified(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.shop_id = p_shop_id
      AND s.status IN ('active', 'trial')
      AND s.renewal_date >= CURRENT_DATE
  );
END;
$$;
