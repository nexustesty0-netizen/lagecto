-- Security hardening: freeze privileged columns, split shop staff vs owner writes,
-- lock dangerous RPCs, and stop privilege escalation through RLS.

CREATE OR REPLACE FUNCTION public.user_manages_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_is_shop_owner(p_shop_id)
      OR COALESCE(public.shop_staff_role(p_shop_id), '') IN ('admin', 'manager');
$$;

CREATE OR REPLACE FUNCTION public.protect_user_security_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('lagecto.allow_security_update', true) = 'true' THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
  NEW.admin_role := OLD.admin_role;
  NEW.account_status := OLD.account_status;
  NEW.failed_login_attempts := OLD.failed_login_attempts;
  NEW.locked_at := OLD.locked_at;
  NEW.locked_reason := OLD.locked_reason;
  NEW.unlocked_at := OLD.unlocked_at;
  NEW.unlocked_by := OLD.unlocked_by;
  NEW.last_login_at := OLD.last_login_at;
  NEW.last_failed_login_at := OLD.last_failed_login_at;
  IF NEW.username_normalized IS DISTINCT FROM OLD.username_normalized
     OR NEW.last_username_change_at IS DISTINCT FROM OLD.last_username_change_at THEN
    NEW.username := OLD.username;
    NEW.username_normalized := OLD.username_normalized;
    NEW.last_username_change_at := OLD.last_username_change_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'customer' AND admin_role IS NULL);

CREATE OR REPLACE FUNCTION public.protect_shop_security_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('lagecto.allow_security_update', true) = 'true' THEN
    RETURN NEW;
  END IF;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.login_shop_id := OLD.login_shop_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shop_security ON public.shops;
CREATE TRIGGER trg_protect_shop_security
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.protect_shop_security_columns();

CREATE OR REPLACE FUNCTION public.admin_regenerate_shop_login_id(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
  actor_role TEXT;
  previous_id TEXT;
  next_id TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  actor_role := public.current_admin_role();
  IF actor_role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Managers cannot regenerate Shop IDs');
  END IF;
  SELECT * INTO shop_rec FROM public.shops WHERE id = p_shop_id;
  IF shop_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;
  previous_id := shop_rec.login_shop_id;
  next_id := public.generate_shop_login_id(shop_rec.name);
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.shops
  SET login_shop_id = next_id,
      updated_at = NOW()
  WHERE id = p_shop_id;
  PERFORM public.log_security_event(
    'shop_login_id_regenerated', auth.uid(), shop_rec.owner_user_id, p_shop_id, next_id, NULL, NULL, 'success',
    jsonb_build_object('previous_login_shop_id', previous_id, 'login_shop_id', next_id, 'shop_name', shop_rec.name)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'shop_name', shop_rec.name,
    'previous_login_shop_id', previous_id,
    'login_shop_id', next_id
  );
END;
$$;

DROP POLICY IF EXISTS staff_admin ON public.shop_staff_assignments;
DROP POLICY IF EXISTS staff_select ON public.shop_staff_assignments;
DROP POLICY IF EXISTS staff_write ON public.shop_staff_assignments;
CREATE POLICY staff_select ON public.shop_staff_assignments FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.user_is_shop_owner(shop_id)
    OR user_id = auth.uid()
  );
CREATE POLICY staff_write ON public.shop_staff_assignments FOR ALL
  USING (public.is_platform_admin() OR public.user_is_shop_owner(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_is_shop_owner(shop_id));

DROP POLICY IF EXISTS shops_owner_manage ON public.shops;
DROP POLICY IF EXISTS shops_manage_insert ON public.shops;
DROP POLICY IF EXISTS shops_manage_update ON public.shops;
DROP POLICY IF EXISTS shops_manage_delete ON public.shops;
CREATE POLICY shops_manage_insert ON public.shops FOR INSERT
  WITH CHECK (public.is_platform_admin());
CREATE POLICY shops_manage_update ON public.shops FOR UPDATE
  USING (public.is_platform_admin() OR public.user_manages_shop(id))
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(id));
CREATE POLICY shops_manage_delete ON public.shops FOR DELETE
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS shop_settings_owner ON public.shop_settings;
CREATE POLICY shop_settings_owner ON public.shop_settings FOR ALL
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));

DROP POLICY IF EXISTS promotions_manage ON public.promotions;
CREATE POLICY promotions_manage ON public.promotions FOR ALL
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));

DROP POLICY IF EXISTS products_owner_manage ON public.products;
DROP POLICY IF EXISTS products_staff_read ON public.products;
DROP POLICY IF EXISTS products_manage_write ON public.products;
DROP POLICY IF EXISTS products_manage_update ON public.products;
DROP POLICY IF EXISTS products_manage_delete ON public.products;
CREATE POLICY products_staff_read ON public.products FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY products_manage_write ON public.products FOR INSERT
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));
CREATE POLICY products_manage_update ON public.products FOR UPDATE
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));
CREATE POLICY products_manage_delete ON public.products FOR DELETE
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id));

DROP POLICY IF EXISTS sales_owner ON public.sales;
DROP POLICY IF EXISTS sales_staff_read ON public.sales;
DROP POLICY IF EXISTS sales_manage_write ON public.sales;
DROP POLICY IF EXISTS sales_manage_update ON public.sales;
DROP POLICY IF EXISTS sales_manage_delete ON public.sales;
CREATE POLICY sales_staff_read ON public.sales FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY sales_manage_write ON public.sales FOR INSERT
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));
CREATE POLICY sales_manage_update ON public.sales FOR UPDATE
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_manages_shop(shop_id));
CREATE POLICY sales_manage_delete ON public.sales FOR DELETE
  USING (public.is_platform_admin() OR public.user_manages_shop(shop_id));

DROP POLICY IF EXISTS promo_codes_write ON public.promo_codes;
CREATE POLICY promo_codes_write ON public.promo_codes FOR ALL
  USING (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_manages_shop(shop_id)))
  WITH CHECK (public.is_platform_admin() OR (shop_id IS NOT NULL AND public.user_manages_shop(shop_id)));

DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.shop_id = shop_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_platform_admin()
          OR public.user_owns_shop(o.shop_id)
        )
    )
  );

DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS bookings_update ON public.service_bookings;
CREATE POLICY bookings_update ON public.service_bookings FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS receipts_update ON public.receipts;
CREATE POLICY receipts_update ON public.receipts FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS bookings_update ON public.service_bookings;
CREATE POLICY bookings_update ON public.service_bookings FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS shop_reg_insert ON public.shop_registration_requests;
CREATE POLICY shop_reg_insert ON public.shop_registration_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (requester_user_id IS NULL OR requester_user_id = auth.uid())
    AND COALESCE(status, 'pending') = 'pending'
    AND admin_notes IS NULL
  );

DROP POLICY IF EXISTS sub_hist_admin ON public.subscription_history;
DROP POLICY IF EXISTS sub_hist_read ON public.subscription_history;
DROP POLICY IF EXISTS sub_hist_write ON public.subscription_history;
CREATE POLICY sub_hist_read ON public.subscription_history FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY sub_hist_write ON public.subscription_history FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.shop_lookup_staff_candidate(p_email TEXT, p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.users%ROWTYPE;
  email TEXT := lower(trim(COALESCE(p_email, '')));
  uname TEXT := lower(trim(COALESCE(p_username, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1 FROM public.shops s WHERE public.user_is_shop_owner(s.id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF email = '' OR uname = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter both email and username.');
  END IF;
  SELECT * INTO rec
  FROM public.users
  WHERE lower(email) = email AND username_normalized = uname
  LIMIT 1;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No registered person matches that email and username.');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'user_id', rec.id,
    'name', rec.name,
    'email', rec.email,
    'username', rec.username,
    'role', rec.role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_set_payment_methods(p_shop_id UUID, p_methods JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  method TEXT;
  filtered JSONB := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF NOT (public.user_manages_shop(p_shop_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.is_allowed_payment_method_list(p_methods) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Select at least one valid payment method');
  END IF;

  FOR method IN SELECT DISTINCT public.normalize_payment_method(m)
    FROM jsonb_array_elements_text(p_methods) m
  LOOP
    IF method IS NOT NULL AND method = ANY (public.platform_payment_methods()) THEN
      filtered := filtered || jsonb_build_array(method);
    END IF;
  END LOOP;

  IF jsonb_array_length(filtered) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No enabled platform methods remain');
  END IF;

  INSERT INTO public.shop_settings (shop_id, payment_methods)
  VALUES (p_shop_id, filtered)
  ON CONFLICT (shop_id) DO UPDATE SET payment_methods = excluded.payment_methods, updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'payment_methods', filtered);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_payment_refund(
  p_payment_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_kind TEXT DEFAULT 'provider'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  pay public.payments%ROWTYPE;
  refund_id UUID;
  kind TEXT;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;

  kind := CASE WHEN lower(COALESCE(p_kind, 'provider')) = 'cash' THEN 'cash' ELSE 'provider' END;
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;
  IF NOT (public.user_manages_shop(pay.shop_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF pay.status <> 'paid' AND pay.status <> 'partially_refunded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only paid payments can be refunded');
  END IF;
  IF kind = 'cash' AND pay.payment_method <> 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cash refunds are only for cash payments');
  END IF;
  IF kind = 'provider' AND pay.payment_method = 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Use a cash refund for cash payments');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > pay.amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid refund amount');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_refunds
    WHERE payment_id = pay.id AND status IN ('requested', 'processing', 'completed')
      AND amount >= pay.amount
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A refund already covers this payment');
  END IF;

  INSERT INTO public.payment_refunds (
    payment_id, order_id, shop_id, amount, currency, reason, status, refund_kind, authorized_by
  ) VALUES (
    pay.id, pay.order_id, pay.shop_id, p_amount, pay.currency,
    left(COALESCE(p_reason, ''), 400), 'requested', kind, uid
  )
  RETURNING id INTO refund_id;

  PERFORM public.log_payment_event(
    'PAYMENT_REFUND_REQUESTED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('refund_id', refund_id, 'amount', p_amount, 'kind', kind)
  );

  RETURN jsonb_build_object('ok', true, 'refund_id', refund_id, 'status', 'requested');
END;
$$;

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
  IF NOT (public.user_manages_shop(ref.shop_id) OR public.is_platform_admin()) THEN
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

  PERFORM public.log_payment_event(
    'PAYMENT_REFUNDED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('refund_id', ref.id, 'kind', 'cash', 'amount', ref.amount)
  );

  RETURN jsonb_build_object('ok', true, 'status', new_status);
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
  IF NOT (public.is_platform_admin() OR public.user_manages_shop(rec.shop_id)) THEN
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
  IF NOT (public.is_platform_admin() OR public.user_manages_shop(rec.shop_id)) THEN
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

CREATE OR REPLACE FUNCTION public.clear_shop_sales()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_period UUID;
  rec public.sales%ROWTYPE;
  n INTEGER := 0;
BEGIN
  SELECT s.id INTO v_shop_id
  FROM public.shops s
  WHERE public.user_manages_shop(s.id)
  LIMIT 1;
  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT id INTO v_period FROM public.financial_periods
  WHERE shop_id = v_shop_id AND is_current = TRUE
  LIMIT 1;
  IF v_period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;

  FOR rec IN
    SELECT * FROM public.sales
    WHERE shop_id = v_shop_id AND period_id = v_period
    FOR UPDATE
  LOOP
    PERFORM public.restore_sale_stock(rec.id);
    DELETE FROM public.receipts WHERE sale_id = rec.id;
    IF rec.order_id IS NOT NULL THEN
      UPDATE public.orders
      SET
        status = CASE WHEN status = 'completed' THEN 'pending' ELSE status END,
        payment_status = CASE WHEN payment_status = 'paid' THEN 'pending' ELSE payment_status END,
        inventory_consumed_at = NULL,
        updated_at = NOW()
      WHERE id = rec.order_id;
    END IF;
    n := n + 1;
  END LOOP;

  DELETE FROM public.sales WHERE shop_id = v_shop_id AND period_id = v_period;
  RETURN jsonb_build_object('ok', true, 'deleted', n);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Unable to clear sales: ' || SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_shop_expenses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_period UUID;
  n INTEGER := 0;
BEGIN
  SELECT s.id INTO v_shop_id
  FROM public.shops s
  WHERE public.user_manages_shop(s.id)
  LIMIT 1;
  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(v_shop_id, 'expenses') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expenses are not available for this shop');
  END IF;
  SELECT id INTO v_period FROM public.financial_periods
  WHERE shop_id = v_shop_id AND is_current = TRUE
  LIMIT 1;
  IF v_period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;
  DELETE FROM public.shop_expenses WHERE shop_id = v_shop_id AND period_id = v_period;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', n);
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
  IF NOT (public.is_platform_admin() OR public.user_manages_shop(product_row.shop_id)) THEN
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

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions(p_shop_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
  rec RECORD;
  grace INTEGER := public.subscription_grace_days();
BEGIN
  IF p_shop_id IS NULL AND auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    RETURN 0;
  END IF;
  FOR rec IN
    SELECT id, shop_id
    FROM public.subscriptions
    WHERE status IN ('active', 'trial')
      AND renewal_date + grace < CURRENT_DATE
      AND (p_shop_id IS NULL OR shop_id = p_shop_id)
  LOOP
    UPDATE public.subscriptions SET status = 'expired' WHERE id = rec.id;
    PERFORM public.delist_unpaid_shop(rec.shop_id);
    PERFORM public.sync_shop_verification(rec.shop_id);
    n := n + 1;
  END LOOP;
  IF p_shop_id IS NOT NULL THEN
    IF NOT public.shop_subscription_covers(p_shop_id) THEN
      PERFORM public.delist_unpaid_shop(p_shop_id);
    END IF;
    PERFORM public.sync_shop_verification(p_shop_id);
  END IF;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_product_stock(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_product_stock(UUID, UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.restock_order_inventory(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restock_order_inventory(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.publish_due_news() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_news() TO service_role;

REVOKE ALL ON FUNCTION public.expire_due_subscriptions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.try_enroll_founding_shop(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_enroll_founding_shop(UUID) TO service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.platform_flags FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_manages_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_shop_login_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_lookup_staff_candidate(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_set_payment_methods(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_refund(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_cash_refund(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_sale(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shop_receipt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_shop_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_shop_expenses() TO authenticated;
