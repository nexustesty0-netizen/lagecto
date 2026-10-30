-- Shop quotations plus mistake-correction for POS sales, receipts, and notifications.

CREATE TABLE IF NOT EXISTS public.shop_quotation_counters (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  last_n INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shop_quotation_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quotation_counters_admin ON public.shop_quotation_counters;
CREATE POLICY quotation_counters_admin ON public.shop_quotation_counters FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  format TEXT NOT NULL DEFAULT 'formal'
    CHECK (format IN ('formal', 'proposal', 'estimate', 'letterhead', 'quick')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
  valid_until DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  shop_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotations_shop ON public.quotations (shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_owner ON public.quotations;
CREATE POLICY quotations_owner ON public.quotations FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS quotation_items_owner ON public.quotation_items;
CREATE POLICY quotation_items_owner ON public.quotation_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id AND (public.is_platform_admin() OR public.user_owns_shop(q.shop_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id AND (public.is_platform_admin() OR public.user_owns_shop(q.shop_id))
    )
  );

DROP POLICY IF EXISTS receipt_items_update ON public.receipt_items;
CREATE POLICY receipt_items_update ON public.receipt_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id AND (public.is_platform_admin() OR public.user_owns_shop(r.shop_id))
    )
  );

DROP POLICY IF EXISTS receipt_items_delete ON public.receipt_items;
CREATE POLICY receipt_items_delete ON public.receipt_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id AND (public.is_platform_admin() OR public.user_owns_shop(r.shop_id))
    )
  );

DROP POLICY IF EXISTS receipts_delete ON public.receipts;
CREATE POLICY receipts_delete ON public.receipts FOR DELETE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE OR REPLACE FUNCTION public.next_quotation_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
  candidate TEXT;
  stamp TEXT := to_char((NOW() AT TIME ZONE 'Africa/Harare'), 'YYYYMM');
BEGIN
  INSERT INTO public.shop_quotation_counters (shop_id, last_n)
  VALUES (p_shop_id, 1)
  ON CONFLICT (shop_id) DO UPDATE
    SET last_n = public.shop_quotation_counters.last_n + 1,
        updated_at = NOW()
  RETURNING last_n INTO n;

  candidate := 'Q-' || stamp || '-' || lpad(n::text, 5, '0');
  WHILE EXISTS (
    SELECT 1 FROM public.quotations WHERE shop_id = p_shop_id AND quote_number = candidate
  ) LOOP
    n := n + 1;
    UPDATE public.shop_quotation_counters SET last_n = n, updated_at = NOW() WHERE shop_id = p_shop_id;
    candidate := 'Q-' || stamp || '-' || lpad(n::text, 5, '0');
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.quotation_layout(p_format TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_format, 'formal')))
    WHEN 'proposal' THEN 'modern'
    WHEN 'estimate' THEN 'minimal'
    WHEN 'letterhead' THEN 'premium'
    WHEN 'quick' THEN 'compact'
    ELSE 'classic'
  END;
$$;

CREATE OR REPLACE FUNCTION public.assert_current_period(p_shop_id UUID, p_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  period UUID;
BEGIN
  period := public.current_financial_period_id(p_shop_id);
  IF p_period_id IS DISTINCT FROM period THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Archived period records are read-only. Fix mistakes in the current period only.');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_sale_stock(p_sale_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.sale_items%ROWTYPE;
  product_row public.products%ROWTYPE;
  sale_row public.sales%ROWTYPE;
  next_stock INTEGER;
BEGIN
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id;
  IF sale_row.id IS NULL THEN
    RETURN;
  END IF;
  FOR rec IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    IF rec.product_id IS NULL THEN
      CONTINUE;
    END IF;
    SELECT * INTO product_row FROM public.products WHERE id = rec.product_id FOR UPDATE;
    IF product_row.id IS NULL OR product_row.type <> 'product' THEN
      CONTINUE;
    END IF;
    next_stock := COALESCE(product_row.stock, 0) + GREATEST(rec.quantity, 0);
    UPDATE public.products SET stock = next_stock, updated_at = NOW() WHERE id = product_row.id;
    INSERT INTO public.inventory_transactions (
      shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
    ) VALUES (
      sale_row.shop_id, product_row.id, 'returned', rec.quantity, product_row.stock, next_stock, auth.uid()
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.parse_shop_ticket_items(p_shop_id UUID, p_items JSONB)
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
  list_price NUMERIC;
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
        product_row := NULL;
      END IF;
    END IF;
    IF product_row.id IS NOT NULL THEN
      list_price := product_row.price;
      price := COALESCE(NULLIF((item->>'unit_price')::numeric, 0), product_row.price);
      line_name := COALESCE(NULLIF(line_name, ''), product_row.name);
      RETURN QUERY SELECT product_row.id, line_name, qty, price, COALESCE(product_row.cost, 0), list_price, price * qty;
    ELSE
      IF line_name = '' THEN
        RAISE EXCEPTION 'Type a service or item name';
      END IF;
      price := COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0);
      IF price < 0 THEN
        RAISE EXCEPTION 'Price cannot be negative';
      END IF;
      RETURN QUERY SELECT NULL::uuid, line_name, qty, price, 0::numeric, price, price * qty;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shop_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.sales%ROWTYPE;
  period_ok JSONB;
BEGIN
  SELECT * INTO rec FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sale not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(rec.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  period_ok := public.assert_current_period(rec.shop_id, rec.period_id);
  IF period_ok->>'ok' = 'false' THEN
    RETURN period_ok;
  END IF;

  PERFORM public.restore_sale_stock(rec.id);
  DELETE FROM public.receipts WHERE sale_id = rec.id;
  DELETE FROM public.sales WHERE id = rec.id;

  IF rec.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      status = CASE WHEN status = 'completed' THEN 'pending' ELSE status END,
      payment_status = CASE WHEN payment_status = 'paid' THEN 'pending' ELSE payment_status END,
      inventory_consumed_at = NULL,
      updated_at = NOW()
    WHERE id = rec.order_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'deleted', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to delete this sale: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_shop_sale(
  p_sale_id UUID,
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL,
  p_time_taken TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.sales%ROWTYPE;
  period_ok JSONB;
  ticket RECORD;
  list_subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  charged_total NUMERIC := 0;
  v_profit NUMERIC := 0;
  method TEXT;
  consumed JSONB;
  receipt_row public.receipts%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sale not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(rec.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  period_ok := public.assert_current_period(rec.shop_id, rec.period_id);
  IF period_ok->>'ok' = 'false' THEN
    RETURN period_ok;
  END IF;

  PERFORM public.restore_sale_stock(rec.id);
  DELETE FROM public.sale_items WHERE sale_id = rec.id;

  FOR ticket IN SELECT * FROM public.parse_shop_ticket_items(rec.shop_id, p_items)
  LOOP
    list_subtotal := list_subtotal + (ticket.list_price * ticket.quantity);
    discount_total := discount_total + GREATEST(ticket.list_price - ticket.unit_price, 0) * ticket.quantity;
    charged_total := charged_total + ticket.total_price;
    v_profit := v_profit + ((ticket.unit_price - ticket.unit_cost) * ticket.quantity);
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES (rec.id, ticket.product_id, ticket.product_name, ticket.quantity, ticket.unit_price, ticket.unit_cost, ticket.total_price);
    IF ticket.product_id IS NOT NULL THEN
      consumed := public.consume_product_stock(ticket.product_id, rec.shop_id, ticket.quantity);
      IF consumed->>'ok' = 'false' THEN
        RAISE EXCEPTION '%', consumed->>'error';
      END IF;
    END IF;
  END LOOP;

  method := public.normalize_pos_payment_method(COALESCE(NULLIF(trim(p_payment_method), ''), rec.payment_method, 'cash'));

  UPDATE public.sales SET
    customer_name = COALESCE(NULLIF(trim(p_customer_name), ''), rec.customer_name),
    customer_id = COALESCE(p_customer_id, rec.customer_id),
    subtotal = list_subtotal,
    discount = discount_total,
    total = charged_total,
    profit = v_profit,
    payment_method = method,
    cashier_name = COALESCE(NULLIF(left(trim(COALESCE(p_cashier_name, '')), 80), ''), rec.cashier_name),
    time_taken = COALESCE(NULLIF(left(trim(COALESCE(p_time_taken, '')), 40), ''), rec.time_taken),
    notes = COALESCE(NULLIF(left(trim(COALESCE(p_notes, '')), 400), ''), rec.notes),
    updated_at = NOW()
  WHERE id = rec.id
  RETURNING * INTO rec;

  FOR receipt_row IN SELECT * FROM public.receipts WHERE sale_id = rec.id
  LOOP
    DELETE FROM public.receipt_items WHERE receipt_id = receipt_row.id;
    INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
    SELECT receipt_row.id, si.product_id, si.product_name, si.quantity, si.unit_price, si.total_price
    FROM public.sale_items si WHERE si.sale_id = rec.id;
    UPDATE public.receipts SET
      customer_name = rec.customer_name,
      customer_email = COALESCE(NULLIF(trim(p_customer_email), ''), customer_email),
      customer_phone = COALESCE(NULLIF(trim(p_customer_phone), ''), customer_phone),
      subtotal = rec.subtotal,
      discount = rec.discount,
      total = rec.total,
      payment_method = rec.payment_method,
      cashier_name = rec.cashier_name,
      time_taken = rec.time_taken,
      notes = rec.notes
    WHERE id = receipt_row.id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'sale_id', rec.id, 'total', rec.total, 'receipt_id', (SELECT id FROM public.receipts WHERE sale_id = rec.id LIMIT 1));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to update this sale: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shop_receipt(p_receipt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.receipts%ROWTYPE;
  period_ok JSONB;
BEGIN
  SELECT * INTO rec FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Receipt not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(rec.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  period_ok := public.assert_current_period(rec.shop_id, rec.period_id);
  IF period_ok->>'ok' = 'false' THEN
    RETURN period_ok;
  END IF;
  IF rec.sale_id IS NOT NULL THEN
    RETURN public.delete_shop_sale(rec.sale_id);
  END IF;
  DELETE FROM public.receipts WHERE id = rec.id;
  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'deleted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_shop_receipt(
  p_receipt_id UUID,
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_cashier_name TEXT DEFAULT NULL,
  p_time_taken TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.receipts%ROWTYPE;
  period_ok JSONB;
  ticket RECORD;
  list_subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  charged_total NUMERIC := 0;
  method TEXT;
BEGIN
  SELECT * INTO rec FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Receipt not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(rec.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  period_ok := public.assert_current_period(rec.shop_id, rec.period_id);
  IF period_ok->>'ok' = 'false' THEN
    RETURN period_ok;
  END IF;

  IF rec.sale_id IS NOT NULL THEN
    RETURN public.update_shop_sale(
      rec.sale_id, p_items, p_customer_name, p_payment_method, p_cashier_name, p_time_taken, p_notes,
      rec.customer_id, p_customer_email, p_customer_phone
    );
  END IF;

  DELETE FROM public.receipt_items WHERE receipt_id = rec.id;
  FOR ticket IN SELECT * FROM public.parse_shop_ticket_items(rec.shop_id, p_items)
  LOOP
    list_subtotal := list_subtotal + (ticket.list_price * ticket.quantity);
    discount_total := discount_total + GREATEST(ticket.list_price - ticket.unit_price, 0) * ticket.quantity;
    charged_total := charged_total + ticket.total_price;
    INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (rec.id, ticket.product_id, ticket.product_name, ticket.quantity, ticket.unit_price, ticket.total_price);
  END LOOP;

  method := public.normalize_pos_payment_method(COALESCE(NULLIF(trim(p_payment_method), ''), rec.payment_method, 'cash'));
  UPDATE public.receipts SET
    customer_name = COALESCE(NULLIF(trim(p_customer_name), ''), rec.customer_name),
    customer_email = COALESCE(NULLIF(trim(p_customer_email), ''), rec.customer_email),
    customer_phone = COALESCE(NULLIF(trim(p_customer_phone), ''), rec.customer_phone),
    subtotal = list_subtotal,
    discount = discount_total,
    total = charged_total,
    payment_method = method,
    cashier_name = COALESCE(NULLIF(left(trim(COALESCE(p_cashier_name, '')), 80), ''), rec.cashier_name),
    time_taken = COALESCE(NULLIF(left(trim(COALESCE(p_time_taken, '')), 40), ''), rec.time_taken),
    notes = COALESCE(NULLIF(left(trim(COALESCE(p_notes, '')), 400), ''), rec.notes)
  WHERE id = rec.id;

  RETURN jsonb_build_object('ok', true, 'receipt_id', rec.id, 'total', charged_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to update this receipt: ' || SQLERRM);
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
  FOR ticket IN SELECT * FROM public.parse_shop_ticket_items(p_shop_id, COALESCE(payload->'items', '[]'::jsonb))
  LOOP
    list_subtotal := list_subtotal + ticket.total_price;
    charged_total := charged_total + ticket.total_price;
    INSERT INTO public.quotation_items (quotation_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (rec.id, ticket.product_id, ticket.product_name, ticket.quantity, ticket.unit_price, ticket.total_price);
  END LOOP;

  UPDATE public.quotations SET
    customer_id = CASE
      WHEN (payload->>'customer_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (payload->>'customer_id')::uuid
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

CREATE OR REPLACE FUNCTION public.delete_shop_quotation(p_quotation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.quotations%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quotation not found');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(rec.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  DELETE FROM public.quotations WHERE id = rec.id;
  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'deleted', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.parse_shop_ticket_items(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_quotation_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_layout(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_sale(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_shop_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_receipt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_shop_receipt(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_shop_quotation(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_quotation(UUID) TO authenticated;
