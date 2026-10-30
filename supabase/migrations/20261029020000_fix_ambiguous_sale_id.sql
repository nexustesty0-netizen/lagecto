-- Fix plpgsql variable names that collided with sale_id / receipt_id columns.
CREATE OR REPLACE FUNCTION public.complete_shop_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  item JSONB;
  v_sale_id UUID;
  v_receipt_id UUID;
  period UUID;
  profit NUMERIC := 0;
  product_row public.products%ROWTYPE;
  consumed JSONB;
  qty INTEGER;
  unit_price NUMERIC;
  line_name TEXT;
  line_product UUID;
  already_done BOOLEAN := FALSE;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(ord.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF ord.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order can no longer be completed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE order_id = ord.id) AND ord.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirm payment before completing this order');
  END IF;

  period := COALESCE(ord.period_id, public.current_financial_period_id(ord.shop_id));
  already_done := ord.status = 'completed';

  IF NOT already_done THEN
    IF ord.inventory_consumed_at IS NULL AND jsonb_typeof(ord.items) = 'array' THEN
      FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
      LOOP
        qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
        IF (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid;
          IF FOUND THEN
            consumed := public.consume_product_stock(product_row.id, ord.shop_id, qty);
            IF consumed->>'ok' = 'false' THEN
              RETURN consumed;
            END IF;
            unit_price := COALESCE((item->>'price')::numeric, (item->>'unit_price')::numeric, product_row.price);
            profit := profit + ((unit_price - COALESCE(product_row.cost, 0)) * qty);
          END IF;
        END IF;
      END LOOP;
      UPDATE public.orders SET inventory_consumed_at = NOW() WHERE id = ord.id;
    END IF;

    UPDATE public.orders
    SET
      status = 'completed',
      completed_at = NOW(),
      period_id = period,
      payment_status = CASE
        WHEN COALESCE(payment_method, '') = 'whatsapp' THEN 'paid'
        WHEN payment_status IS NULL OR payment_status = 'pending' THEN 'paid'
        ELSE payment_status
      END
    WHERE id = ord.id
    RETURNING * INTO ord;
  END IF;

  SELECT id INTO v_sale_id FROM public.sales WHERE order_id = ord.id LIMIT 1;
  IF v_sale_id IS NULL THEN
    INSERT INTO public.sales (
      shop_id, order_id, period_id, sale_number, customer_id, customer_name,
      subtotal, discount, total, profit, payment_method, status, completed_by_user_id, notes
    ) VALUES (
      ord.shop_id, ord.id, period, replace(ord.order_number, 'LG-', 'S-'),
      ord.customer_id, ord.customer_name, ord.subtotal, COALESCE(ord.discount, 0), ord.total, profit,
      COALESCE(ord.payment_method, 'whatsapp'), 'completed', auth.uid(),
      left(COALESCE(ord.notes, ''), 400)
    )
    RETURNING id INTO v_sale_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sale_items si WHERE si.sale_id = v_sale_id) AND jsonb_typeof(ord.items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
    LOOP
      qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
      unit_price := COALESCE((item->>'price')::numeric, (item->>'unit_price')::numeric, 0);
      line_name := COALESCE(NULLIF(item->>'name', ''), NULLIF(item->>'product_name', ''), 'Item');
      line_product := CASE
        WHEN (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (item->>'product_id')::uuid
        ELSE NULL
      END;
      INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
      VALUES (v_sale_id, line_product, line_name, qty, unit_price, 0, unit_price * qty);
    END LOOP;
  END IF;

  SELECT id INTO v_receipt_id FROM public.receipts WHERE order_id = ord.id LIMIT 1;
  IF v_receipt_id IS NULL THEN
    INSERT INTO public.receipts (
      shop_id, sale_id, order_id, customer_id, period_id, receipt_number,
      customer_name, customer_email, customer_phone, subtotal, discount, total, payment_method,
      payment_status, shop_details, notes
    )
    VALUES (
      ord.shop_id, v_sale_id, ord.id, ord.customer_id, period, public.next_receipt_number(ord.shop_id),
      ord.customer_name, ord.customer_email, ord.customer_phone, ord.subtotal, COALESCE(ord.discount, 0), ord.total,
      COALESCE(ord.payment_method, 'whatsapp'), 'paid',
      public.shop_receipt_snapshot(ord.shop_id),
      left(COALESCE(ord.notes, ''), 400)
    )
    RETURNING id INTO v_receipt_id;
  END IF;

  IF v_receipt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.receipt_items ri WHERE ri.receipt_id = v_receipt_id)
     AND jsonb_typeof(ord.items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
    LOOP
      qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
      unit_price := COALESCE((item->>'price')::numeric, (item->>'unit_price')::numeric, 0);
      line_name := COALESCE(NULLIF(item->>'name', ''), NULLIF(item->>'product_name', ''), 'Item');
      line_product := CASE
        WHEN (item->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (item->>'product_id')::uuid
        ELSE NULL
      END;
      INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
      VALUES (v_receipt_id, line_product, line_name, qty, unit_price, unit_price * qty);
    END LOOP;
  END IF;

  IF NOT already_done AND ord.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      ord.customer_id,
      'Order completed',
      'Order ' || ord.order_number || ' is complete. Your receipt is ready.',
      'order',
      COALESCE(v_receipt_id, ord.id)
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'sale_id', v_sale_id, 'receipt_id', v_receipt_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to complete this order: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_pos_sale(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_customer_name TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL,
  p_time_taken TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
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
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item or typed service');
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
      IF product_row.type = 'product' AND COALESCE(product_row.stock, 0) < qty THEN
        RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
      END IF;
      list_price := product_row.price;
      unit_price := COALESCE(
        NULLIF((item->>'unit_price')::numeric, 0),
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price
      );
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

  sale_no := 'S-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.sales (
    shop_id, period_id, sale_number, customer_id, customer_name, subtotal, discount, total, profit,
    payment_method, status, completed_by_user_id, cashier_name, time_taken, notes
  ) VALUES (
    p_shop_id, period, sale_no, p_customer_id, NULLIF(trim(p_customer_name), ''),
    list_subtotal, discount_total, charged_total, profit, method, 'completed', auth.uid(),
    NULLIF(left(trim(COALESCE(p_cashier_name, '')), 80), ''),
    NULLIF(left(trim(COALESCE(p_time_taken, '')), 40), ''),
    NULLIF(left(trim(COALESCE(p_notes, '')), 400), '')
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
        NULLIF((item->>'unit_price')::numeric, 0),
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price
      );
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
      VALUES (v_sale_id, product_row.id, line_name, qty, unit_price, COALESCE(product_row.cost, 0), unit_price * qty);
      consumed := public.consume_product_stock(product_row.id, p_shop_id, qty);
      IF consumed->>'ok' = 'false' THEN
        RAISE EXCEPTION '%', consumed->>'error';
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
    'payment_method', method
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to record this sale: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_shop_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pos_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

