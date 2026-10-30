-- Fix plpgsql variable "profit" colliding with sales.profit on sale edits.

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

GRANT EXECUTE ON FUNCTION public.update_shop_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;
