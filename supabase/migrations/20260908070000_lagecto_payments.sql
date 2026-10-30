-- LaGecto secure payments.
-- Never store card numbers, CVV/CVC, PINs, EcoCash PINs, passwords, or provider secrets.

-- ============================================================
-- SHOP / ORDER COLUMNS
-- ============================================================
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.shop_settings
  ALTER COLUMN payment_methods SET DEFAULT '["cash"]'::jsonb;

UPDATE public.shop_settings
SET payment_methods = '["cash"]'::jsonb
WHERE payment_methods IS NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN (
    'pending', 'processing', 'paid', 'failed', 'cancelled',
    'refunded', 'partially_refunded', 'review_required'
  ));

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_id UUID,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

-- ============================================================
-- PLATFORM CONFIG (no secrets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_payment_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled_methods JSONB NOT NULL DEFAULT '["visa","mastercard","ecocash","cash"]'::jsonb,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_payment_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  period_id UUID REFERENCES public.financial_periods(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('visa', 'mastercard', 'ecocash', 'cash')),
  payment_provider TEXT NOT NULL
    CHECK (payment_provider IN ('sandbox', 'paynow', 'cash')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'processing', 'paid', 'failed', 'cancelled',
      'refunded', 'partially_refunded', 'review_required'
    )),
  provider_transaction_id TEXT,
  poll_url TEXT,
  browser_url TEXT,
  idempotency_key TEXT NOT NULL,
  failure_reason TEXT,
  review_reason TEXT,
  masked_instrument TEXT,
  confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_shop_matches_order CHECK (shop_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_uidx ON public.payments (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_shop ON public.payments (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_tx ON public.payments (provider_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_per_order
  ON public.payments (order_id)
  WHERE status = 'paid';

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_provider TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'processing', 'succeeded', 'failed', 'cancelled')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_idempotency_uidx ON public.payment_attempts (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment ON public.payment_attempts (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON public.payment_attempts (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  refund_kind TEXT NOT NULL DEFAULT 'provider'
    CHECK (refund_kind IN ('provider', 'cash')),
  provider_refund_id TEXT,
  authorized_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON public.payment_refunds (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_shop ON public.payment_refunds (shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON public.payment_events (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_shop ON public.payment_events (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON public.payment_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_webhook_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  provider_transaction_id TEXT,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_payload_uidx ON public.payment_webhook_receipts (provider, payload_hash);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_created ON public.payment_webhook_receipts (created_at DESC);

ALTER TABLE public.receipts
  DROP CONSTRAINT IF EXISTS receipts_payment_id_fkey;
ALTER TABLE public.receipts
  ADD CONSTRAINT receipts_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

-- ============================================================
-- HELPERS
-- ============================================================
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
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_payment_method_list(p_methods JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    jsonb_typeof(p_methods) = 'array'
    AND jsonb_array_length(p_methods) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_methods) m
      WHERE public.normalize_payment_method(m) IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.shop_payment_methods(p_shop_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT public.normalize_payment_method(m)
      FROM public.shop_settings s,
           jsonb_array_elements_text(COALESCE(s.payment_methods, '["cash"]'::jsonb)) m
      WHERE s.shop_id = p_shop_id
        AND public.normalize_payment_method(m) IS NOT NULL
    ),
    ARRAY['cash']::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_payment_methods()
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT public.normalize_payment_method(m)
      FROM public.platform_payment_config c,
           jsonb_array_elements_text(COALESCE(c.enabled_methods, '["visa","mastercard","ecocash","cash"]'::jsonb)) m
      WHERE c.id = 1
        AND public.normalize_payment_method(m) IS NOT NULL
    ),
    ARRAY['visa','mastercard','ecocash','cash']::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_accepts_payment_method(p_shop_id UUID, p_method TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.normalize_payment_method(p_method) = ANY (public.shop_payment_methods(p_shop_id))
     AND public.normalize_payment_method(p_method) = ANY (public.platform_payment_methods());
$$;

CREATE OR REPLACE FUNCTION public.order_authoritative_total(p_order_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  FROM public.order_items
  WHERE order_id = p_order_id;
$$;

CREATE OR REPLACE FUNCTION public.log_payment_event(
  p_event_type TEXT,
  p_payment_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
  safe_meta JSONB;
BEGIN
  safe_meta := COALESCE(p_metadata, '{}'::jsonb)
    - 'card_number' - 'pan' - 'cvv' - 'cvc' - 'pin' - 'password'
    - 'secret' - 'integration_key' - 'PAYNOW_INTEGRATION_KEY'
    - 'ecocash_pin' - 'token';
  INSERT INTO public.payment_events (
    event_type, payment_id, order_id, shop_id, actor_id, metadata
  ) VALUES (
    p_event_type, p_payment_id, p_order_id, p_shop_id, p_actor_id, safe_meta
  )
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.allow_payment_mutation()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('lagecto.allow_payment_update', true) = 'true';
$$;

-- ============================================================
-- PROTECTION TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_order_payment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.allow_payment_mutation() THEN
    RETURN NEW;
  END IF;
  NEW.total := OLD.total;
  NEW.subtotal := OLD.subtotal;
  NEW.discount := OLD.discount;
  NEW.tax := OLD.tax;
  NEW.currency := OLD.currency;
  NEW.shop_id := OLD.shop_id;
  NEW.customer_id := OLD.customer_id;
  NEW.items := OLD.items;
  NEW.payment_status := OLD.payment_status;
  NEW.order_number := OLD.order_number;
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_payment ON public.orders;
CREATE TRIGGER trg_protect_order_payment
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.protect_order_payment_columns();

CREATE OR REPLACE FUNCTION public.protect_payment_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.allow_payment_mutation() THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Payments cannot be deleted';
  END IF;
  IF public.allow_payment_mutation() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Payment records can only be changed by trusted payment functions';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payments ON public.payments;
CREATE TRIGGER trg_protect_payments
BEFORE UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_row();

CREATE OR REPLACE FUNCTION public.protect_payment_attempts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.allow_payment_mutation() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Payment attempts cannot be edited directly';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_attempts ON public.payment_attempts;
CREATE TRIGGER trg_protect_payment_attempts
BEFORE UPDATE ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_attempts();

CREATE OR REPLACE FUNCTION public.validate_shop_payment_methods()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_allowed_payment_method_list(NEW.payment_methods) THEN
    RAISE EXCEPTION 'Payment methods must be a non-empty list of visa, mastercard, ecocash, cash';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shop_payment_methods ON public.shop_settings;
CREATE TRIGGER trg_validate_shop_payment_methods
BEFORE INSERT OR UPDATE OF payment_methods ON public.shop_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_shop_payment_methods();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (
    customer_id = auth.uid()
    OR public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );

DROP POLICY IF EXISTS payment_attempts_select ON public.payment_attempts;
CREATE POLICY payment_attempts_select ON public.payment_attempts FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_refunds_select ON public.payment_refunds;
CREATE POLICY payment_refunds_select ON public.payment_refunds FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_events_select ON public.payment_events;
CREATE POLICY payment_events_select ON public.payment_events FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_webhooks_admin ON public.payment_webhook_receipts;
CREATE POLICY payment_webhooks_admin ON public.payment_webhook_receipts FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS platform_payment_config_read ON public.platform_payment_config;
CREATE POLICY platform_payment_config_read ON public.platform_payment_config FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS platform_payment_config_admin ON public.platform_payment_config;
CREATE POLICY platform_payment_config_admin ON public.platform_payment_config FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Direct client writes are denied. Mutations go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders FOR INSERT
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );

-- ============================================================
-- FINANCIAL RECORDING ON PAID
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_paid_payment_financials(p_payment public.payments)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  sale_id UUID;
  receipt_id UUID;
  receipt_no TEXT;
  period UUID;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = p_payment.order_id;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;

  period := COALESCE(p_payment.period_id, ord.period_id, public.current_financial_period_id(ord.shop_id));

  SELECT id INTO sale_id FROM public.sales WHERE order_id = ord.id LIMIT 1;
  IF sale_id IS NULL THEN
    INSERT INTO public.sales (
      shop_id, order_id, period_id, sale_number, customer_id, customer_name,
      subtotal, discount, tax, total, payment_method, status, completed_by_user_id
    ) VALUES (
      ord.shop_id, ord.id, period, replace(ord.order_number, 'LG-', 'S-'),
      ord.customer_id, ord.customer_name, ord.subtotal, COALESCE(ord.discount, 0),
      COALESCE(ord.tax, 0), p_payment.amount, p_payment.payment_method, 'completed',
      p_payment.confirmed_by
    )
    RETURNING id INTO sale_id;
  END IF;

  SELECT id INTO receipt_id FROM public.receipts WHERE order_id = ord.id LIMIT 1;
  IF receipt_id IS NULL THEN
    receipt_no := public.next_receipt_number(ord.shop_id);
    INSERT INTO public.receipts (
      shop_id, sale_id, order_id, customer_id, period_id, receipt_number,
      customer_name, customer_email, customer_phone, subtotal, discount, tax, total,
      payment_method, payment_status, payment_id, provider_transaction_id, shop_details
    )
    SELECT
      ord.shop_id, sale_id, ord.id, ord.customer_id, period, receipt_no,
      ord.customer_name, ord.customer_email, ord.customer_phone,
      ord.subtotal, COALESCE(ord.discount, 0), COALESCE(ord.tax, 0), p_payment.amount,
      p_payment.payment_method, 'paid', p_payment.id, p_payment.provider_transaction_id,
      jsonb_build_object(
        'name', s.name,
        'address', s.address,
        'phone', s.phone,
        'email', s.email,
        'logo_url', s.logo_url,
        'shop_id', s.login_shop_id
      )
    FROM public.shops s WHERE s.id = ord.shop_id
    RETURNING id INTO receipt_id;

    INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
    SELECT receipt_id, (i->>'product_id')::uuid, i->>'name', (i->>'quantity')::int, (i->>'price')::numeric,
           (i->>'price')::numeric * (i->>'quantity')::int
    FROM jsonb_array_elements(ord.items) i;
  ELSE
    UPDATE public.receipts
    SET payment_status = 'paid',
        payment_id = p_payment.id,
        payment_method = p_payment.payment_method,
        provider_transaction_id = p_payment.provider_transaction_id
    WHERE id = receipt_id;
  END IF;

  IF ord.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (
      ord.customer_id,
      'Payment received',
      'Payment for order ' || ord.order_number || ' was confirmed. Your receipt is ready.',
      'order',
      receipt_id
    );
  END IF;

  INSERT INTO public.shop_notifications (shop_id, title, message, type)
  VALUES (
    ord.shop_id,
    'Payment received',
    'Order ' || ord.order_number || ' was paid via ' || p_payment.payment_method || '.',
    'order'
  );

  RETURN jsonb_build_object('ok', true, 'sale_id', sale_id, 'receipt_id', receipt_id);
END;
$$;

-- ============================================================
-- CREATE PAYMENT (server amount from order)
-- ============================================================
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
  IF ord.customer_id IS DISTINCT FROM uid AND NOT public.is_platform_admin() THEN
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
    amount, currency, status, idempotency_key,
    review_reason
  ) VALUES (
    ord.id, ord.shop_id, ord.customer_id, ord.period_id, method, provider,
    amount, COALESCE(NULLIF(ord.currency, ''), 'USD'),
    CASE WHEN method = 'cash' THEN 'pending' ELSE 'pending' END,
    left(p_idempotency_key, 120),
    CASE WHEN fail_count >= 5 THEN 'Repeated payment failures on this order' ELSE NULL END
  )
  RETURNING id INTO payment_id;

  IF fail_count >= 5 THEN
    UPDATE public.payments SET status = 'review_required' WHERE id = payment_id;
    UPDATE public.orders SET payment_status = 'review_required' WHERE id = ord.id;
  ELSE
    UPDATE public.orders
    SET payment_method = method,
        payment_status = CASE WHEN method = 'cash' THEN 'pending' ELSE 'pending' END
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
    'shop_id', ord.shop_id,
    'order_id', ord.id,
    'order_number', ord.order_number,
    'review_required', fail_count >= 5
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_payment_provider_session(
  p_payment_id UUID,
  p_provider_transaction_id TEXT,
  p_poll_url TEXT,
  p_browser_url TEXT,
  p_status TEXT DEFAULT 'processing'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.payments%ROWTYPE;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;
  IF pay.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid', 'payment_id', pay.id);
  END IF;

  UPDATE public.payments
  SET provider_transaction_id = NULLIF(p_provider_transaction_id, ''),
      poll_url = NULLIF(p_poll_url, ''),
      browser_url = NULLIF(p_browser_url, ''),
      status = CASE
        WHEN pay.status = 'review_required' THEN 'review_required'
        WHEN p_status IN ('pending', 'processing', 'failed', 'cancelled') THEN p_status
        ELSE 'processing'
      END
  WHERE id = pay.id;

  UPDATE public.payment_attempts
  SET status = 'processing'
  WHERE payment_id = pay.id AND status = 'created';

  UPDATE public.orders
  SET payment_status = CASE
    WHEN pay.status = 'review_required' THEN 'review_required'
    ELSE 'processing'
  END
  WHERE id = pay.order_id AND payment_status <> 'paid';

  PERFORM public.log_payment_event(
    'PAYMENT_PROCESSING', pay.id, pay.order_id, pay.shop_id, auth.uid(),
    jsonb_build_object('has_browser_url', p_browser_url IS NOT NULL)
  );

  RETURN jsonb_build_object('ok', true, 'payment_id', pay.id, 'status', 'processing');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_payment_attempt(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.payments%ROWTYPE;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;
  IF pay.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid');
  END IF;

  UPDATE public.payments
  SET status = 'failed',
      failure_reason = left(COALESCE(p_reason, 'Payment failed'), 240)
  WHERE id = pay.id;

  UPDATE public.payment_attempts
  SET status = 'failed',
      failure_reason = left(COALESCE(p_reason, 'Payment failed'), 240)
  WHERE payment_id = pay.id AND status IN ('created', 'processing');

  UPDATE public.orders
  SET payment_status = 'failed'
  WHERE id = pay.order_id AND payment_status <> 'paid';

  PERFORM public.log_payment_event(
    'PAYMENT_FAILED', pay.id, pay.order_id, pay.shop_id, auth.uid(),
    jsonb_build_object('reason', left(COALESCE(p_reason, ''), 120))
  );

  RETURN jsonb_build_object('ok', true, 'status', 'failed');
END;
$$;

-- ============================================================
-- APPLY VERIFIED PROVIDER RESULT (service role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_verified_payment(
  p_payment_id UUID,
  p_provider_transaction_id TEXT,
  p_provider_status TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_masked_instrument TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.payments%ROWTYPE;
  ord public.orders%ROWTYPE;
  expected NUMERIC;
  provider_paid BOOLEAN;
  finance JSONB;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);

  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = pay.order_id FOR UPDATE;
  IF ord.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;
  IF ord.shop_id IS DISTINCT FROM pay.shop_id THEN
    UPDATE public.payments
    SET status = 'review_required', review_reason = 'Shop mismatch'
    WHERE id = pay.id;
    PERFORM public.log_payment_event('PAYMENT_REVIEW_REQUIRED', pay.id, pay.order_id, pay.shop_id, NULL,
      jsonb_build_object('reason', 'shop_mismatch'));
    RETURN jsonb_build_object('ok', false, 'error', 'Shop mismatch', 'status', 'review_required');
  END IF;

  expected := public.order_authoritative_total(ord.id);
  IF expected IS DISTINCT FROM pay.amount OR expected IS DISTINCT FROM ord.total THEN
    UPDATE public.payments
    SET status = 'review_required', review_reason = 'Amount mismatch against order'
    WHERE id = pay.id;
    UPDATE public.orders SET payment_status = 'review_required' WHERE id = ord.id;
    PERFORM public.log_payment_event('PAYMENT_REVIEW_REQUIRED', pay.id, ord.id, pay.shop_id, NULL,
      jsonb_build_object('reason', 'amount_mismatch', 'expected', expected, 'payment_amount', pay.amount));
    RETURN jsonb_build_object('ok', false, 'error', 'Amount mismatch', 'status', 'review_required');
  END IF;

  IF p_amount IS DISTINCT FROM pay.amount THEN
    UPDATE public.payments
    SET status = 'review_required', review_reason = 'Provider amount does not match order'
    WHERE id = pay.id;
    UPDATE public.orders SET payment_status = 'review_required' WHERE id = ord.id;
    PERFORM public.log_payment_event('PAYMENT_REVIEW_REQUIRED', pay.id, ord.id, pay.shop_id, NULL,
      jsonb_build_object('reason', 'provider_amount_mismatch', 'provider_amount', p_amount, 'expected', pay.amount));
    RETURN jsonb_build_object('ok', false, 'error', 'Provider amount mismatch', 'status', 'review_required');
  END IF;

  IF upper(COALESCE(p_currency, pay.currency)) IS DISTINCT FROM upper(pay.currency)
     OR upper(pay.currency) IS DISTINCT FROM upper(COALESCE(ord.currency, 'USD')) THEN
    UPDATE public.payments
    SET status = 'review_required', review_reason = 'Currency mismatch'
    WHERE id = pay.id;
    UPDATE public.orders SET payment_status = 'review_required' WHERE id = ord.id;
    PERFORM public.log_payment_event('PAYMENT_REVIEW_REQUIRED', pay.id, ord.id, pay.shop_id, NULL,
      jsonb_build_object('reason', 'currency_mismatch'));
    RETURN jsonb_build_object('ok', false, 'error', 'Currency mismatch', 'status', 'review_required');
  END IF;

  IF pay.provider_transaction_id IS NOT NULL
     AND p_provider_transaction_id IS NOT NULL
     AND pay.provider_transaction_id IS DISTINCT FROM p_provider_transaction_id THEN
    UPDATE public.payments
    SET status = 'review_required', review_reason = 'Provider transaction mismatch'
    WHERE id = pay.id;
    PERFORM public.log_payment_event('PAYMENT_REVIEW_REQUIRED', pay.id, ord.id, pay.shop_id, NULL,
      jsonb_build_object('reason', 'provider_transaction_mismatch'));
    RETURN jsonb_build_object('ok', false, 'error', 'Provider transaction mismatch', 'status', 'review_required');
  END IF;

  provider_paid := lower(COALESCE(p_provider_status, '')) IN (
    'paid', 'awaiting delivery', 'delivered', 'success', 'successful'
  );

  IF pay.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid', 'duplicate', true, 'payment_id', pay.id);
  END IF;

  IF NOT provider_paid THEN
    IF lower(COALESCE(p_provider_status, '')) IN ('cancelled', 'canceled') THEN
      UPDATE public.payments SET status = 'cancelled' WHERE id = pay.id;
      UPDATE public.payment_attempts SET status = 'cancelled' WHERE payment_id = pay.id AND status IN ('created', 'processing');
      UPDATE public.orders SET payment_status = 'cancelled' WHERE id = ord.id AND payment_status <> 'paid';
      PERFORM public.log_payment_event('PAYMENT_CANCELLED', pay.id, ord.id, pay.shop_id, NULL,
        jsonb_build_object('provider_status', p_provider_status));
      RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
    END IF;
    IF lower(COALESCE(p_provider_status, '')) IN ('refunded') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Use the refund process for refunded provider statuses');
    END IF;
    UPDATE public.payments
    SET status = 'processing',
        provider_transaction_id = COALESCE(NULLIF(p_provider_transaction_id, ''), pay.provider_transaction_id)
    WHERE id = pay.id;
    RETURN jsonb_build_object('ok', true, 'status', 'processing', 'provider_status', p_provider_status);
  END IF;

  UPDATE public.payments
  SET status = 'paid',
      provider_transaction_id = COALESCE(NULLIF(p_provider_transaction_id, ''), pay.provider_transaction_id),
      masked_instrument = NULLIF(left(COALESCE(p_masked_instrument, ''), 24), ''),
      paid_at = NOW(),
      failure_reason = NULL
  WHERE id = pay.id
  RETURNING * INTO pay;

  UPDATE public.payment_attempts
  SET status = 'succeeded'
  WHERE payment_id = pay.id AND status IN ('created', 'processing');

  UPDATE public.orders
  SET payment_status = 'paid',
      payment_method = pay.payment_method,
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
      confirmed_at = COALESCE(confirmed_at, NOW())
  WHERE id = ord.id;

  finance := public.record_paid_payment_financials(pay);

  PERFORM public.log_payment_event(
    'PAYMENT_SUCCEEDED', pay.id, ord.id, pay.shop_id, auth.uid(),
    jsonb_build_object('method', pay.payment_method, 'amount', pay.amount, 'currency', pay.currency)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'payment_id', pay.id,
    'receipt_id', finance->>'receipt_id',
    'sale_id', finance->>'sale_id'
  );
END;
$$;

-- ============================================================
-- CASH CONFIRM (shop only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  pay public.payments%ROWTYPE;
BEGIN
  PERFORM set_config('lagecto.allow_payment_update', 'true', true);
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;

  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payment not found');
  END IF;
  IF NOT (public.user_owns_shop(pay.shop_id) OR public.is_platform_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF pay.payment_method <> 'cash' OR pay.payment_provider <> 'cash' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only cash payments can be confirmed this way');
  END IF;
  IF pay.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'paid', 'payment_id', pay.id, 'duplicate', true);
  END IF;

  UPDATE public.payments SET confirmed_by = uid WHERE id = pay.id;
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id;

  PERFORM public.log_payment_event(
    'CASH_PAYMENT_CONFIRMED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('amount', pay.amount)
  );

  RETURN public.apply_verified_payment(
    pay.id,
    'CASH-' || pay.id::text,
    'paid',
    pay.amount,
    pay.currency,
    NULL
  );
END;
$$;

-- ============================================================
-- REFUNDS
-- ============================================================
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
  IF NOT (public.user_owns_shop(pay.shop_id) OR public.is_platform_admin()) THEN
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

  PERFORM public.log_payment_event(
    'PAYMENT_REFUNDED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('refund_id', ref.id, 'kind', 'cash', 'amount', ref.amount)
  );

  RETURN jsonb_build_object('ok', true, 'status', new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_provider_refund_completed(
  p_refund_id UUID,
  p_provider_refund_id TEXT
)
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
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NULLIF(trim(p_provider_refund_id), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provider refund reference is required');
  END IF;

  SELECT * INTO ref FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
  IF ref.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Refund not found');
  END IF;
  IF ref.refund_kind <> 'provider' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This refund is not a provider refund');
  END IF;

  SELECT * INTO pay FROM public.payments WHERE id = ref.payment_id FOR UPDATE;
  new_status := CASE WHEN ref.amount >= pay.amount THEN 'refunded' ELSE 'partially_refunded' END;

  UPDATE public.payment_refunds
  SET status = 'completed',
      completed_at = NOW(),
      provider_refund_id = left(trim(p_provider_refund_id), 80),
      authorized_by = COALESCE(authorized_by, uid)
  WHERE id = ref.id;

  UPDATE public.payments SET status = new_status WHERE id = pay.id;
  UPDATE public.orders SET payment_status = new_status, status = CASE WHEN new_status = 'refunded' THEN 'refunded' ELSE status END
  WHERE id = pay.order_id;
  UPDATE public.sales SET status = CASE WHEN new_status = 'refunded' THEN 'refunded' ELSE status END
  WHERE order_id = pay.order_id;

  PERFORM public.log_payment_event(
    'PAYMENT_REFUNDED', pay.id, pay.order_id, pay.shop_id, uid,
    jsonb_build_object('refund_id', ref.id, 'kind', 'provider')
  );

  RETURN jsonb_build_object('ok', true, 'status', new_status);
END;
$$;

-- ============================================================
-- WEBHOOK RECEIPT
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_webhook(
  p_provider TEXT,
  p_payload_hash TEXT,
  p_provider_transaction_id TEXT,
  p_signature_valid BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.payment_webhook_receipts%ROWTYPE;
BEGIN
  INSERT INTO public.payment_webhook_receipts (
    provider, payload_hash, provider_transaction_id, signature_valid, processed
  ) VALUES (
    p_provider, p_payload_hash, NULLIF(p_provider_transaction_id, ''), COALESCE(p_signature_valid, FALSE), FALSE
  )
  ON CONFLICT (provider, payload_hash) DO NOTHING
  RETURNING * INTO rec;

  IF rec.id IS NULL THEN
    SELECT * INTO rec FROM public.payment_webhook_receipts
    WHERE provider = p_provider AND payload_hash = p_payload_hash;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'processed', rec.processed, 'id', rec.id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'id', rec.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payment_webhook_processed(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_webhook_receipts SET processed = TRUE WHERE id = p_id;
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
  IF NOT (public.user_owns_shop(p_shop_id) OR public.is_platform_admin()) THEN
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

CREATE OR REPLACE FUNCTION public.admin_set_platform_payment_methods(p_methods JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.is_allowed_payment_method_list(p_methods) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Select at least one valid payment method');
  END IF;
  UPDATE public.platform_payment_config
  SET enabled_methods = p_methods, updated_at = NOW(), updated_by = auth.uid()
  WHERE id = 1;
  RETURN jsonb_build_object('ok', true, 'enabled_methods', p_methods);
END;
$$;

-- ============================================================
-- CHECKOUT / COMPLETE / PERIOD / POS UPDATES
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_customer_order(
  p_shop_id UUID,
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_notes TEXT DEFAULT NULL
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
  line_total NUMERIC;
  order_id UUID;
  period UUID;
  built_items JSONB := '[]'::jsonb;
  order_no TEXT;
  method TEXT;
  shop_currency TEXT;
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
    line_total := product_row.price * qty;
    subtotal := subtotal + line_total;
    built_items := built_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'quantity', qty,
      'price', product_row.price
    ));
  END LOOP;

  order_no := public.next_order_number();
  INSERT INTO public.orders (
    order_number, shop_id, customer_id, period_id, customer_name, customer_email, customer_phone,
    items, subtotal, total, status, payment_method, payment_status, currency, notes
  ) VALUES (
    order_no, p_shop_id, uid, period, profile.name, profile.email, profile.phone,
    built_items, subtotal, subtotal, 'pending', method, 'pending', COALESCE(shop_currency, 'USD'),
    left(COALESCE(p_notes, ''), 400)
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

  INSERT INTO public.shop_notifications (shop_id, title, message, type)
  VALUES (p_shop_id, 'New order', 'Order ' || order_no || ' was placed.', 'order');

  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  VALUES (uid, 'Order placed', 'Your order ' || order_no || ' was submitted.', 'order', order_id);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', order_id,
    'order_number', order_no,
    'total', subtotal,
    'currency', COALESCE(shop_currency, 'USD'),
    'payment_method', method,
    'payment_status', 'pending'
  );
END;
$$;

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

  FOR item IN SELECT * FROM jsonb_array_elements(ord.items)
  LOOP
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid;
    IF product_row.id IS NOT NULL AND product_row.type = 'product' THEN
      UPDATE public.products
      SET stock = GREATEST(stock - (item->>'quantity')::int, 0), updated_at = NOW()
      WHERE id = product_row.id;
      INSERT INTO public.inventory_transactions (
        shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
      ) VALUES (
        ord.shop_id, product_row.id, 'sold', - (item->>'quantity')::int,
        product_row.stock, GREATEST(product_row.stock - (item->>'quantity')::int, 0), auth.uid()
      );
      profit := profit + ((product_row.price - COALESCE(product_row.cost, 0)) * (item->>'quantity')::int);
    END IF;
  END LOOP;

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
      subtotal, total, profit, payment_method, status, completed_by_user_id
    ) VALUES (
      ord.shop_id, ord.id, period, replace(ord.order_number, 'LG-', 'S-'),
      ord.customer_id, ord.customer_name, ord.subtotal, ord.total, profit,
      COALESCE(ord.payment_method, 'cash'), 'completed', auth.uid()
    )
    RETURNING id INTO sale_id;

    INSERT INTO public.receipts (
      shop_id, sale_id, order_id, customer_id, period_id, receipt_number,
      customer_name, customer_email, customer_phone, subtotal, total, payment_method,
      payment_status, shop_details
    )
    SELECT
      ord.shop_id, sale_id, ord.id, ord.customer_id, period, public.next_receipt_number(ord.shop_id),
      ord.customer_name, ord.customer_email, ord.customer_phone, ord.subtotal, ord.total,
      COALESCE(ord.payment_method, 'cash'), COALESCE(ord.payment_status, 'paid'),
      jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone, 'email', s.email, 'logo_url', s.logo_url, 'shop_id', s.login_shop_id)
    FROM public.shops s WHERE s.id = ord.shop_id
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

CREATE OR REPLACE FUNCTION public.start_new_financial_period(p_shop_id UUID, p_label TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_period public.financial_periods%ROWTYPE;
  new_id UUID;
  revenue NUMERIC := 0;
  expenses NUMERIC := 0;
  payroll NUMERIC := 0;
  profit NUMERIC := 0;
  tx_count INTEGER := 0;
  label TEXT;
  visa_total NUMERIC := 0;
  mastercard_total NUMERIC := 0;
  ecocash_total NUMERIC := 0;
  cash_total NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO current_period
  FROM public.financial_periods
  WHERE shop_id = p_shop_id AND is_current = TRUE
  FOR UPDATE;

  IF current_period.id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0), COUNT(*) INTO revenue, tx_count
    FROM public.sales
    WHERE shop_id = p_shop_id AND period_id = current_period.id AND status = 'completed';

    SELECT COALESCE(SUM(amount), 0) INTO expenses
    FROM public.shop_expenses
    WHERE shop_id = p_shop_id AND period_id = current_period.id;

    SELECT COALESCE(SUM(net_pay), 0) INTO payroll
    FROM public.payroll_records
    WHERE shop_id = p_shop_id AND period_id = current_period.id AND status = 'paid';

    SELECT
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'visa'), 0),
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'mastercard'), 0),
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'ecocash'), 0),
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0)
    INTO visa_total, mastercard_total, ecocash_total, cash_total
    FROM public.payments
    WHERE shop_id = p_shop_id
      AND period_id = current_period.id
      AND status IN ('paid', 'refunded', 'partially_refunded');

    profit := revenue - expenses - payroll;

    UPDATE public.financial_periods
    SET is_current = FALSE,
        ended_at = NOW(),
        archived_at = NOW(),
        archived_by = auth.uid(),
        snapshot = jsonb_build_object(
          'revenue', revenue,
          'expenses', expenses,
          'payroll', payroll,
          'profit', profit,
          'transactions', tx_count,
          'started_at', current_period.started_at,
          'ended_at', NOW(),
          'payments', jsonb_build_object(
            'visa', visa_total,
            'mastercard', mastercard_total,
            'ecocash', ecocash_total,
            'cash', cash_total
          )
        )
    WHERE id = current_period.id;
  END IF;

  label := COALESCE(NULLIF(trim(p_label), ''), to_char(NOW(), 'FMMonth YYYY'));

  INSERT INTO public.financial_periods (shop_id, label, is_current, started_at)
  VALUES (p_shop_id, label, TRUE, NOW())
  RETURNING id INTO new_id;

  PERFORM public.log_security_event(
    'financial_period_started', auth.uid(), NULL, p_shop_id, NULL, NULL, NULL, 'success',
    jsonb_build_object('previous_period_id', current_period.id, 'new_period_id', new_id)
  );

  RETURN jsonb_build_object('ok', true, 'period_id', new_id, 'label', label);
END;
$$;

-- ============================================================
-- GRANTS
-- ============================================================
REVOKE ALL ON FUNCTION public.create_order_payment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_payment(UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_cash_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.request_payment_refund(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payment_refund(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_cash_refund(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_cash_refund(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.shop_set_payment_methods(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_set_payment_methods(UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_platform_payment_methods(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_platform_payment_methods(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.attach_payment_provider_session(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_payment_provider_session(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fail_payment_attempt(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_payment_attempt(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.apply_verified_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.record_provider_refund_completed(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_provider_refund_completed(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.record_payment_webhook(TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_webhook(TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.mark_payment_webhook_processed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_webhook_processed(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.shop_payment_methods(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_payment_methods() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_accepts_payment_method(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_payment_method(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_payment_event(TEXT, UUID, UUID, UUID, UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_customer_order(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shop_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_financial_period(UUID, TEXT) TO authenticated;
