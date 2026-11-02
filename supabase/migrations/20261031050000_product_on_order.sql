-- Products can be ready now, or available on order.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS availability TEXT NOT NULL DEFAULT 'available';

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_availability_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_availability_check
  CHECK (availability IN ('available', 'on_order'));

CREATE OR REPLACE FUNCTION public.product_qty_ok(
  p_type TEXT,
  p_availability TEXT,
  p_stock INTEGER,
  p_qty INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_type, 'product') IS DISTINCT FROM 'product'
    OR COALESCE(p_availability, 'available') = 'on_order'
    OR COALESCE(p_stock, 0) >= COALESCE(p_qty, 1);
$$;

CREATE OR REPLACE FUNCTION public.quote_customer_cart(
  p_shop_id UUID,
  p_items JSONB,
  p_promo_code TEXT DEFAULT NULL
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
  pricing JSONB;
  unit_price NUMERIC;
  lines JSONB := '[]'::jsonb;
  subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  promo JSONB;
  promo_discount NUMERIC := 0;
  free_delivery BOOLEAN := FALSE;
  allowed BOOLEAN;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop is not available');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A product in your cart is no longer available');
    END IF;
    allowed := public.product_qty_ok(product_row.type, product_row.availability, product_row.stock, qty);
    IF NOT allowed THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', product_row.name || ' does not have enough stock',
        'product_id', product_row.id
      );
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    subtotal := subtotal + (product_row.price * qty);
    discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'quantity', qty,
      'list_price', product_row.price,
      'unit_price', unit_price,
      'line_total', unit_price * qty,
      'availability', COALESCE(product_row.availability, 'available'),
      'in_stock', allowed
    ));
  END LOOP;

  IF NULLIF(trim(COALESCE(p_promo_code, '')), '') IS NOT NULL THEN
    promo := public.validate_promo_code(p_promo_code, p_shop_id, p_items, FALSE);
    IF promo->>'ok' = 'false' THEN
      RETURN promo;
    END IF;
    promo_discount := COALESCE((promo->>'discount')::numeric, 0);
    free_delivery := COALESCE((promo->>'free_delivery')::boolean, FALSE);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'items', lines,
    'subtotal', subtotal,
    'discount', discount_total + promo_discount,
    'promotion_discount', discount_total,
    'promo_discount', promo_discount,
    'promo_code', CASE WHEN promo ? 'code' THEN promo->>'code' ELSE NULL END,
    'promo_name', promo->>'name',
    'free_delivery', free_delivery,
    'total', GREATEST(0, subtotal - discount_total - promo_discount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_customer_cart(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_qty_ok(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.place_customer_order(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'whatsapp',
  p_notes TEXT DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  profile public.users%ROWTYPE;
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
  subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  line_total NUMERIC;
  unit_price NUMERIC;
  pricing JSONB;
  order_id UUID;
  period UUID;
  built_items JSONB := '[]'::jsonb;
  order_no TEXT;
  method TEXT;
  shop_currency TEXT;
  promo JSONB;
  promo_discount NUMERIC := 0;
  free_delivery BOOLEAN := FALSE;
  promo_id UUID;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);

  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT * INTO profile FROM public.users WHERE id = uid;
  IF profile.role <> 'customer' OR profile.account_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only active customers can place orders');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop is not available');
  END IF;

  method := COALESCE(public.normalize_payment_method(p_payment_method), 'whatsapp');
  IF method <> 'whatsapp' AND NOT public.shop_accepts_payment_method(p_shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;
  method := 'whatsapp';

  SELECT currency INTO shop_currency FROM public.shops WHERE id = p_shop_id;
  period := public.current_financial_period_id(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A product in your cart is no longer available');
    END IF;
    IF NOT public.product_qty_ok(product_row.type, product_row.availability, product_row.stock, qty) THEN
      RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    line_total := unit_price * qty;
    subtotal := subtotal + (product_row.price * qty);
    discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
    built_items := built_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'quantity', qty,
      'list_price', product_row.price,
      'price', unit_price,
      'line_total', line_total,
      'availability', COALESCE(product_row.availability, 'available'),
      'promotion_id', pricing->>'promotion_id'
    ));
  END LOOP;

  IF NULLIF(trim(COALESCE(p_promo_code, '')), '') IS NOT NULL THEN
    PERFORM set_config('lagecto.allow_promo_lock', 'true', true);
    promo := public.validate_promo_code(p_promo_code, p_shop_id, p_items, TRUE);
    IF promo->>'ok' = 'false' THEN
      RETURN promo;
    END IF;
    promo_discount := COALESCE((promo->>'discount')::numeric, 0);
    free_delivery := COALESCE((promo->>'free_delivery')::boolean, FALSE);
    promo_id := (promo->>'promo_code_id')::uuid;
  END IF;

  order_no := public.next_order_number();
  INSERT INTO public.orders (
    order_number, shop_id, customer_id, period_id, customer_name, customer_email, customer_phone,
    items, subtotal, discount, total, status, payment_method, payment_status, currency, notes,
    promo_code_id, promo_discount, free_delivery
  ) VALUES (
    order_no, p_shop_id, uid, period, profile.name, profile.email, profile.phone,
    built_items, subtotal, discount_total + promo_discount,
    GREATEST(0, subtotal - discount_total - promo_discount),
    'pending', method, 'pending', COALESCE(shop_currency, 'USD'),
    left(COALESCE(p_notes, ''), 400),
    promo_id, promo_discount, free_delivery
  )
  RETURNING id INTO order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(built_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, shop_id, product_name, quantity, unit_price)
    VALUES (
      order_id,
      (item->>'product_id')::uuid,
      p_shop_id,
      item->>'name',
      (item->>'quantity')::int,
      (item->>'price')::numeric
    );
  END LOOP;

  IF promo_id IS NOT NULL THEN
    INSERT INTO public.promo_redemptions (promo_code_id, user_id, shop_id, order_id, discount_amount, status)
    VALUES (promo_id, uid, p_shop_id, order_id, promo_discount, 'applied');
    UPDATE public.promo_codes SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = promo_id;
    UPDATE public.reward_claims
    SET status = 'used', used_order_id = order_id, used_at = NOW()
    WHERE promo_code_id = promo_id AND user_id = uid AND status = 'claimed';
  END IF;

  INSERT INTO public.shop_notifications (shop_id, title, message, type)
  VALUES (
    p_shop_id,
    'New order',
    'Order ' || order_no || ' was placed. Arrange payment with the customer on WhatsApp.',
    'order'
  );

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (
    uid,
    'Order placed',
    'Your order ' || order_no || ' is pending. Open WhatsApp to arrange payment with the shop.',
    'order',
    order_id
  );

  INSERT INTO public.marketplace_events (event_type, user_id, shop_id, query)
  VALUES ('purchase', uid, p_shop_id, order_no);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'order_number', order_no,
    'shop_id', p_shop_id,
    'items', built_items,
    'subtotal', subtotal,
    'discount', discount_total + promo_discount,
    'promo_discount', promo_discount,
    'total', GREATEST(0, subtotal - discount_total - promo_discount),
    'currency', COALESCE(shop_currency, 'USD'),
    'payment_method', method,
    'payment_status', 'pending',
    'status', 'pending',
    'free_delivery', free_delivery
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_customer_order(UUID, JSONB, TEXT, TEXT, TEXT) TO authenticated;
