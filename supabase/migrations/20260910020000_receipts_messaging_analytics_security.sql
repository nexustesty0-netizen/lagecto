-- LaGecto: receipts, POS integrity, messaging permissions, platform analytics,
-- weekend Stebo reports, email uniqueness, inventory locking.
-- Timezone for all calendar periods: Africa/Harare (Bulawayo).

-- ============================================================
-- IDENTITY
-- ============================================================
UPDATE public.users SET email = lower(trim(email)) WHERE email IS NOT NULL AND email <> lower(trim(email));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
      ON public.users (lower(email))
      WHERE email IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');
  full_name TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', '')), '');
  phone TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  normalized_email TEXT := lower(trim(COALESCE(NEW.email, '')));
BEGIN
  IF normalized_email <> '' AND EXISTS (
    SELECT 1 FROM public.users WHERE lower(email) = normalized_email AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'An account with this email already exists';
  END IF;
  IF uname IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users
    WHERE username_normalized = public.normalize_username(uname) AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'This username is already taken';
  END IF;

  INSERT INTO public.users (id, email, name, phone, username, username_normalized, role)
  VALUES (
    NEW.id,
    NULLIF(normalized_email, ''),
    full_name,
    phone,
    uname,
    public.normalize_username(uname),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- RECEIPT COUNTERS + BRANDING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_receipt_counters (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  last_n INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shop_receipt_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_counters_admin ON public.shop_receipt_counters;
CREATE POLICY receipt_counters_admin ON public.shop_receipt_counters FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_receipt_template_check;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_receipt_template_check
  CHECK (receipt_template IS NULL OR receipt_template IN ('classic', 'modern', 'minimal', 'premium', 'compact'));

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
  candidate TEXT;
  stamp TEXT := to_char((NOW() AT TIME ZONE 'Africa/Harare'), 'YYYYMM');
BEGIN
  INSERT INTO public.shop_receipt_counters (shop_id, last_n)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO UPDATE
    SET last_n = public.shop_receipt_counters.last_n + 1,
        updated_at = NOW()
  RETURNING last_n INTO n;

  candidate := 'R-' || stamp || '-' || lpad(n::text, 5, '0');
  WHILE EXISTS (
    SELECT 1 FROM public.receipts WHERE shop_id = p_shop_id AND receipt_number = candidate
  ) LOOP
    n := n + 1;
    UPDATE public.shop_receipt_counters SET last_n = n, updated_at = NOW() WHERE shop_id = p_shop_id;
    candidate := 'R-' || stamp || '-' || lpad(n::text, 5, '0');
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_receipt_snapshot(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shops%ROWTYPE;
  cfg public.shop_storefront_config%ROWTYPE;
  custom JSONB;
  template TEXT;
BEGIN
  SELECT * INTO s FROM public.shops WHERE id = p_shop_id;
  IF s.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT * INTO cfg FROM public.shop_storefront_config WHERE shop_id = p_shop_id;
  custom := COALESCE(s.receipt_customization, '{}'::jsonb);
  template := COALESCE(NULLIF(custom->>'template', ''), NULLIF(s.receipt_template, ''), 'classic');
  IF template NOT IN ('classic', 'modern', 'minimal', 'premium', 'compact') THEN
    template := 'classic';
  END IF;
  RETURN jsonb_build_object(
    'kind', 'shop',
    'name', s.name,
    'address', s.address,
    'phone', COALESCE(s.phone, s.whatsapp_number),
    'email', s.email,
    'logo_url', s.logo_url,
    'shop_id', s.login_shop_id,
    'slug', s.slug,
    'template', template,
    'primary', COALESCE(NULLIF(custom->>'primary', ''), cfg.primary_color, '#0B6E4F'),
    'secondary', COALESCE(NULLIF(custom->>'secondary', ''), cfg.secondary_color, '#2E8B57'),
    'accent', COALESCE(NULLIF(custom->>'accent', ''), cfg.accent_color, '#D4AF37'),
    'background', COALESCE(NULLIF(custom->>'background', ''), cfg.background_color, '#FFFDF8'),
    'header', COALESCE(NULLIF(custom->>'header', ''), s.receipt_header),
    'footer', COALESCE(NULLIF(custom->>'footerMessage', ''), NULLIF(custom->>'footer', ''), s.receipt_footer),
    'header_layout', COALESCE(NULLIF(custom->>'headerLayout', ''), 'centered'),
    'size', COALESCE(NULLIF(custom->>'size', ''), 'a4'),
    'show_logo', COALESCE((custom->>'showLogo')::boolean, TRUE),
    'show_contact', COALESCE((custom->>'showContact')::boolean, TRUE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enrich_receipt_shop_details()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.shop_id IS NOT NULL THEN
    NEW.shop_details := public.shop_receipt_snapshot(NEW.shop_id) || COALESCE(NEW.shop_details, '{}'::jsonb);
    NEW.shop_details := jsonb_set(NEW.shop_details, '{kind}', '"shop"');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_receipt_shop_details ON public.receipts;
CREATE TRIGGER trg_enrich_receipt_shop_details
BEFORE INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.enrich_receipt_shop_details();

-- ============================================================
-- INVENTORY LOCKING
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_product_stock(
  p_product_id UUID,
  p_shop_id UUID,
  p_qty INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  next_stock INTEGER;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be at least 1');
  END IF;
  SELECT * INTO product_row
  FROM public.products
  WHERE id = p_product_id AND shop_id = p_shop_id
  FOR UPDATE;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid product');
  END IF;
  IF product_row.type <> 'product' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'product_id', product_row.id);
  END IF;
  IF COALESCE(product_row.stock, 0) < p_qty THEN
    RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
  END IF;
  next_stock := product_row.stock - p_qty;
  UPDATE public.products SET stock = next_stock, updated_at = NOW() WHERE id = product_row.id;
  INSERT INTO public.inventory_transactions (
    shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
  ) VALUES (
    p_shop_id, product_row.id, 'sold', -p_qty, product_row.stock, next_stock, auth.uid()
  );
  RETURN jsonb_build_object('ok', true, 'previous', product_row.stock, 'remaining', next_stock);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id UUID, p_delta INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  next_stock INTEGER;
BEGIN
  SELECT * INTO product_row FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(product_row.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  next_stock := GREATEST(COALESCE(product_row.stock, 0) + COALESCE(p_delta, 0), 0);
  UPDATE public.products SET stock = next_stock, updated_at = NOW() WHERE id = product_row.id;
  INSERT INTO public.inventory_transactions (
    shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
  ) VALUES (
    product_row.shop_id, product_row.id, 'adjustment', COALESCE(p_delta, 0), product_row.stock, next_stock, auth.uid()
  );
  RETURN jsonb_build_object('ok', true, 'stock', next_stock);
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_order_inventory(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  item JSONB;
  product_row public.products%ROWTYPE;
  qty INTEGER;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF ord.inventory_restocked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  IF ord.status NOT IN ('completed', 'refunded') AND ord.payment_status NOT IN ('refunded', 'partially_refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order has not consumed inventory');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid FOR UPDATE;
    IF product_row.id IS NOT NULL AND product_row.type = 'product' THEN
      UPDATE public.products SET stock = COALESCE(stock, 0) + qty, updated_at = NOW() WHERE id = product_row.id;
      INSERT INTO public.inventory_transactions (
        shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
      ) VALUES (
        ord.shop_id, product_row.id, 'return', qty, product_row.stock, COALESCE(product_row.stock, 0) + qty, auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.orders SET inventory_restocked_at = NOW() WHERE id = ord.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'checkout',
  ADD COLUMN IF NOT EXISTS inventory_restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inventory_consumed_at TIMESTAMPTZ;

-- ============================================================
-- POS SALE (cash completes; inventory locked; promotions applied)
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_pos_sale(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_customer_name TEXT DEFAULT NULL
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
  sale_id UUID;
  receipt_id UUID;
  receipt_no TEXT;
  period UUID;
  sale_no TEXT;
  method TEXT;
  pricing JSONB;
  unit_price NUMERIC;
  consumed JSONB;
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item');
  END IF;

  method := public.normalize_payment_method(p_payment_method);
  IF method IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose a valid payment method');
  END IF;
  IF method <> 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Electronic POS payments must be started as a pending checkout');
  END IF;
  IF NOT public.shop_accepts_payment_method(p_shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;

  period := public.current_financial_period_id(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id
    FOR UPDATE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid product');
    END IF;
    IF product_row.type = 'product' AND COALESCE(product_row.stock, 0) < qty THEN
      RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    list_subtotal := list_subtotal + (product_row.price * qty);
    discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
    charged_total := charged_total + (unit_price * qty);
    profit := profit + ((unit_price - COALESCE(product_row.cost, 0)) * qty);
  END LOOP;

  sale_no := 'S-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.sales (
    shop_id, period_id, sale_number, customer_name, subtotal, discount, total, profit,
    payment_method, status, completed_by_user_id
  ) VALUES (
    p_shop_id, period, sale_no, NULLIF(trim(p_customer_name), ''),
    list_subtotal, discount_total, charged_total, profit, method, 'completed', auth.uid()
  )
  RETURNING id INTO sale_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES (sale_id, product_row.id, product_row.name, qty, unit_price, COALESCE(product_row.cost, 0), unit_price * qty);
    consumed := public.consume_product_stock(product_row.id, p_shop_id, qty);
    IF consumed->>'ok' = 'false' THEN
      RAISE EXCEPTION '%', consumed->>'error';
    END IF;
  END LOOP;

  receipt_no := public.next_receipt_number(p_shop_id);
  INSERT INTO public.receipts (
    shop_id, sale_id, period_id, receipt_number, customer_name,
    subtotal, discount, total, payment_method, payment_status, shop_details
  ) VALUES (
    p_shop_id, sale_id, period, receipt_no, NULLIF(trim(p_customer_name), ''),
    list_subtotal, discount_total, charged_total, method, 'paid', '{}'::jsonb
  )
  RETURNING id INTO receipt_id;

  INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT receipt_id, si.product_id, si.product_name, si.quantity, si.unit_price, si.total_price
  FROM public.sale_items si WHERE si.sale_id = sale_id;

  RETURN jsonb_build_object(
    'ok', true,
    'sale_id', sale_id,
    'receipt_id', receipt_id,
    'total', charged_total,
    'subtotal', list_subtotal,
    'discount', discount_total,
    'sale_number', sale_no,
    'payment_status', 'paid'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.place_pos_order(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT,
  p_customer_name TEXT DEFAULT NULL,
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
  unit_price NUMERIC;
  pricing JSONB;
  order_id UUID;
  period UUID;
  built_items JSONB := '[]'::jsonb;
  order_no TEXT;
  method TEXT;
  shop_currency TEXT;
  customer_row public.users%ROWTYPE;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item');
  END IF;
  method := public.normalize_payment_method(p_payment_method);
  IF method IS NULL OR method = 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Use the cash sale path for cash payments');
  END IF;
  IF NOT public.shop_accepts_payment_method(p_shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO customer_row FROM public.users WHERE id = p_customer_id AND role = 'customer';
    IF customer_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Customer account not found');
    END IF;
  END IF;

  SELECT currency INTO shop_currency FROM public.shops WHERE id = p_shop_id;
  period := public.current_financial_period_id(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id AND is_available = TRUE
    FOR UPDATE;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid product');
    END IF;
    IF product_row.type = 'product' AND COALESCE(product_row.stock, 0) < qty THEN
      RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
    END IF;
    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);
    list_subtotal := list_subtotal + (product_row.price * qty);
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

  order_no := public.next_order_number();
  INSERT INTO public.orders (
    order_number, shop_id, customer_id, period_id, customer_name, customer_email, customer_phone,
    items, subtotal, discount, total, status, payment_method, payment_status, currency, notes, source
  ) VALUES (
    order_no, p_shop_id, customer_row.id, period,
    COALESCE(NULLIF(trim(p_customer_name), ''), customer_row.name, 'Walk-in'),
    customer_row.email, customer_row.phone,
    built_items, list_subtotal, discount_total, list_subtotal - discount_total,
    'pending', method, 'pending', COALESCE(shop_currency, 'USD'), 'POS electronic checkout', 'pos'
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

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'order_number', order_no,
    'total', list_subtotal - discount_total,
    'subtotal', list_subtotal,
    'discount', discount_total,
    'payment_status', 'pending'
  );
END;
$$;

-- Shop owners may start provider checkout for POS-created orders.
CREATE OR REPLACE FUNCTION public.create_order_payment(
  p_order_id UUID,
  p_payment_method TEXT,
  p_idempotency_key TEXT,
  p_provider TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  ord public.orders%ROWTYPE;
  method TEXT;
  provider TEXT;
  existing public.payments%ROWTYPE;
  paid public.payments%ROWTYPE;
  payment_id UUID;
  attempt_id UUID;
  amount NUMERIC;
  fail_count INTEGER;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);

  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;

  method := public.normalize_payment_method(p_payment_method);
  IF method IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsupported payment method');
  END IF;

  provider := CASE
    WHEN method = 'cash' THEN 'cash'
    WHEN lower(COALESCE(p_provider, 'sandbox')) IN ('sandbox', 'paynow') THEN lower(p_provider)
    ELSE NULL
  END;
  IF provider IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unsupported payment provider');
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF ord.customer_id IS DISTINCT FROM uid
     AND NOT public.is_platform_admin()
     AND NOT public.user_owns_shop(ord.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF ord.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order cannot be paid');
  END IF;
  IF NOT public.shop_accepts_payment_method(ord.shop_id, method) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop does not accept that payment method');
  END IF;

  amount := public.order_authoritative_total(ord.id);
  IF amount <= 0 OR amount IS DISTINCT FROM ord.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order total could not be verified');
  END IF;

  SELECT * INTO paid FROM public.payments
  WHERE order_id = ord.id AND status = 'paid'
  LIMIT 1;
  IF paid.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order is already paid', 'payment_id', paid.id);
  END IF;

  SELECT * INTO existing FROM public.payments
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', existing.id,
      'status', existing.status,
      'amount', existing.amount,
      'currency', existing.currency,
      'payment_method', existing.payment_method,
      'payment_provider', existing.payment_provider,
      'browser_url', existing.browser_url,
      'reused', true
    );
  END IF;

  SELECT * INTO existing FROM public.payments
  WHERE order_id = ord.id
    AND payment_method = method
    AND status IN ('pending', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', existing.id,
      'status', existing.status,
      'amount', existing.amount,
      'currency', existing.currency,
      'payment_method', existing.payment_method,
      'payment_provider', existing.payment_provider,
      'browser_url', existing.browser_url,
      'reused', true
    );
  END IF;

  SELECT COUNT(*) INTO fail_count
  FROM public.payment_attempts
  WHERE order_id = ord.id
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '15 minutes';

  INSERT INTO public.payments (
    order_id, shop_id, customer_id, period_id, payment_method, payment_provider,
    amount, currency, status, idempotency_key, review_reason
  ) VALUES (
    ord.id, ord.shop_id, ord.customer_id, ord.period_id, method, provider,
    amount, COALESCE(NULLIF(ord.currency, ''), 'USD'),
    'pending',
    left(p_idempotency_key, 120),
    CASE WHEN fail_count >= 5 THEN 'Repeated payment failures on this order' ELSE NULL END
  )
  RETURNING id INTO payment_id;

  IF fail_count >= 5 THEN
    UPDATE public.payments SET status = 'review_required' WHERE id = payment_id;
    UPDATE public.orders SET payment_status = 'review_required' WHERE id = ord.id;
  ELSE
    UPDATE public.orders
    SET payment_method = method, payment_status = 'pending'
    WHERE id = ord.id;
  END IF;

  INSERT INTO public.payment_attempts (
    payment_id, order_id, shop_id, idempotency_key, payment_method, payment_provider,
    amount, currency, status
  ) VALUES (
    payment_id, ord.id, ord.shop_id, left(p_idempotency_key, 120), method, provider,
    amount, COALESCE(NULLIF(ord.currency, ''), 'USD'), 'created'
  )
  RETURNING id INTO attempt_id;

  PERFORM public.log_payment_event(
    'PAYMENT_CREATED', payment_id, ord.id, ord.shop_id, uid,
    jsonb_build_object('method', method, 'provider', provider, 'amount', amount, 'currency', ord.currency)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', payment_id,
    'attempt_id', attempt_id,
    'status', CASE WHEN fail_count >= 5 THEN 'review_required' ELSE 'pending' END,
    'amount', amount,
    'currency', COALESCE(NULLIF(ord.currency, ''), 'USD'),
    'payment_method', method,
    'payment_provider', provider,
    'order_id', ord.id,
    'order_number', ord.order_number,
    'shop_id', ord.shop_id,
    'review_required', fail_count >= 5
  );
END;
$$;

-- Lock stock when completing orders; fail instead of going negative.
CREATE OR REPLACE FUNCTION public.complete_shop_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  item JSONB;
  sale_id UUID;
  receipt_id UUID;
  period UUID;
  profit NUMERIC := 0;
  product_row public.products%ROWTYPE;
  consumed JSONB;
  qty INTEGER;
  unit_price NUMERIC;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  SELECT * INTO ord FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(ord.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF ord.status IN ('completed', 'cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This order can no longer be completed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE order_id = ord.id) AND ord.payment_status <> 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Confirm payment before completing this order');
  END IF;

  period := COALESCE(ord.period_id, public.current_financial_period_id(ord.shop_id));

  IF ord.inventory_consumed_at IS NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
    LOOP
      qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
      SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid;
      IF product_row.id IS NOT NULL THEN
        consumed := public.consume_product_stock(product_row.id, ord.shop_id, qty);
        IF consumed->>'ok' = 'false' THEN
          RETURN consumed;
        END IF;
        unit_price := COALESCE((item->>'price')::numeric, product_row.price);
        profit := profit + ((unit_price - COALESCE(product_row.cost, 0)) * qty);
      END IF;
    END LOOP;
    UPDATE public.orders SET inventory_consumed_at = NOW() WHERE id = ord.id;
  END IF;

  UPDATE public.orders
  SET status = 'completed', completed_at = NOW(), period_id = period
  WHERE id = ord.id;

  UPDATE public.sales
  SET profit = COALESCE(profit, 0),
      completed_by_user_id = COALESCE(completed_by_user_id, auth.uid())
  WHERE order_id = ord.id
  RETURNING id INTO sale_id;

  SELECT id INTO receipt_id FROM public.receipts WHERE order_id = ord.id LIMIT 1;

  IF sale_id IS NULL THEN
    INSERT INTO public.sales (
      shop_id, order_id, period_id, sale_number, customer_id, customer_name,
      subtotal, discount, total, profit, payment_method, status, completed_by_user_id
    ) VALUES (
      ord.shop_id, ord.id, period, replace(ord.order_number, 'LG-', 'S-'),
      ord.customer_id, ord.customer_name, ord.subtotal, COALESCE(ord.discount, 0), ord.total, profit,
      COALESCE(ord.payment_method, 'cash'), 'completed', auth.uid()
    )
    RETURNING id INTO sale_id;

    INSERT INTO public.receipts (
      shop_id, sale_id, order_id, customer_id, period_id, receipt_number,
      customer_name, customer_email, customer_phone, subtotal, discount, total, payment_method,
      payment_status, shop_details
    )
    SELECT
      ord.shop_id, sale_id, ord.id, ord.customer_id, period, public.next_receipt_number(ord.shop_id),
      ord.customer_name, ord.customer_email, ord.customer_phone, ord.subtotal, COALESCE(ord.discount, 0), ord.total,
      COALESCE(ord.payment_method, 'cash'), COALESCE(ord.payment_status, 'paid'),
      '{}'::jsonb
    RETURNING id INTO receipt_id;

    INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
    SELECT receipt_id, (i->>'product_id')::uuid, i->>'name', (i->>'quantity')::int, (i->>'price')::numeric,
           (i->>'price')::numeric * (i->>'quantity')::int
    FROM jsonb_array_elements(ord.items) i;
  END IF;

  IF ord.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (ord.customer_id, 'Order completed', 'Order ' || ord.order_number || ' is complete.', 'order', COALESCE(receipt_id, ord.id));
  END IF;

  RETURN jsonb_build_object('ok', true, 'sale_id', sale_id, 'receipt_id', receipt_id);
END;
$$;

-- Restock when a cash refund is fully completed.
CREATE OR REPLACE FUNCTION public.complete_cash_refund(p_refund_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  ref public.payment_refunds%ROWTYPE;
  pay public.payments%ROWTYPE;
  new_status TEXT;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  SELECT * INTO ref FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF ref.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Refund not found');
  END IF;
  IF ref.refund_kind <> 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This is not a cash refund');
  END IF;
  IF NOT (public.user_owns_shop(ref.shop_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO pay FROM public.payments WHERE id = ref.payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;

  new_status := CASE WHEN ref.amount >= pay.amount THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE public.payment_refunds
  SET status = 'completed', completed_at = NOW(), authorized_by = COALESCE(authorized_by, uid)
  WHERE id = ref.id;

  UPDATE public.payments SET status = new_status WHERE id = pay.id;
  UPDATE public.orders SET payment_status = new_status, status = CASE WHEN new_status = 'refunded' THEN 'refunded' ELSE status END
  WHERE id = pay.order_id;
  UPDATE public.sales SET status = CASE WHEN new_status = 'refunded' THEN 'refunded' ELSE status END
  WHERE order_id = pay.order_id;

  IF new_status = 'refunded' THEN
    PERFORM public.restock_order_inventory(pay.order_id);
  END IF;

  PERFORM public.log_payment_event(
    'PAYMENT_REFUNDED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('refund_id', ref.id, 'kind', 'cash', 'amount', ref.amount)
  );

  RETURN jsonb_build_object('ok', true, 'status', new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_receipt_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_receipt_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_product_stock(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_order_inventory(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pos_sale(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_pos_order(UUID, JSONB, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shop_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cash_refund(UUID) TO authenticated;
