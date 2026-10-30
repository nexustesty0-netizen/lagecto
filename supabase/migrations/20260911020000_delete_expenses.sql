-- Allow authorized deletion of current-period shop expenses and LaGecto platform expenses.

CREATE OR REPLACE FUNCTION public.delete_shop_expense(p_expense_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.shop_expenses%ROWTYPE;
  period UUID;
BEGIN
  SELECT * INTO rec FROM public.shop_expenses WHERE id = p_expense_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
  END IF;
  IF NOT public.user_owns_shop(rec.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(rec.shop_id, 'expenses') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expenses are not available for this shop');
  END IF;
  SELECT id INTO period FROM public.financial_periods
  WHERE shop_id = rec.shop_id AND is_current = TRUE LIMIT 1;
  IF rec.period_id IS DISTINCT FROM period THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Archived period records are read-only');
  END IF;
  DELETE FROM public.shop_expenses WHERE id = rec.id;
  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_platform_expense(p_expense_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  DELETE FROM public.platform_expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_expense_id, 'deleted', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_shop_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_platform_expense(UUID) TO authenticated;
