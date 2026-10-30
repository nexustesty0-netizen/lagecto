-- Let shop owners wipe the current period's expenses or sales and start from zero.
-- Archived periods stay read-only.

CREATE OR REPLACE FUNCTION public.clear_shop_expenses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_period UUID;
  n INTEGER := 0;
BEGIN
  SELECT s.id INTO v_shop_id
  FROM public.shops s
  WHERE public.user_owns_shop(s.id)
  LIMIT 1;
  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(v_shop_id, 'expenses') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expenses are not available for this shop');
  END IF;
  SELECT id INTO v_period FROM public.financial_periods
  WHERE shop_id = v_shop_id AND is_current = TRUE
  LIMIT 1;
  IF v_period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;
  DELETE FROM public.shop_expenses WHERE shop_id = v_shop_id AND period_id = v_period;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', n);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_shop_sales()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_period UUID;
  rec public.sales%ROWTYPE;
  n INTEGER := 0;
BEGIN
  SELECT s.id INTO v_shop_id
  FROM public.shops s
  WHERE public.user_owns_shop(s.id)
  LIMIT 1;
  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT id INTO v_period FROM public.financial_periods
  WHERE shop_id = v_shop_id AND is_current = TRUE
  LIMIT 1;
  IF v_period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;

  FOR rec IN
    SELECT * FROM public.sales
    WHERE shop_id = v_shop_id AND period_id = v_period
    FOR UPDATE
  LOOP
    PERFORM public.restore_sale_stock(rec.id);
    DELETE FROM public.receipts WHERE sale_id = rec.id;
    IF rec.order_id IS NOT NULL THEN
      UPDATE public.orders
      SET
        status = CASE WHEN status = 'completed' THEN 'pending' ELSE status END,
        payment_status = CASE WHEN payment_status = 'paid' THEN 'pending' ELSE payment_status END,
        inventory_consumed_at = NULL,
        updated_at = NOW()
      WHERE id = rec.order_id;
    END IF;
    n := n + 1;
  END LOOP;

  DELETE FROM public.sales WHERE shop_id = v_shop_id AND period_id = v_period;
  RETURN jsonb_build_object('ok', true, 'deleted', n);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to clear sales: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_platform_expenses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  DELETE FROM public.platform_expenses;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_shop_expenses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_shop_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_platform_expenses() TO authenticated;
