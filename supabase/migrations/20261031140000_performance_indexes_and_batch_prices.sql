-- Query-backed indexes and one round-trip catalog pricing.
-- Patterns: POS/sales by shop+date, staff lookup by user_id, storefront slug,
-- promotions for product_effective_price, unread shop alerts.

CREATE INDEX IF NOT EXISTS idx_sales_shop_date
  ON public.sales (shop_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_shop_period_date
  ON public.sales (shop_id, period_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_shop_status_date
  ON public.sales (shop_id, status, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_shop_staff_user
  ON public.shop_staff_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_shop_staff_shop
  ON public.shop_staff_assignments (shop_id);

CREATE INDEX IF NOT EXISTS idx_shop_notifications_unread
  ON public.shop_notifications (shop_id, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_shop_customer
  ON public.orders (shop_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_shop_sale
  ON public.receipts (shop_id, sale_id);

CREATE INDEX IF NOT EXISTS idx_financial_periods_current
  ON public.financial_periods (shop_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_promotions_shop_product
  ON public.promotions (shop_id, product_id, created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_shop_type_available
  ON public.products (shop_id, type)
  WHERE is_available = TRUE;

CREATE OR REPLACE FUNCTION public.product_prices_for_ids(p_product_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '[]'::jsonb;
  pid UUID;
  priced JSONB;
BEGIN
  IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
    RETURN result;
  END IF;
  FOR pid IN
    SELECT DISTINCT x
    FROM unnest(p_product_ids[1:200]) AS x
    WHERE x IS NOT NULL
  LOOP
    priced := public.product_effective_price(pid);
    IF priced->>'ok' = 'true' THEN
      result := result || jsonb_build_array(priced);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.product_prices_for_ids(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_prices_for_ids(UUID[]) TO anon, authenticated, service_role;
