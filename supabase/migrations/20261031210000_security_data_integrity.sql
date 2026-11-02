-- Phase 10: never trust client catalogue prices, foreign product IDs, or non-customer links.

CREATE OR REPLACE FUNCTION public.trusted_customer_id(p_customer_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_customer_id IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_customer_id AND u.role = 'customer'
    ) THEN p_customer_id
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.clamp_custom_ticket_price(p_price NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_price IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Price cannot be negative';
  END IF;
  IF p_price > 1000000 THEN
    RAISE EXCEPTION 'Price is too large';
  END IF;
  RETURN round(p_price, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_linked_customer_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.customer_id := public.trusted_customer_id(NEW.customer_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_sanitize_customer ON public.sales;
CREATE TRIGGER sales_sanitize_customer
  BEFORE INSERT OR UPDATE OF customer_id ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_linked_customer_id();

DROP TRIGGER IF EXISTS receipts_sanitize_customer ON public.receipts;
CREATE TRIGGER receipts_sanitize_customer
  BEFORE INSERT OR UPDATE OF customer_id ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_linked_customer_id();

DROP TRIGGER IF EXISTS quotations_sanitize_customer ON public.quotations;
CREATE TRIGGER quotations_sanitize_customer
  BEFORE INSERT OR UPDATE OF customer_id ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_linked_customer_id();

ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_unit_price_max;
ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_unit_price_max CHECK (unit_price >= 0 AND unit_price <= 1000000) NOT VALID;

ALTER TABLE public.receipt_items DROP CONSTRAINT IF EXISTS receipt_items_unit_price_max;
ALTER TABLE public.receipt_items
  ADD CONSTRAINT receipt_items_unit_price_max CHECK (unit_price >= 0 AND unit_price <= 1000000) NOT VALID;

ALTER TABLE public.quotation_items DROP CONSTRAINT IF EXISTS quotation_items_unit_price_max;
ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_unit_price_max CHECK (unit_price >= 0 AND unit_price <= 1000000) NOT VALID;

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT
  USING (
    is_available = TRUE
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.status = 'active'
    )
  );

DROP FUNCTION IF EXISTS public.parse_shop_ticket_items(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.parse_shop_ticket_items(
  p_shop_id UUID,
  p_items JSONB,
  p_lock_catalog_price BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  quantity INTEGER,
  unit_price NUMERIC,
  unit_cost NUMERIC,
  list_price NUMERIC,
  total_price NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  item JSONB;
  qty INTEGER;
  line_name TEXT;
  line_product UUID;
  product_row public.products%ROWTYPE;
  price NUMERIC;
  catalog_list NUMERIC;
  catalog_unit NUMERIC;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one item';
  END IF;
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
        RAISE EXCEPTION 'One of the items is not sold by this shop';
      END IF;
    END IF;
    IF product_row.id IS NOT NULL THEN
      catalog_list := COALESCE(product_row.price, 0);
      catalog_unit := COALESCE(
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price,
        0
      );
      IF p_lock_catalog_price THEN
        price := catalog_unit;
      ELSE
        price := COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, catalog_unit);
      END IF;
      price := public.clamp_custom_ticket_price(price);
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      RETURN QUERY SELECT product_row.id, line_name, qty, price, COALESCE(product_row.cost, 0), catalog_list, price * qty;
    ELSE
      IF line_name = '' THEN
        RAISE EXCEPTION 'Type a service or item name';
      END IF;
      price := public.clamp_custom_ticket_price(
        COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0)
      );
      RETURN QUERY SELECT NULL::uuid, line_name, qty, price, 0::numeric, price, price * qty;
    END IF;
  END LOOP;
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
  v_customer UUID;
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item or typed service');
  END IF;

  v_customer := public.trusted_customer_id(p_customer_id);
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
        RETURN jsonb_build_object('ok', false, 'error', 'One of the items is not sold by this shop');
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
      unit_price := public.clamp_custom_ticket_price(GREATEST(unit_price, 0));
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      list_subtotal := list_subtotal + (list_price * qty);
      discount_total := discount_total + GREATEST(list_price - unit_price, 0) * qty;
      charged_total := charged_total + (unit_price * qty);
      profit := profit + ((unit_price - COALESCE(product_row.cost, 0)) * qty);
    ELSE
      IF line_name = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Type a service or item name');
      END IF;
      unit_price := public.clamp_custom_ticket_price(
        COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0)
      );
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
    p_shop_id, period, sale_no, v_customer, NULLIF(trim(p_customer_name), ''),
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
        RETURN jsonb_build_object('ok', false, 'error', 'One of the items is not sold by this shop');
      END IF;
    END IF;
    IF product_row.id IS NOT NULL THEN
      unit_price := public.clamp_custom_ticket_price(GREATEST(COALESCE(
        (public.product_effective_price(product_row.id)->>'unit_price')::numeric,
        product_row.price,
        0
      ), 0));
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
      unit_price := public.clamp_custom_ticket_price(
        COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0)
      );
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
    p_shop_id, v_sale_id, period, receipt_no, NULLIF(trim(p_customer_name), ''), v_customer,
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

CREATE OR REPLACE FUNCTION public.upsert_shop_quotation(p_shop_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.quotations%ROWTYPE;
  payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  quote_id UUID;
  fmt TEXT;
  st TEXT;
  ticket RECORD;
  list_subtotal NUMERIC := 0;
  charged_total NUMERIC := 0;
  snapshot JSONB;
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  quote_id := CASE
    WHEN (payload->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (payload->>'id')::uuid
    ELSE NULL
  END;
  fmt := CASE lower(trim(COALESCE(payload->>'format', 'formal')))
    WHEN 'proposal' THEN 'proposal'
    WHEN 'estimate' THEN 'estimate'
    WHEN 'letterhead' THEN 'letterhead'
    WHEN 'quick' THEN 'quick'
    ELSE 'formal'
  END;
  st := CASE lower(trim(COALESCE(payload->>'status', 'draft')))
    WHEN 'sent' THEN 'sent'
    WHEN 'accepted' THEN 'accepted'
    WHEN 'declined' THEN 'declined'
    WHEN 'expired' THEN 'expired'
    ELSE 'draft'
  END;
  snapshot := public.shop_receipt_snapshot(p_shop_id);
  snapshot := jsonb_set(snapshot, '{template}', to_jsonb(public.quotation_layout(fmt)));

  IF quote_id IS NOT NULL THEN
    SELECT * INTO rec FROM public.quotations WHERE id = quote_id AND shop_id = p_shop_id FOR UPDATE;
    IF rec.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Quotation not found');
    END IF;
  ELSE
    INSERT INTO public.quotations (
      shop_id, quote_number, format, status, created_by, shop_details
    ) VALUES (
      p_shop_id, public.next_quotation_number(p_shop_id), fmt, st, auth.uid(), snapshot
    )
    RETURNING * INTO rec;
    quote_id := rec.id;
  END IF;

  DELETE FROM public.quotation_items WHERE quotation_id = rec.id;
  FOR ticket IN SELECT * FROM public.parse_shop_ticket_items(p_shop_id, COALESCE(payload->'items', '[]'::jsonb), FALSE)
  LOOP
    list_subtotal := list_subtotal + ticket.total_price;
    charged_total := charged_total + ticket.total_price;
    INSERT INTO public.quotation_items (quotation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (rec.id, ticket.product_id, ticket.product_name, ticket.quantity, ticket.unit_price, ticket.total_price);
  END LOOP;

  UPDATE public.quotations SET
    customer_id = CASE
      WHEN (payload->>'customer_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.trusted_customer_id((payload->>'customer_id')::uuid)
      ELSE customer_id
    END,
    customer_name = NULLIF(trim(payload->>'customer_name'), ''),
    customer_email = NULLIF(trim(payload->>'customer_email'), ''),
    customer_phone = NULLIF(trim(payload->>'customer_phone'), ''),
    format = fmt,
    status = st,
    valid_until = NULLIF(payload->>'valid_until', '')::date,
    notes = NULLIF(left(trim(COALESCE(payload->>'notes', '')), 800), ''),
    subtotal = list_subtotal,
    discount = 0,
    tax = 0,
    total = charged_total,
    shop_details = snapshot,
    updated_at = NOW()
  WHERE id = rec.id
  RETURNING * INTO rec;

  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'quote_number', rec.quote_number, 'total', rec.total, 'status', rec.status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to save this quotation: ' || SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.trusted_customer_id(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clamp_custom_ticket_price(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_shop_ticket_items(UUID, JSONB, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pos_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_shop_quotation(UUID, JSONB) TO authenticated;
