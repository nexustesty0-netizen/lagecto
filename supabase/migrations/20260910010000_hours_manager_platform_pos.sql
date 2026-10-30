-- Manager admin role, hours-aware open status helpers, and LaGecto platform POS receipts.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%admin_role%'
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_admin_role_check
  CHECK (admin_role IS NULL OR admin_role IN ('super_admin', 'staff', 'clerk', 'manager'));

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT admin_role
  FROM public.users
  WHERE id = auth.uid()
    AND role = 'admin'
    AND account_status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_admin_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_rec public.shops%ROWTYPE;
  target public.users%ROWTYPE;
  actor_role TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  actor_role := public.current_admin_role();
  SELECT * INTO target FROM public.users WHERE id = p_user_id;
  IF target.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  IF public.is_protected_admin_email(target.email) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lagecto@outlook.com is platform admin only and cannot be staff or a shop.');
  END IF;
  IF p_user_id = auth.uid() AND p_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot demote your own admin account');
  END IF;
  IF p_role NOT IN ('admin', 'shop_owner', 'customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid role');
  END IF;
  IF actor_role = 'manager' AND p_role IS DISTINCT FROM 'shop_owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Managers can only assign shop owner roles');
  END IF;
  IF p_role = 'admin' AND p_admin_role IS NOT NULL
     AND p_admin_role NOT IN ('super_admin', 'staff', 'clerk', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid admin role');
  END IF;
  IF p_role = 'admin' AND COALESCE(p_admin_role, 'staff') IN ('super_admin', 'manager')
     AND COALESCE(actor_role, '') IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can assign managers or super admins');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET role = p_role,
      admin_role = CASE WHEN p_role = 'admin' THEN COALESCE(p_admin_role, 'staff') ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_user_id;
  IF p_role = 'shop_owner' THEN
    shop_rec := public.ensure_shop_for_owner(p_user_id);
  END IF;
  PERFORM public.log_security_event(
    'role_assigned', auth.uid(), p_user_id, shop_rec.id, NULL, NULL, NULL, 'success',
    jsonb_build_object('role', p_role, 'admin_role', p_admin_role, 'shop_id', shop_rec.id)
  );
  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', shop_rec.id,
    'login_shop_id', shop_rec.login_shop_id,
    'provider_type', shop_rec.provider_type
  );
END;
$$;

DROP POLICY IF EXISTS security_admin_read ON public.security_events;
CREATE POLICY security_admin_read ON public.security_events FOR SELECT
  USING (public.is_platform_admin() AND COALESCE(public.current_admin_role(), '') IS DISTINCT FROM 'manager');

CREATE TABLE IF NOT EXISTS public.platform_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  shop_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.platform_receipts(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_receipts_created ON public.platform_receipts (created_at DESC);

ALTER TABLE public.platform_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_receipt_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_receipts_admin ON public.platform_receipts;
CREATE POLICY platform_receipts_admin ON public.platform_receipts FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_receipt_items_admin ON public.platform_receipt_items;
CREATE POLICY platform_receipt_items_admin ON public.platform_receipt_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_receipts r
      WHERE r.id = receipt_id AND public.is_platform_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_receipts r
      WHERE r.id = receipt_id AND public.is_platform_admin()
    )
  );

CREATE OR REPLACE FUNCTION public.record_platform_sale(
  p_items JSONB,
  p_payment_method TEXT DEFAULT 'cash',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  qty INTEGER;
  price NUMERIC;
  subtotal NUMERIC := 0;
  receipt_id UUID;
  receipt_no TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    price := GREATEST(0, COALESCE((item->>'unit_price')::numeric, 0));
    IF NULLIF(trim(COALESCE(item->>'name', '')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Each item needs a name');
    END IF;
    subtotal := subtotal + (price * qty);
  END LOOP;

  receipt_no := 'LG-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.platform_receipts (
    receipt_number, customer_name, customer_phone, subtotal, total, payment_method, notes, recorded_by, shop_details
  ) VALUES (
    receipt_no,
    NULLIF(trim(COALESCE(p_customer_name, '')), ''),
    NULLIF(trim(COALESCE(p_customer_phone, '')), ''),
    subtotal,
    subtotal,
    COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    auth.uid(),
    jsonb_build_object(
      'name', 'LaGecto',
      'address', 'Bulawayo, Zimbabwe',
      'phone', '+263 71 503 4314',
      'email', 'lagecto@outlook.com'
    )
  )
  RETURNING id INTO receipt_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    price := GREATEST(0, COALESCE((item->>'unit_price')::numeric, 0));
    INSERT INTO public.platform_receipt_items (receipt_id, product_name, quantity, unit_price, total_price)
    VALUES (receipt_id, trim(item->>'name'), qty, price, price * qty);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'receipt_id', receipt_id, 'receipt_number', receipt_no, 'total', subtotal);
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_sale(JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated;
