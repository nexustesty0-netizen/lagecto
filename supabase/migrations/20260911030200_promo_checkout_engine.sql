-- Promo validation, checkout integration, founding campaign, shop badges, refunds.

CREATE OR REPLACE FUNCTION public.normalize_promo_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(trim(COALESCE(p_code, '')), '\s+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.compute_promo_discount(
  p_discount_type TEXT,
  p_percent_off NUMERIC,
  p_amount_off NUMERIC,
  p_max_discount NUMERIC,
  p_eligible_subtotal NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  amount NUMERIC := 0;
BEGIN
  IF COALESCE(p_eligible_subtotal, 0) <= 0 THEN
    RETURN 0;
  END IF;
  IF p_discount_type = 'percent' THEN
    amount := round(p_eligible_subtotal * COALESCE(p_percent_off, 0) / 100.0, 2);
    IF p_max_discount IS NOT NULL THEN
      amount := LEAST(amount, p_max_discount);
    END IF;
  ELSIF p_discount_type = 'fixed' THEN
    amount := COALESCE(p_amount_off, 0);
  ELSE
    amount := 0;
  END IF;
  amount := LEAST(GREATEST(amount, 0), p_eligible_subtotal);
  RETURN amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_is_new_to_shop(p_user_id UUID, p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = p_user_id
      AND o.shop_id = p_shop_id
      AND o.status = 'completed'
      AND COALESCE(o.payment_status, 'paid') NOT IN ('failed', 'cancelled', 'refunded')
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code TEXT,
  p_shop_id UUID,
  p_items JSONB,
  p_lock BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  code TEXT := public.normalize_promo_code(p_code);
  promo public.promo_codes%ROWTYPE;
  used_total INTEGER := 0;
  used_customer INTEGER := 0;
  merchandise NUMERIC := 0;
  eligible NUMERIC := 0;
  discount NUMERIC := 0;
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
  unit_price NUMERIC;
  pricing JSONB;
  is_service BOOLEAN;
  product_ok BOOLEAN;
  customer_ok BOOLEAN := TRUE;
  wallet public.loyalty_wallets%ROWTYPE;
  level_rank INTEGER := 0;
  required_rank INTEGER := 0;
  rate_ok BOOLEAN;
BEGIN
  IF code IS NULL OR code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a promo code.');
  END IF;
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing shop.');
  END IF;

  IF uid IS NOT NULL THEN
    rate_ok := public.check_auth_rate_limit('promo:' || uid::text, 25, 300);
    IF rate_ok IS FALSE THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Too many promo attempts. Try again in a few minutes.');
    END IF;
  END IF;

  IF p_lock AND current_setting('lagecto.allow_promo_lock', true) IS DISTINCT FROM 'true' THEN
    p_lock := FALSE;
  END IF;

  IF p_lock THEN
    SELECT * INTO promo FROM public.promo_codes pc WHERE pc.code = code FOR UPDATE;
  ELSE
    SELECT * INTO promo FROM public.promo_codes pc WHERE pc.code = code;
  END IF;

  IF promo.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Promo code is invalid.');
  END IF;
  IF promo.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This promo code is not active.');
  END IF;
  IF promo.starts_at IS NOT NULL AND promo.starts_at > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This promo code is not active yet.');
  END IF;
  IF promo.ends_at IS NOT NULL AND promo.ends_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This promo code has expired.');
  END IF;
  IF promo.owner_scope = 'shop' AND promo.shop_id <> p_shop_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code cannot be used at this shop.');
  END IF;
  IF promo.owner_scope = 'platform'
     AND cardinality(promo.eligible_shop_ids) > 0
     AND NOT (p_shop_id = ANY (promo.eligible_shop_ids)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code is not valid at this shop.');
  END IF;

  SELECT COUNT(*) INTO used_total FROM public.promo_redemptions WHERE promo_code_id = promo.id AND status = 'applied';
  IF promo.total_usage_limit IS NOT NULL AND used_total >= promo.total_usage_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This promo code has reached its usage limit.');
  END IF;

  IF uid IS NOT NULL THEN
    SELECT COUNT(*) INTO used_customer
    FROM public.promo_redemptions
    WHERE promo_code_id = promo.id AND user_id = uid AND status = 'applied';
    IF promo.per_customer_limit IS NOT NULL AND used_customer >= promo.per_customer_limit THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You have already used this promo code.');
    END IF;
  END IF;

  IF cardinality(promo.eligible_customer_ids) > 0 THEN
    IF uid IS NULL OR NOT (uid = ANY (promo.eligible_customer_ids)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You are not eligible for this promo code.');
    END IF;
  END IF;

  IF promo.customer_segment = 'new' THEN
    IF uid IS NULL OR NOT public.customer_is_new_to_shop(uid, p_shop_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This code is for first-time customers of this shop.');
    END IF;
  ELSIF promo.customer_segment = 'existing' THEN
    IF uid IS NULL OR public.customer_is_new_to_shop(uid, p_shop_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This code is for returning customers.');
    END IF;
  ELSIF promo.customer_segment IN ('loyalty', 'level') OR promo.loyalty_only OR promo.required_loyalty_level_id IS NOT NULL THEN
    IF uid IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Sign in to use this loyalty promo.');
    END IF;
    SELECT * INTO wallet FROM public.loyalty_wallets
    WHERE user_id = uid AND (
      (promo.owner_scope = 'platform' AND scope = 'platform')
      OR (promo.shop_id IS NOT NULL AND shop_id = promo.shop_id)
    )
    ORDER BY CASE WHEN scope = 'platform' THEN 0 ELSE 1 END
    LIMIT 1;
    IF wallet.id IS NULL OR wallet.lifetime_points <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This code is for loyalty members.');
    END IF;
    IF promo.required_loyalty_level_id IS NOT NULL THEN
      SELECT COALESCE(l.rank, 0) INTO required_rank FROM public.loyalty_levels l WHERE l.id = promo.required_loyalty_level_id;
      SELECT COALESCE(l.rank, 0) INTO level_rank FROM public.loyalty_levels l WHERE l.id = wallet.level_id;
      IF level_rank < required_rank THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Your loyalty level is not eligible for this code.');
      END IF;
    END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A product in your cart is no longer available');
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    merchandise := merchandise + (unit_price * qty);
    is_service := product_row.type = 'service';
    product_ok := TRUE;
    IF cardinality(promo.eligible_product_ids) > 0 OR cardinality(promo.eligible_service_ids) > 0 THEN
      product_ok := FALSE;
      IF NOT is_service AND cardinality(promo.eligible_product_ids) > 0 AND product_row.id = ANY (promo.eligible_product_ids) THEN
        product_ok := TRUE;
      END IF;
      IF is_service AND cardinality(promo.eligible_service_ids) > 0 AND product_row.id = ANY (promo.eligible_service_ids) THEN
        product_ok := TRUE;
      END IF;
    END IF;
    IF product_ok THEN
      eligible := eligible + (unit_price * qty);
    END IF;
  END LOOP;

  IF eligible <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code does not apply to the items in your cart.');
  END IF;
  IF merchandise < COALESCE(promo.min_order_amount, 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code requires a higher order amount.');
  END IF;

  discount := public.compute_promo_discount(
    promo.discount_type, promo.percent_off, promo.amount_off, promo.max_discount, eligible
  );

  RETURN jsonb_build_object(
    'ok', true,
    'promo_code_id', promo.id,
    'code', promo.code,
    'name', promo.name,
    'description', promo.description,
    'discount_type', promo.discount_type,
    'discount', discount,
    'free_delivery', promo.discount_type = 'free_delivery',
    'shop_id', p_shop_id
  );
END;
$$;

-- Recreate quote + checkout with optional promo code.
DROP FUNCTION IF EXISTS public.quote_customer_cart(UUID, JSONB);
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
    IF product_row.type = 'product' AND product_row.stock < qty THEN
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
      'in_stock', CASE WHEN product_row.type = 'service' THEN TRUE ELSE product_row.stock >= qty END
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

DROP FUNCTION IF EXISTS public.place_customer_order(UUID, JSONB, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.place_customer_order(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
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

  method := public.normalize_payment_method(p_payment_method);
  IF method IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose a valid payment method');
  END IF;
  IF NOT public.shop_accepts_payment_method(p_shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;

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
    IF product_row.type = 'product' AND product_row.stock < qty THEN
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
  VALUES (p_shop_id, 'New order', 'Order ' || order_no || ' was placed.', 'order');

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (uid, 'Order placed', 'Your order ' || order_no || ' was submitted.', 'order', order_id);

  INSERT INTO public.marketplace_events (event_type, user_id, shop_id, query)
  VALUES ('purchase', uid, p_shop_id, order_no);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'order_number', order_no,
    'subtotal', subtotal,
    'discount', discount_total + promo_discount,
    'promo_discount', promo_discount,
    'total', GREATEST(0, subtotal - discount_total - promo_discount),
    'currency', COALESCE(shop_currency, 'USD'),
    'payment_method', method,
    'payment_status', 'pending',
    'free_delivery', free_delivery
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_customer_cart(UUID, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_customer_order(UUID, JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT, UUID, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_promo_discount(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_customer_engagement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_promo_code(TEXT) TO anon, authenticated;
