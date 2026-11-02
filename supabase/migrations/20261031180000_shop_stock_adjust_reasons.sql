-- Record inventory reasons, keep stock at or above zero, and map
-- restock / damage / return onto the existing transaction types.

DROP FUNCTION IF EXISTS public.adjust_product_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.adjust_product_stock(UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_delta INTEGER,
  p_reason TEXT DEFAULT 'adjustment',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  next_stock INTEGER;
  delta INTEGER := COALESCE(p_delta, 0);
  reason TEXT := lower(btrim(COALESCE(p_reason, 'adjustment')));
  tx_type TEXT := 'adjustment';
BEGIN
  IF delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must not be zero.');
  END IF;

  SELECT * INTO product_row FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  IF product_row.type IS DISTINCT FROM 'product' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Services do not keep stock.');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_manages_shop(product_row.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  next_stock := COALESCE(product_row.stock, 0) + delta;
  IF next_stock < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stock cannot go below zero.');
  END IF;

  IF reason IN ('restock', 'received') THEN
    tx_type := 'received';
    reason := 'restock';
  ELSIF reason IN ('returned', 'return') THEN
    tx_type := 'returned';
    reason := 'returned';
  ELSIF reason = 'damaged' THEN
    tx_type := 'damaged';
  ELSIF reason = 'sold' THEN
    tx_type := 'sold';
  ELSE
    tx_type := 'adjustment';
    reason := 'adjustment';
  END IF;

  UPDATE public.products
  SET stock = next_stock, updated_at = NOW()
  WHERE id = product_row.id;

  INSERT INTO public.inventory_transactions (
    shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, reason, notes, created_by
  ) VALUES (
    product_row.shop_id,
    product_row.id,
    tx_type,
    delta,
    product_row.stock,
    next_stock,
    reason,
    NULLIF(left(btrim(COALESCE(p_notes, '')), 400), ''),
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'stock', next_stock, 'previous', product_row.stock);
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER, TEXT, TEXT) TO authenticated;
