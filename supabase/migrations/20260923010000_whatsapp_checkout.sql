-- Marketplace checkout is WhatsApp-only for now.
-- Online payment method values stay in the schema for a future release.

CREATE OR REPLACE FUNCTION public.normalize_payment_method(p_method TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_method, '')))
    WHEN 'visa' THEN 'visa'
    WHEN 'mastercard' THEN 'mastercard'
    WHEN 'ecocash' THEN 'ecocash'
    WHEN 'cash' THEN 'cash'
    WHEN 'whatsapp' THEN 'whatsapp'
    ELSE NULL
  END;
$$;

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
  -- Marketplace checkout records WhatsApp arrangement. Do not create a payments row.
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
      'line_total', line_total,
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

UPDATE public.faq_categories
SET name = 'Payments',
    description = 'Checkout via WhatsApp. Payment is arranged directly with the shop.'
WHERE slug = 'payments';

UPDATE public.faq_entries SET answer = 'Open Sign up, enter your name, email and a password, then confirm. Customers can browse shops without an account. Sign in to checkout via WhatsApp so LaGecto can record the order.'
WHERE question = 'How do I create a LaGecto account?';

UPDATE public.faq_entries SET answer = 'Open a shop or product, add it to your cart, then checkout via WhatsApp. LaGecto records a pending order. Payment is arranged directly with the shop — LaGecto does not collect it.'
WHERE question = 'How do I purchase a product?';

UPDATE public.faq_entries SET answer = 'Checkout is via WhatsApp. LaGecto records the order; you arrange payment directly with the shop. In-person till sales at a shop remain cash. Online card collection is not available in this version.'
WHERE question = 'What payment methods are supported?';

UPDATE public.faq_entries SET answer = 'Customers do not pay by card inside LaGecto. Place the order, then arrange payment with the shop on WhatsApp.'
WHERE question = 'How does card payment work?';

UPDATE public.faq_entries SET answer = 'Customers do not pay through an EcoCash checkout inside LaGecto. After you place the order, the shop will tell you on WhatsApp how they prefer to be paid.'
WHERE question = 'How does EcoCash payment work?';

UPDATE public.faq_entries SET answer = 'In-person shop till sales are cash. Marketplace orders are paid however you and the shop agree on WhatsApp. LaGecto does not collect that payment.'
WHERE question = 'Can I pay cash?';

UPDATE public.faq_entries SET answer = 'LaGecto does not process customer checkout payments. If WhatsApp did not open, return to the order and use Continue on WhatsApp, or contact the shop from its page.'
WHERE question = 'What happens if a payment fails?';

UPDATE public.help_articles
SET title = 'Checkout via WhatsApp',
    summary = 'LaGecto records the order. Payment is arranged directly with the shop.',
    body = $b$1. Confirm the shop is still open and the items are in stock.
2. Sign in, then place the order from your cart. Totals come from the shop, not figures typed in the browser.
3. WhatsApp opens with the order details so you can confirm and arrange payment with the shop.
4. If the cart has items from more than one shop, checkout separately for each shop.
5. LaGecto does not collect or verify the payment.

Still stuck? Contact Support with the order number if you have one.$b$
WHERE slug = 'checkout-problems';

UPDATE public.about_content
SET body = replace(
  body,
  'pay with methods each shop accepts',
  'checkout via WhatsApp and arrange payment with the shop'
)
WHERE slug = 'about-lagecto';

UPDATE public.about_content
SET body = replace(
  body,
  'LaGecto provides the marketplace, accounts, payments coordination, and platform tools such as Stebo.',
  'LaGecto provides the marketplace, accounts, and platform tools such as Stebo. Marketplace payment is arranged directly between customer and shop through WhatsApp.'
)
WHERE slug = 'about-lagecto';

UPDATE public.legal_document_versions
SET content = replace(
  content,
  'Payment methods depend on each shop’s configuration (for example cash or EcoCash). Failed payments do not complete an order. Refunds follow the shop and payment status already recorded in LaGecto.',
  'Marketplace checkout is via WhatsApp. LaGecto records the order; payment is arranged directly between the customer and the shop. LaGecto does not collect or verify customer checkout payments.'
)
WHERE document_slug = 'terms';

UPDATE public.legal_document_versions
SET content = replace(
  content,
  'Orders store items, totals, status, payment method and related identifiers. Payment providers may process card or EcoCash details according to their own terms; LaGecto stores payment status and references, not your PIN.',
  'Orders store items, totals, status and related identifiers. Marketplace payment is arranged on WhatsApp with the shop. LaGecto does not process those payments.'
)
WHERE document_slug = 'privacy';
