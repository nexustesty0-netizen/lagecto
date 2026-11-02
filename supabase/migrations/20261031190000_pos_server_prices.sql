-- POS: server catalogue prices, cashier-safe stock, sale idempotency, authorised extra discount.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_idempotency_uidx
  ON public.sales (shop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.pos_recorded_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'sale_id', s.id,
    'receipt_id', r.id,
    'receipt_number', r.receipt_number,
    'total', s.total,
    'subtotal', s.subtotal,
    'discount', s.discount,
    'sale_number', s.sale_number,
    'payment_status', COALESCE(r.payment_status, 'paid'),
    'payment_method', s.payment_method,
    'replayed', true
  )
  FROM public.sales s
  LEFT JOIN public.receipts r ON r.sale_id = s.id
  WHERE s.id = p_sale_id
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.record_pos_sale(UUID, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.record_pos_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.record_pos_sale(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_customer_name TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL,
  p_time_taken TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_extra_discount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
  list_subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  charged_total NUMERIC := 0;
  extra NUMERIC := 0;
  profit NUMERIC := 0;
  v_sale_id UUID;
  v_receipt_id UUID;
  receipt_no TEXT;
  period UUID;
  sale_no TEXT;
  method TEXT;
  unit_price NUMERIC;
  list_price NUMERIC;
  consumed JSONB;
  line_name TEXT;
  line_product UUID;
  snapshot JSONB;
  v_key TEXT;
  v_on_order BOOLEAN;
  replay JSONB;
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item or typed service');
  END IF;

  v_key := NULLIF(left(btrim(COALESCE(p_idempotency_key, '')), 80), '');
  IF v_key IS NOT NULL THEN
    SELECT s.id INTO v_sale_id
    FROM public.sales s
    WHERE s.shop_id = p_shop_id AND s.idempotency_key = v_key;
    IF v_sale_id IS NOT NULL THEN
      replay := public.pos_recorded_sale(v_sale_id);
      IF replay IS NOT NULL THEN
        RETURN replay;
      END IF;
    END IF;
  END IF;

  method := public.normalize_pos_payment_method(p_payment_method);
  period := public.current_financial_period_id(p_shop_id);
  snapshot := public.shop_receipt_snapshot(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    line_name := left(trim(COALESCE(item->>'name', item->>'product_name', '')), 120);
    line_product := CASE
      WHEN (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (item->>'product_id')::uuid
      ELSE NULL
    END;
    product_row := NULL;
    IF line_product IS NOT NULL THEN
      SELECT * INTO product_row FROM public.products
      WHERE id = line_product AND shop_id = p_shop_id
      FOR UPDATE;
      IF NOT FOUND THEN
        product_row := NULL;
      END IF;
    END IF;
    IF product_row.id IS NOT NULL THEN
      IF product_row.is_available IS DISTINCT FROM TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' is not for sale');
      END IF;
      v_on_order := COALESCE(product_row.availability, 'available') = 'on_order';
      IF product_row.type = 'product' AND NOT v_on_order AND COALESCE(product_row.stock, 0) < qty THEN
        RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
      END IF;
      list_price := COALESCE(product_row.price, 0);
      unit_price := COALESCE(
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price,
        0
      );
      IF unit_price < 0 THEN
        unit_price := 0;
      END IF;
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      list_subtotal := list_subtotal + (list_price * qty);
      discount_total := discount_total + GREATEST(list_price - unit_price, 0) * qty;
      charged_total := charged_total + (unit_price * qty);
      profit := profit + ((unit_price - COALESCE(product_row.cost, 0)) * qty);
    ELSE
      IF line_name = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Type a service or item name');
      END IF;
      unit_price := COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0);
      IF unit_price < 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Price cannot be negative');
      END IF;
      list_subtotal := list_subtotal + (unit_price * qty);
      charged_total := charged_total + (unit_price * qty);
    END IF;
  END LOOP;

  extra := GREATEST(0, COALESCE(p_extra_discount, 0));
  IF extra > 0 AND NOT public.user_manages_shop(p_shop_id) THEN
    extra := 0;
  END IF;
  extra := LEAST(extra, charged_total);
  extra := round(extra, 2);
  discount_total := discount_total + extra;
  charged_total := charged_total - extra;
  profit := profit - extra;

  sale_no := 'S-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.sales (
    shop_id, period_id, sale_number, customer_id, customer_name, subtotal, discount, total, profit,
    payment_method, status, completed_by_user_id, cashier_name, time_taken, notes, idempotency_key
  ) VALUES (
    p_shop_id, period, sale_no, p_customer_id, NULLIF(trim(p_customer_name), ''),
    list_subtotal, discount_total, charged_total, profit, method, 'completed', auth.uid(),
    NULLIF(left(trim(COALESCE(p_cashier_name, '')), 80), ''),
    NULLIF(left(trim(COALESCE(p_time_taken, '')), 40), ''),
    NULLIF(left(trim(COALESCE(p_notes, '')), 400), ''),
    v_key
  )
  RETURNING id INTO v_sale_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    line_name := left(trim(COALESCE(item->>'name', item->>'product_name', '')), 120);
    line_product := CASE
      WHEN (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (item->>'product_id')::uuid
      ELSE NULL
    END;
    product_row := NULL;
    IF line_product IS NOT NULL THEN
      SELECT * INTO product_row FROM public.products WHERE id = line_product AND shop_id = p_shop_id;
      IF NOT FOUND THEN
        product_row := NULL;
      END IF;
    END IF;
    IF product_row.id IS NOT NULL THEN
      unit_price := COALESCE(
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price,
        0
      );
      IF unit_price < 0 THEN
        unit_price := 0;
      END IF;
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
      VALUES (v_sale_id, product_row.id, line_name, qty, unit_price, COALESCE(product_row.cost, 0), unit_price * qty);
      v_on_order := COALESCE(product_row.availability, 'available') = 'on_order';
      IF product_row.type = 'product' AND NOT (v_on_order AND COALESCE(product_row.stock, 0) < qty) THEN
        consumed := public.consume_product_stock(product_row.id, p_shop_id, qty);
        IF consumed->>'ok' = 'false' THEN
          RAISE EXCEPTION '%', consumed->>'error';
        END IF;
      END IF;
    ELSE
      unit_price := COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0);
      INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
      VALUES (v_sale_id, NULL, line_name, qty, unit_price, 0, unit_price * qty);
    END IF;
  END LOOP;

  receipt_no := public.next_receipt_number(p_shop_id);
  INSERT INTO public.receipts (
    shop_id, sale_id, period_id, receipt_number, customer_name, customer_id,
    subtotal, discount, total, payment_method, payment_status, shop_details,
    cashier_name, time_taken, notes
  ) VALUES (
    p_shop_id, v_sale_id, period, receipt_no, NULLIF(trim(p_customer_name), ''), p_customer_id,
    list_subtotal, discount_total, charged_total, method, 'paid', snapshot,
    NULLIF(left(trim(COALESCE(p_cashier_name, '')), 80), ''),
    NULLIF(left(trim(COALESCE(p_time_taken, '')), 40), ''),
    NULLIF(left(trim(COALESCE(p_notes, '')), 400), '')
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT v_receipt_id, si.product_id, si.product_name, si.quantity, si.unit_price, si.total_price
  FROM public.sale_items si WHERE si.sale_id = v_sale_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sale_id', v_sale_id,
    'receipt_id', v_receipt_id,
    'receipt_number', receipt_no,
    'total', charged_total,
    'subtotal', list_subtotal,
    'discount', discount_total,
    'sale_number', sale_no,
    'payment_status', 'paid',
    'payment_method', method,
    'replayed', false
  );
EXCEPTION
  WHEN unique_violation THEN
    IF v_key IS NOT NULL THEN
      SELECT s.id INTO v_sale_id
      FROM public.sales s
      WHERE s.shop_id = p_shop_id AND s.idempotency_key = v_key;
      IF v_sale_id IS NOT NULL THEN
        replay := public.pos_recorded_sale(v_sale_id);
        IF replay IS NOT NULL THEN
          RETURN replay;
        END IF;
      END IF;
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Unable to record this sale: duplicate record');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unable to record this sale: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
