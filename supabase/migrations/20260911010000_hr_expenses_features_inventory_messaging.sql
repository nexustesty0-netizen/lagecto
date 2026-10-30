-- HR, payroll, shop/platform expenses, feature overrides, inventory history,
-- notifications, chat reads, and manager reports.
-- Shop financials stay private to the owning shop. Platform expenses are separate.

-- ============================================================
-- EMPLOYEES
-- ============================================================
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS pay_frequency TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS payment_details TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_employment_type_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_employment_type_check
      CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'casual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pay_frequency_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_pay_frequency_check
      CHECK (pay_frequency IN ('weekly', 'fortnightly', 'monthly'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_status_check') THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;
END $$;

UPDATE public.employees SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR (is_active = FALSE AND status = 'active');

CREATE UNIQUE INDEX IF NOT EXISTS employees_shop_number_idx
  ON public.employees (shop_id, employee_number)
  WHERE employee_number IS NOT NULL AND employee_number <> '';

-- ============================================================
-- PAYROLL
-- ============================================================
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS gross_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  ADD COLUMN IF NOT EXISTS bonuses NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.payroll_records DROP CONSTRAINT IF EXISTS payroll_records_status_check;
ALTER TABLE public.payroll_records
  ADD CONSTRAINT payroll_records_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'cancelled'));

ALTER TABLE public.payroll_records ALTER COLUMN status SET DEFAULT 'draft';

UPDATE public.payroll_records
SET gross_pay = COALESCE(NULLIF(gross_pay, 0), net_pay)
WHERE COALESCE(gross_pay, 0) = 0 AND COALESCE(net_pay, 0) <> 0;

-- ============================================================
-- SHOP EXPENSES
-- ============================================================
ALTER TABLE public.shop_expenses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS client_nonce TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_expenses_status_check') THEN
    ALTER TABLE public.shop_expenses
      ADD CONSTRAINT shop_expenses_status_check
      CHECK (status IN ('active', 'voided'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS shop_expenses_nonce_idx
  ON public.shop_expenses (shop_id, client_nonce)
  WHERE client_nonce IS NOT NULL AND client_nonce <> '';

-- ============================================================
-- PLATFORM (LAGECTO) EXPENSES — never mixed with shop books
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'operations',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  client_nonce TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_expenses_date ON public.platform_expenses (expense_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS platform_expenses_nonce_idx
  ON public.platform_expenses (client_nonce)
  WHERE client_nonce IS NOT NULL AND client_nonce <> '';

ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_expenses_admin ON public.platform_expenses;
CREATE POLICY platform_expenses_admin ON public.platform_expenses FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ============================================================
-- FEATURE OVERRIDES (admin disable; package still required)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_feature_overrides (
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shop_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.shop_feature_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  previous_enabled BOOLEAN,
  enabled BOOLEAN NOT NULL,
  note TEXT,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_feature_audit_shop ON public.shop_feature_audit (shop_id, created_at DESC);

ALTER TABLE public.shop_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_feature_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_feature_overrides_admin ON public.shop_feature_overrides;
CREATE POLICY shop_feature_overrides_admin ON public.shop_feature_overrides FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());
DROP POLICY IF EXISTS shop_feature_overrides_owner_read ON public.shop_feature_overrides;
CREATE POLICY shop_feature_overrides_owner_read ON public.shop_feature_overrides FOR SELECT
  USING (public.user_owns_shop(shop_id));

DROP POLICY IF EXISTS shop_feature_audit_admin ON public.shop_feature_audit;
CREATE POLICY shop_feature_audit_admin ON public.shop_feature_audit FOR SELECT
  USING (public.is_platform_admin());

-- ============================================================
-- MANAGER REPORTS (shop owner → admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manager_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'operational'
    CHECK (category IN ('operational', 'stock', 'customer', 'staff', 'maintenance', 'observation', 'incident')),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'read', 'in_progress', 'archived')),
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  admin_replied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_reports_shop ON public.manager_reports (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_reports_status ON public.manager_reports (status, created_at DESC);

ALTER TABLE public.manager_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manager_reports_owner ON public.manager_reports;
CREATE POLICY manager_reports_owner ON public.manager_reports FOR SELECT
  USING (public.user_owns_shop(shop_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS manager_reports_owner_insert ON public.manager_reports;
CREATE POLICY manager_reports_owner_insert ON public.manager_reports FOR INSERT
  WITH CHECK (public.user_owns_shop(shop_id) AND author_user_id = auth.uid());
DROP POLICY IF EXISTS manager_reports_admin_update ON public.manager_reports;
CREATE POLICY manager_reports_admin_update ON public.manager_reports FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ============================================================
-- CHAT READS + PREVIEWS
-- ============================================================
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

CREATE TABLE IF NOT EXISTS public.chat_reads (
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_reads_own ON public.chat_reads;
CREATE POLICY chat_reads_own ON public.chat_reads FOR ALL
  USING (user_id = auth.uid() AND public.chat_can_read(conversation_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.chat_can_read(conversation_id, auth.uid()));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS href TEXT;
ALTER TABLE public.shop_notifications
  ADD COLUMN IF NOT EXISTS href TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- ============================================================
-- PACKAGE FEATURES (payroll is Kristen+)
-- ============================================================
CREATE OR REPLACE FUNCTION public.package_features(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_key = 'sandra' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","payroll","receipts","analytics","advanced_pos","advanced_inventory","priority_support","early_access"]'::jsonb;
  END IF;
  IF p_key = 'kristen' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop","custom_branding","cover_image","advanced_storefront","blogs","advanced_promotions","employees","customer_chat","smart_diary_full","profit_loss","expenses","payroll","receipts"]'::jsonb;
  END IF;
  IF p_key = 'thabi' THEN
    RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic","customer_reviews","reports_standard","smart_diary_limited","one_shop"]'::jsonb;
  END IF;
  RETURN '["dashboard","product_listings","digital_storefront","settings","inventory","pos","promotions","order_management","notifications","business_profile_basic"]'::jsonb;
END;
$$;

UPDATE public.subscription_plans p
SET features = public.package_features(p.package_key)
WHERE p.package_key IN ('thabi', 'kristen', 'sandra');

CREATE OR REPLACE FUNCTION public.shop_package_key(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg TEXT;
BEGIN
  SELECT s.package_key INTO pkg
  FROM public.subscriptions s
  WHERE s.shop_id = p_shop_id
    AND s.status IN ('active', 'trial')
    AND s.renewal_date >= CURRENT_DATE
    AND COALESCE(s.package_key, '') IN ('thabi', 'kristen', 'sandra')
  ORDER BY s.created_at DESC
  LIMIT 1;
  RETURN COALESCE(pkg, 'free');
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_has_feature(p_shop_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg TEXT;
  disabled BOOLEAN := FALSE;
BEGIN
  IF p_shop_id IS NULL OR NULLIF(trim(p_feature), '') IS NULL THEN
    RETURN FALSE;
  END IF;
  pkg := public.shop_package_key(p_shop_id);
  IF NOT (public.package_features(pkg) ? p_feature) THEN
    RETURN FALSE;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.shop_feature_overrides o
    WHERE o.shop_id = p_shop_id AND o.feature_key = p_feature AND o.enabled = FALSE
  ) INTO disabled;
  RETURN NOT disabled;
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_enabled_features(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg TEXT;
  feats JSONB;
  disabled JSONB := '[]'::jsonb;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing shop');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  pkg := public.shop_package_key(p_shop_id);
  SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
    INTO feats
  FROM jsonb_array_elements_text(public.package_features(pkg)) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.shop_feature_overrides o
    WHERE o.shop_id = p_shop_id AND o.feature_key = f AND o.enabled = FALSE
  );
  SELECT COALESCE(jsonb_agg(to_jsonb(o.feature_key)), '[]'::jsonb)
    INTO disabled
  FROM public.shop_feature_overrides o
  WHERE o.shop_id = p_shop_id AND o.enabled = FALSE;
  RETURN jsonb_build_object(
    'ok', true,
    'package_key', pkg,
    'features', feats,
    'disabled', disabled
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_shop_feature(
  p_shop_id UUID,
  p_feature TEXT,
  p_enabled BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev BOOLEAN;
  key TEXT := lower(trim(p_feature));
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
  END IF;
  IF key = '' OR key !~ '^[a-z0-9_]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid feature');
  END IF;
  SELECT enabled INTO prev
  FROM public.shop_feature_overrides
  WHERE shop_id = p_shop_id AND feature_key = key;

  IF p_enabled THEN
    DELETE FROM public.shop_feature_overrides
    WHERE shop_id = p_shop_id AND feature_key = key;
  ELSE
    INSERT INTO public.shop_feature_overrides (shop_id, feature_key, enabled, note, updated_by)
    VALUES (p_shop_id, key, FALSE, NULLIF(trim(COALESCE(p_note, '')), ''), auth.uid())
    ON CONFLICT (shop_id, feature_key) DO UPDATE
      SET enabled = FALSE,
          note = EXCLUDED.note,
          updated_by = auth.uid(),
          updated_at = NOW();
  END IF;

  INSERT INTO public.shop_feature_audit (shop_id, feature_key, previous_enabled, enabled, note, actor_id)
  VALUES (p_shop_id, key, COALESCE(prev, TRUE), p_enabled, NULLIF(trim(COALESCE(p_note, '')), ''), auth.uid());

  PERFORM public.log_security_event(
    'shop_feature_toggle', auth.uid(), NULL, p_shop_id, key, NULL, NULL, 'success',
    jsonb_build_object('enabled', p_enabled)
  );
  RETURN jsonb_build_object('ok', true, 'feature', key, 'enabled', p_enabled);
END;
$$;

-- ============================================================
-- EMPLOYEE / PAYROLL / EXPENSE RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.next_employee_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.employees WHERE shop_id = p_shop_id;
  RETURN 'EMP-' || lpad(n::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_employee(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop UUID;
  emp_id UUID;
  rec public.employees%ROWTYPE;
  name_val TEXT;
  salary_val NUMERIC;
  number_val TEXT;
  email_val TEXT;
  phone_val TEXT;
BEGIN
  shop := (p_payload->>'shop_id')::uuid;
  emp_id := NULLIF(p_payload->>'id', '')::uuid;
  IF shop IS NULL OR NOT public.user_owns_shop(shop) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(shop, 'employees') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee management is not available for this shop');
  END IF;

  name_val := left(trim(COALESCE(p_payload->>'name', '')), 80);
  IF length(name_val) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Full name is required');
  END IF;
  salary_val := GREATEST(0, COALESCE((p_payload->>'salary')::numeric, 0));
  number_val := NULLIF(left(trim(COALESCE(p_payload->>'employee_number', '')), 24), '');
  email_val := NULLIF(lower(trim(COALESCE(p_payload->>'email', ''))), '');
  phone_val := NULLIF(left(trim(COALESCE(p_payload->>'phone', '')), 24), '');

  IF emp_id IS NOT NULL THEN
    SELECT * INTO rec FROM public.employees WHERE id = emp_id AND shop_id = shop FOR UPDATE;
    IF rec.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Employee not found');
    END IF;
    UPDATE public.employees SET
      name = name_val,
      employee_number = COALESCE(number_val, employee_number),
      role_title = NULLIF(left(trim(COALESCE(p_payload->>'role_title', '')), 80), ''),
      department = NULLIF(left(trim(COALESCE(p_payload->>'department', '')), 80), ''),
      employment_type = CASE
        WHEN p_payload->>'employment_type' IN ('full_time', 'part_time', 'contract', 'casual')
        THEN p_payload->>'employment_type' ELSE employment_type END,
      phone = phone_val,
      email = email_val,
      address = NULLIF(left(trim(COALESCE(p_payload->>'address', '')), 160), ''),
      start_date = NULLIF(p_payload->>'start_date', '')::date,
      salary = salary_val,
      pay_frequency = CASE
        WHEN p_payload->>'pay_frequency' IN ('weekly', 'fortnightly', 'monthly')
        THEN p_payload->>'pay_frequency' ELSE pay_frequency END,
      payment_details = NULLIF(left(trim(COALESCE(p_payload->>'payment_details', '')), 120), ''),
      emergency_contact_name = NULLIF(left(trim(COALESCE(p_payload->>'emergency_contact_name', '')), 80), ''),
      emergency_contact_phone = NULLIF(left(trim(COALESCE(p_payload->>'emergency_contact_phone', '')), 24), ''),
      notes = NULLIF(left(trim(COALESCE(p_payload->>'notes', '')), 1000), ''),
      photo_url = NULLIF(left(trim(COALESCE(p_payload->>'photo_url', '')), 500), ''),
      updated_at = NOW()
    WHERE id = rec.id
    RETURNING * INTO rec;
  ELSE
    IF number_val IS NULL THEN
      number_val := public.next_employee_number(shop);
    END IF;
    INSERT INTO public.employees (
      shop_id, name, employee_number, role_title, department, employment_type,
      phone, email, address, start_date, salary, pay_frequency, payment_details,
      emergency_contact_name, emergency_contact_phone, notes, photo_url, is_active, status
    ) VALUES (
      shop, name_val, number_val,
      NULLIF(left(trim(COALESCE(p_payload->>'role_title', '')), 80), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'department', '')), 80), ''),
      CASE WHEN p_payload->>'employment_type' IN ('full_time', 'part_time', 'contract', 'casual')
        THEN p_payload->>'employment_type' ELSE 'full_time' END,
      phone_val, email_val,
      NULLIF(left(trim(COALESCE(p_payload->>'address', '')), 160), ''),
      NULLIF(p_payload->>'start_date', '')::date,
      salary_val,
      CASE WHEN p_payload->>'pay_frequency' IN ('weekly', 'fortnightly', 'monthly')
        THEN p_payload->>'pay_frequency' ELSE 'monthly' END,
      NULLIF(left(trim(COALESCE(p_payload->>'payment_details', '')), 120), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'emergency_contact_name', '')), 80), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'emergency_contact_phone', '')), 24), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'notes', '')), 1000), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'photo_url', '')), 500), ''),
      TRUE, 'active'
    )
    RETURNING * INTO rec;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'employee_number', rec.employee_number);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That employee number is already used');
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_employee(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.employees%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.employees WHERE id = p_employee_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee not found');
  END IF;
  IF NOT public.user_owns_shop(rec.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(rec.shop_id, 'employees') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee management is not available for this shop');
  END IF;
  UPDATE public.employees
  SET is_active = FALSE,
      status = 'inactive',
      deactivated_at = COALESCE(deactivated_at, NOW()),
      updated_at = NOW()
  WHERE id = rec.id;
  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'status', 'inactive');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_payroll_record(
  p_employee_id UUID,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_deductions NUMERIC DEFAULT 0,
  p_bonuses NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp public.employees%ROWTYPE;
  period UUID;
  deductions NUMERIC := GREATEST(0, COALESCE(p_deductions, 0));
  bonuses NUMERIC := GREATEST(0, COALESCE(p_bonuses, 0));
  gross NUMERIC;
  net NUMERIC;
  rec_id UUID;
BEGIN
  SELECT * INTO emp FROM public.employees WHERE id = p_employee_id;
  IF emp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Employee not found');
  END IF;
  IF NOT public.user_owns_shop(emp.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(emp.shop_id, 'payroll') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payroll is not available for this shop');
  END IF;
  IF emp.status <> 'active' OR emp.is_active = FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This employee is not active');
  END IF;

  SELECT id INTO period FROM public.financial_periods
  WHERE shop_id = emp.shop_id AND is_current = TRUE LIMIT 1;
  IF period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;

  gross := GREATEST(0, COALESCE(emp.salary, 0));
  IF deductions > gross + bonuses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deductions cannot exceed pay');
  END IF;
  net := gross + bonuses - deductions;

  INSERT INTO public.payroll_records (
    shop_id, employee_id, period_id, employee_name, gross_pay, deductions, bonuses,
    net_pay, period_start, period_end, status, notes, recorded_by_user_id
  ) VALUES (
    emp.shop_id, emp.id, period, emp.name, gross, deductions, bonuses, net,
    p_period_start, p_period_end, 'draft', NULLIF(left(trim(COALESCE(p_notes, '')), 500), ''), auth.uid()
  )
  RETURNING id INTO rec_id;

  RETURN jsonb_build_object('ok', true, 'id' , rec_id, 'net_pay', net, 'status', 'draft');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_payroll_status(p_payroll_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.payroll_records%ROWTYPE;
  next_status TEXT := lower(trim(p_status));
BEGIN
  SELECT * INTO rec FROM public.payroll_records WHERE id = p_payroll_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payroll record not found');
  END IF;
  IF NOT public.user_owns_shop(rec.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(rec.shop_id, 'payroll') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Payroll is not available for this shop');
  END IF;
  IF rec.status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Paid payroll cannot be changed');
  END IF;
  IF rec.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This payroll record is cancelled');
  END IF;

  IF next_status = 'pending' AND rec.status = 'draft' THEN
    UPDATE public.payroll_records SET status = 'pending' WHERE id = rec.id;
  ELSIF next_status = 'approved' AND rec.status IN ('draft', 'pending') THEN
    UPDATE public.payroll_records SET status = 'approved' WHERE id = rec.id;
  ELSIF next_status = 'paid' AND rec.status IN ('draft', 'pending', 'approved') THEN
    UPDATE public.payroll_records
    SET status = 'paid', paid_at = NOW(), payment_date = CURRENT_DATE
    WHERE id = rec.id;
    INSERT INTO public.shop_notifications (shop_id, title, message, type, href)
    VALUES (
      rec.shop_id,
      'Payroll paid',
      left('Paid ' || rec.employee_name, 80),
      'payroll',
      '/shop/payroll'
    );
  ELSIF next_status = 'cancelled' AND rec.status IN ('draft', 'pending', 'approved') THEN
    UPDATE public.payroll_records SET status = 'cancelled' WHERE id = rec.id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'That status change is not allowed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'status', next_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_shop_expense(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop UUID;
  rec_id UUID;
  rec public.shop_expenses%ROWTYPE;
  period UUID;
  amount_val NUMERIC;
  desc_val TEXT;
  date_val DATE;
  nonce TEXT;
BEGIN
  shop := (p_payload->>'shop_id')::uuid;
  rec_id := NULLIF(p_payload->>'id', '')::uuid;
  IF shop IS NULL OR NOT public.user_owns_shop(shop) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(shop, 'expenses') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expenses are not available for this shop');
  END IF;

  amount_val := COALESCE((p_payload->>'amount')::numeric, -1);
  IF amount_val IS NULL OR amount_val < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be zero or more');
  END IF;
  desc_val := left(trim(COALESCE(p_payload->>'description', '')), 240);
  IF desc_val = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Description is required');
  END IF;
  date_val := COALESCE(NULLIF(p_payload->>'expense_date', '')::date, CURRENT_DATE);
  IF date_val > (CURRENT_DATE + 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Date cannot be in the future');
  END IF;
  nonce := NULLIF(left(trim(COALESCE(p_payload->>'client_nonce', '')), 64), '');

  SELECT id INTO period FROM public.financial_periods
  WHERE shop_id = shop AND is_current = TRUE LIMIT 1;
  IF period IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No current financial period');
  END IF;

  IF rec_id IS NOT NULL THEN
    SELECT * INTO rec FROM public.shop_expenses WHERE id = rec_id AND shop_id = shop FOR UPDATE;
    IF rec.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
    END IF;
    IF rec.status = 'voided' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Voided expenses cannot be edited');
    END IF;
    IF rec.period_id IS DISTINCT FROM period THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Archived period records are read-only');
    END IF;
    UPDATE public.shop_expenses SET
      category = COALESCE(NULLIF(left(trim(COALESCE(p_payload->>'category', '')), 40), ''), category),
      description = desc_val,
      amount = amount_val,
      expense_date = date_val,
      payment_method = NULLIF(left(trim(COALESCE(p_payload->>'payment_method', '')), 40), ''),
      reference = NULLIF(left(trim(COALESCE(p_payload->>'reference', '')), 80), ''),
      receipt_url = NULLIF(left(trim(COALESCE(p_payload->>'receipt_url', '')), 500), ''),
      updated_at = NOW()
    WHERE id = rec.id
    RETURNING * INTO rec;
  ELSE
    INSERT INTO public.shop_expenses (
      shop_id, period_id, category, description, amount, expense_date,
      payment_method, reference, receipt_url, recorded_by_user_id, client_nonce, status
    ) VALUES (
      shop, period,
      COALESCE(NULLIF(left(trim(COALESCE(p_payload->>'category', '')), 40), ''), 'other'),
      desc_val, amount_val, date_val,
      NULLIF(left(trim(COALESCE(p_payload->>'payment_method', '')), 40), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'reference', '')), 80), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'receipt_url', '')), 500), ''),
      auth.uid(), nonce, 'active'
    )
    RETURNING * INTO rec;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', rec.id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This expense was already saved');
END;
$$;

CREATE OR REPLACE FUNCTION public.void_shop_expense(p_expense_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.shop_expenses%ROWTYPE;
  period UUID;
BEGIN
  SELECT * INTO rec FROM public.shop_expenses WHERE id = p_expense_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
  END IF;
  IF NOT public.user_owns_shop(rec.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(rec.shop_id, 'expenses') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expenses are not available for this shop');
  END IF;
  SELECT id INTO period FROM public.financial_periods
  WHERE shop_id = rec.shop_id AND is_current = TRUE LIMIT 1;
  IF rec.period_id IS DISTINCT FROM period THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Archived period records are read-only');
  END IF;
  IF rec.status = 'voided' THEN
    RETURN jsonb_build_object('ok', true, 'id', rec.id, 'status', 'voided');
  END IF;
  UPDATE public.shop_expenses
  SET status = 'voided', voided_at = NOW(), voided_by = auth.uid(), updated_at = NOW()
  WHERE id = rec.id;
  RETURN jsonb_build_object('ok', true, 'id', rec.id, 'status', 'voided');
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_platform_expense(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.platform_expenses%ROWTYPE;
  rec_id UUID;
  amount_val NUMERIC;
  desc_val TEXT;
  nonce TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  rec_id := NULLIF(p_payload->>'id', '')::uuid;
  amount_val := COALESCE((p_payload->>'amount')::numeric, -1);
  IF amount_val IS NULL OR amount_val < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Amount must be zero or more');
  END IF;
  desc_val := left(trim(COALESCE(p_payload->>'description', '')), 240);
  IF desc_val = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Description is required');
  END IF;
  nonce := NULLIF(left(trim(COALESCE(p_payload->>'client_nonce', '')), 64), '');

  IF rec_id IS NOT NULL THEN
    SELECT * INTO rec FROM public.platform_expenses WHERE id = rec_id FOR UPDATE;
    IF rec.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
    END IF;
    IF rec.status = 'voided' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Voided expenses cannot be edited');
    END IF;
    UPDATE public.platform_expenses SET
      category = COALESCE(NULLIF(left(trim(COALESCE(p_payload->>'category', '')), 40), ''), category),
      description = desc_val,
      amount = amount_val,
      expense_date = COALESCE(NULLIF(p_payload->>'expense_date', '')::date, expense_date),
      payment_method = NULLIF(left(trim(COALESCE(p_payload->>'payment_method', '')), 40), ''),
      reference = NULLIF(left(trim(COALESCE(p_payload->>'reference', '')), 80), ''),
      updated_at = NOW()
    WHERE id = rec.id
    RETURNING * INTO rec;
  ELSE
    INSERT INTO public.platform_expenses (
      category, description, amount, expense_date, payment_method, reference, recorded_by, client_nonce
    ) VALUES (
      COALESCE(NULLIF(left(trim(COALESCE(p_payload->>'category', '')), 40), ''), 'operations'),
      desc_val, amount_val,
      COALESCE(NULLIF(p_payload->>'expense_date', '')::date, CURRENT_DATE),
      NULLIF(left(trim(COALESCE(p_payload->>'payment_method', '')), 40), ''),
      NULLIF(left(trim(COALESCE(p_payload->>'reference', '')), 80), ''),
      auth.uid(), nonce
    )
    RETURNING * INTO rec;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', rec.id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This expense was already saved');
END;
$$;

CREATE OR REPLACE FUNCTION public.void_platform_expense(p_expense_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  UPDATE public.platform_expenses
  SET status = 'voided', voided_at = NOW(), voided_by = auth.uid(), updated_at = NOW()
  WHERE id = p_expense_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expense not found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_expense_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_manager_report(
  p_shop_id UUID,
  p_title TEXT,
  p_category TEXT,
  p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_id UUID;
  cat TEXT := lower(trim(COALESCE(p_category, 'operational')));
  title TEXT := left(trim(COALESCE(p_title, '')), 120);
  body TEXT := left(trim(COALESCE(p_body, '')), 4000);
BEGIN
  IF NOT public.user_owns_shop(p_shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF title = '' OR body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Title and details are required');
  END IF;
  IF cat NOT IN ('operational', 'stock', 'customer', 'staff', 'maintenance', 'observation', 'incident') THEN
    cat := 'operational';
  END IF;
  INSERT INTO public.manager_reports (shop_id, author_user_id, title, category, body)
  VALUES (p_shop_id, auth.uid(), title, cat, body)
  RETURNING id INTO rec_id;
  RETURN jsonb_build_object('ok', true, 'id', rec_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_manager_report(
  p_report_id UUID,
  p_status TEXT DEFAULT NULL,
  p_reply TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.manager_reports%ROWTYPE;
  next_status TEXT := NULLIF(lower(trim(COALESCE(p_status, ''))), '');
  reply TEXT := NULLIF(left(trim(COALESCE(p_reply, '')), 2000), '');
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO rec FROM public.manager_reports WHERE id = p_report_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Report not found');
  END IF;
  IF next_status IS NOT NULL AND next_status NOT IN ('open', 'read', 'in_progress', 'archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status');
  END IF;
  UPDATE public.manager_reports SET
    status = COALESCE(next_status, CASE WHEN rec.status = 'open' AND reply IS NOT NULL THEN 'read' ELSE rec.status END),
    admin_reply = COALESCE(reply, admin_reply),
    admin_replied_at = CASE WHEN reply IS NOT NULL THEN NOW() ELSE admin_replied_at END,
    admin_replied_by = CASE WHEN reply IS NOT NULL THEN auth.uid() ELSE admin_replied_by END,
    updated_at = NOW()
  WHERE id = rec.id;
  IF reply IS NOT NULL THEN
    INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
    VALUES (rec.shop_id, 'Admin replied to your report', left(rec.title, 80), 'report', '/shop/reports', rec.id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', rec.id);
END;
$$;

-- ============================================================
-- TIGHTEN PRIVATE FINANCIAL RLS (shop owner only)
-- ============================================================
DROP POLICY IF EXISTS expenses_owner ON public.shop_expenses;
CREATE POLICY expenses_owner_read ON public.shop_expenses FOR SELECT
  USING (public.user_owns_shop(shop_id));
CREATE POLICY expenses_owner_write ON public.shop_expenses FOR INSERT
  WITH CHECK (FALSE);
CREATE POLICY expenses_owner_update ON public.shop_expenses FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS employees_owner ON public.employees;
CREATE POLICY employees_owner_read ON public.employees FOR SELECT
  USING (public.user_owns_shop(shop_id));
CREATE POLICY employees_owner_write ON public.employees FOR INSERT
  WITH CHECK (FALSE);
CREATE POLICY employees_owner_update ON public.employees FOR UPDATE
  USING (FALSE);
CREATE POLICY employees_owner_delete ON public.employees FOR DELETE
  USING (FALSE);

DROP POLICY IF EXISTS payroll_owner ON public.payroll_records;
CREATE POLICY payroll_owner_read ON public.payroll_records FOR SELECT
  USING (public.user_owns_shop(shop_id));
CREATE POLICY payroll_owner_write ON public.payroll_records FOR INSERT
  WITH CHECK (FALSE);
CREATE POLICY payroll_owner_update ON public.payroll_records FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS inventory_owner ON public.inventory_transactions;
CREATE POLICY inventory_owner_read ON public.inventory_transactions FOR SELECT
  USING (public.user_owns_shop(shop_id));
CREATE POLICY inventory_owner_insert ON public.inventory_transactions FOR INSERT
  WITH CHECK (public.user_owns_shop(shop_id));
CREATE POLICY inventory_owner_mutate ON public.inventory_transactions FOR UPDATE
  USING (FALSE);
CREATE POLICY inventory_owner_delete ON public.inventory_transactions FOR DELETE
  USING (FALSE);

-- ============================================================
-- INVENTORY ADJUST WITH REASON
-- ============================================================
DROP FUNCTION IF EXISTS public.adjust_product_stock(UUID, INTEGER);
CREATE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_delta INTEGER,
  p_reason TEXT DEFAULT 'adjustment',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  next_stock INTEGER;
  tx_type TEXT;
  reason TEXT := lower(trim(COALESCE(p_reason, 'adjustment')));
BEGIN
  SELECT * INTO product_row FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  IF NOT public.user_owns_shop(product_row.shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF NOT public.shop_has_feature(product_row.shop_id, 'inventory') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Inventory is not available for this shop');
  END IF;
  IF COALESCE(p_delta, 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a stock change');
  END IF;
  IF reason NOT IN ('restock', 'adjustment', 'damaged', 'returned', 'correction', 'received') THEN
    reason := 'adjustment';
  END IF;
  tx_type := CASE
    WHEN reason IN ('restock', 'received') THEN 'received'
    WHEN reason = 'damaged' THEN 'damaged'
    WHEN reason = 'returned' THEN 'returned'
    ELSE 'adjustment'
  END;
  next_stock := GREATEST(COALESCE(product_row.stock, 0) + COALESCE(p_delta, 0), 0);
  UPDATE public.products SET stock = next_stock, updated_at = NOW() WHERE id = product_row.id;
  INSERT INTO public.inventory_transactions (
    shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, notes, reason, created_by
  ) VALUES (
    product_row.shop_id, product_row.id, tx_type, COALESCE(p_delta, 0), product_row.stock, next_stock,
    NULLIF(left(trim(COALESCE(p_notes, '')), 240), ''), reason, auth.uid()
  );
  IF next_stock <= COALESCE(product_row.low_stock_threshold, 0) THEN
    INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
    VALUES (
      product_row.shop_id,
      CASE WHEN next_stock <= 0 THEN 'Out of stock' ELSE 'Low stock' END,
      left(product_row.name, 80),
      'inventory',
      '/shop/inventory',
      product_row.id
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'stock', next_stock);
END;
$$;

CREATE OR REPLACE FUNCTION public.shop_inventory_insights(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sold_30 INTEGER := 0;
BEGIN
  IF NOT public.user_owns_shop(p_shop_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT COUNT(*) INTO sold_30
  FROM public.inventory_transactions
  WHERE shop_id = p_shop_id AND transaction_type = 'sold'
    AND created_at >= NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'ok', true,
    'insufficient_movement_data', sold_30 < 5,
    'low_stock', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock, 'threshold', p.low_stock_threshold))
      FROM public.products p
      WHERE p.shop_id = p_shop_id AND p.type = 'product'
        AND p.stock IS NOT NULL AND p.low_stock_threshold IS NOT NULL
        AND p.stock > 0 AND p.stock <= p.low_stock_threshold
    ), '[]'::jsonb),
    'out_of_stock', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock))
      FROM public.products p
      WHERE p.shop_id = p_shop_id AND p.type = 'product' AND COALESCE(p.stock, 0) <= 0
    ), '[]'::jsonb),
    'recently_restocked', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT * FROM (
          SELECT DISTINCT ON (t.product_id) t.product_id, p.name, t.new_quantity, t.created_at
          FROM public.inventory_transactions t
          JOIN public.products p ON p.id = t.product_id
          WHERE t.shop_id = p_shop_id AND t.transaction_type IN ('received', 'returned')
          ORDER BY t.product_id, t.created_at DESC
        ) latest
        ORDER BY created_at DESC
        LIMIT 8
      ) x
    ), '[]'::jsonb),
    'fast_moving', CASE WHEN sold_30 < 5 THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT p.id, p.name, SUM(ABS(t.quantity)) AS moved
        FROM public.inventory_transactions t
        JOIN public.products p ON p.id = t.product_id
        WHERE t.shop_id = p_shop_id AND t.transaction_type = 'sold'
          AND t.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name
        ORDER BY moved DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb) END,
    'slow_moving', CASE WHEN sold_30 < 5 THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock))
      FROM public.products p
      WHERE p.shop_id = p_shop_id AND p.type = 'product'
        AND NOT EXISTS (
          SELECT 1 FROM public.inventory_transactions t
          WHERE t.product_id = p.id AND t.transaction_type = 'sold'
            AND t.created_at >= NOW() - INTERVAL '30 days'
        )
      ORDER BY p.name
      LIMIT 5
    ), '[]'::jsonb) END
  );
END;
$$;

-- ============================================================
-- DASHBOARD STATS: sales − expenses − payroll (matches period archive)
-- ============================================================
CREATE OR REPLACE FUNCTION public.shop_dashboard_stats(
  p_shop_id UUID,
  p_period TEXT DEFAULT 'current',
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounds RECORD;
  current_period UUID;
  start_at TIMESTAMPTZ;
  end_at TIMESTAMPTZ;
  revenue NUMERIC := 0;
  expenses NUMERIC := 0;
  payroll NUMERIC := 0;
  cogs NUMERIC := 0;
  paid_volume NUMERIC := 0;
  refunded_volume NUMERIC := 0;
  pending_orders INTEGER := 0;
  completed_orders INTEGER := 0;
  product_count INTEGER := 0;
  service_count INTEGER := 0;
  customer_count INTEGER := 0;
  inventory_units INTEGER := 0;
  low_stock INTEGER := 0;
  active_promos INTEGER := 0;
  refund_count INTEGER := 0;
  employee_count INTEGER := 0;
  cats JSONB := '[]'::jsonb;
  profit NUMERIC := 0;
  privileged BOOLEAN := auth.role() = 'service_role'
    OR current_setting('lagecto.internal_stebo', true) = 'true'
    OR public.user_owns_shop(p_shop_id);
BEGIN
  IF NOT privileged THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT id INTO current_period
  FROM public.financial_periods
  WHERE shop_id = p_shop_id AND is_current = TRUE
  LIMIT 1;

  IF p_period = 'current' OR (p_period IS NULL AND p_from IS NULL) THEN
    SELECT COALESCE(SUM(total), 0) INTO revenue
    FROM public.sales
    WHERE shop_id = p_shop_id AND status = 'completed' AND period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO expenses
    FROM public.shop_expenses
    WHERE shop_id = p_shop_id AND period_id = current_period AND status = 'active';

    SELECT COALESCE(SUM(net_pay), 0) INTO payroll
    FROM public.payroll_records
    WHERE shop_id = p_shop_id AND period_id = current_period AND status = 'paid';

    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) INTO cogs
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.shop_id = p_shop_id AND s.status = 'completed' AND s.period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO paid_volume
    FROM public.payments
    WHERE shop_id = p_shop_id AND status = 'paid' AND period_id = current_period;

    SELECT COALESCE(SUM(amount), 0) INTO refunded_volume
    FROM public.payment_refunds
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND payment_id IN (SELECT id FROM public.payments WHERE shop_id = p_shop_id AND period_id = current_period);

    SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'amount', amount)), '[]'::jsonb)
      INTO cats
    FROM (
      SELECT category, SUM(amount) AS amount
      FROM public.shop_expenses
      WHERE shop_id = p_shop_id AND period_id = current_period AND status = 'active'
      GROUP BY category
      ORDER BY SUM(amount) DESC
    ) t;
  ELSE
    SELECT * INTO bounds FROM public.platform_day_bounds(p_period, p_from, p_to);
    start_at := bounds.starts_at;
    end_at := bounds.ends_at;

    SELECT COALESCE(SUM(total), 0) INTO revenue
    FROM public.sales
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND sale_date >= start_at AND sale_date < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO expenses
    FROM public.shop_expenses
    WHERE shop_id = p_shop_id AND status = 'active'
      AND expense_date >= (start_at AT TIME ZONE 'Africa/Harare')::date
      AND expense_date < (end_at AT TIME ZONE 'Africa/Harare')::date;

    SELECT COALESCE(SUM(net_pay), 0) INTO payroll
    FROM public.payroll_records
    WHERE shop_id = p_shop_id AND status = 'paid'
      AND created_at >= start_at AND created_at < end_at;

    SELECT COALESCE(SUM(si.unit_cost * si.quantity), 0) INTO cogs
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.shop_id = p_shop_id AND s.status = 'completed'
      AND s.sale_date >= start_at AND s.sale_date < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO paid_volume
    FROM public.payments
    WHERE shop_id = p_shop_id AND status = 'paid'
      AND created_at >= start_at AND created_at < end_at;

    SELECT COALESCE(SUM(amount), 0) INTO refunded_volume
    FROM public.payment_refunds
    WHERE shop_id = p_shop_id AND status = 'completed'
      AND created_at >= start_at AND created_at < end_at;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'amount', amount)), '[]'::jsonb)
      INTO cats
    FROM (
      SELECT category, SUM(amount) AS amount
      FROM public.shop_expenses
      WHERE shop_id = p_shop_id AND status = 'active'
        AND expense_date >= (start_at AT TIME ZONE 'Africa/Harare')::date
        AND expense_date < (end_at AT TIME ZONE 'Africa/Harare')::date
      GROUP BY category
      ORDER BY SUM(amount) DESC
    ) t;
  END IF;

  profit := revenue - expenses - payroll;

  SELECT COUNT(*) INTO pending_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'pending';
  SELECT COUNT(*) INTO completed_orders FROM public.orders WHERE shop_id = p_shop_id AND status = 'completed';
  SELECT COUNT(*) INTO product_count FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO service_count FROM public.products WHERE shop_id = p_shop_id AND type = 'service';
  SELECT COUNT(DISTINCT customer_id) INTO customer_count FROM public.orders WHERE shop_id = p_shop_id AND customer_id IS NOT NULL;
  SELECT COALESCE(SUM(stock), 0) INTO inventory_units FROM public.products WHERE shop_id = p_shop_id AND type = 'product';
  SELECT COUNT(*) INTO low_stock FROM public.products
  WHERE shop_id = p_shop_id AND type = 'product' AND stock IS NOT NULL AND low_stock_threshold IS NOT NULL AND stock <= low_stock_threshold;
  SELECT COUNT(*) INTO active_promos FROM public.promotions WHERE shop_id = p_shop_id AND is_active = TRUE;
  SELECT COUNT(*) INTO refund_count FROM public.payment_refunds WHERE shop_id = p_shop_id AND status = 'completed';
  SELECT COUNT(*) INTO employee_count FROM public.employees WHERE shop_id = p_shop_id AND status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'timezone', 'Africa/Harare',
    'period', COALESCE(p_period, 'current'),
    'current_period_id', current_period,
    'revenue', revenue,
    'expenses', expenses,
    'payroll', payroll,
    'cogs', cogs,
    'profit', profit,
    'result', CASE WHEN profit > 0 THEN 'profit' WHEN profit < 0 THEN 'loss' ELSE 'break_even' END,
    'calculation', 'simplified_operating_profit',
    'calculation_label', 'Completed sales − operating expenses − paid payroll',
    'expense_categories', cats,
    'paid_volume', paid_volume,
    'refunded_volume', refunded_volume,
    'net_paid', paid_volume - refunded_volume,
    'pending_orders', pending_orders,
    'completed_orders', completed_orders,
    'products', product_count,
    'services', service_count,
    'customers', customer_count,
    'inventory_units', inventory_units,
    'low_stock', low_stock,
    'active_promotions', active_promos,
    'completed_refunds', refund_count,
    'employee_count', employee_count
  );
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
  IF NOT public.user_owns_shop(p_shop_id) THEN
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
    WHERE shop_id = p_shop_id AND period_id = current_period.id AND status = 'active';

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
          'result', CASE WHEN profit > 0 THEN 'profit' WHEN profit < 0 THEN 'loss' ELSE 'break_even' END,
          'calculation', 'simplified_operating_profit',
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

  label := COALESCE(NULLIF(trim(p_label), ''), to_char(NOW() AT TIME ZONE 'Africa/Harare', 'Mon YYYY'));
  INSERT INTO public.financial_periods (shop_id, label, is_current)
  VALUES (p_shop_id, label, TRUE)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'period_id', new_id, 'label', label);
END;
$$;

-- ============================================================
-- MESSAGING: notify other party, preview, feature gate
-- ============================================================
CREATE OR REPLACE FUNCTION public.chat_can_send(p_conversation_id UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.chat_conversations%ROWTYPE;
  sender_role TEXT;
BEGIN
  IF p_user IS NULL OR NOT public.chat_can_read(p_conversation_id, p_user) THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  SELECT role INTO sender_role FROM public.users WHERE id = p_user;
  IF conv.kind = 'admin_customer' THEN
    RETURN sender_role = 'admin';
  END IF;
  IF conv.kind = 'shop_admin' THEN
    RETURN sender_role = 'admin' OR public.user_owns_shop(conv.shop_id);
  END IF;
  IF conv.kind = 'shop_customer' THEN
    IF conv.shop_id IS NOT NULL AND NOT public.shop_has_feature(conv.shop_id, 'customer_chat') THEN
      RETURN FALSE;
    END IF;
    RETURN conv.customer_id = p_user OR public.user_owns_shop(conv.shop_id);
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_chat_conversation(
  p_kind TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  role TEXT;
  conv public.chat_conversations%ROWTYPE;
  kind TEXT := lower(trim(p_kind));
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT u.role INTO role FROM public.users u WHERE u.id = uid;

  IF kind = 'shop_customer' THEN
    IF p_shop_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
    END IF;
    IF NOT public.shop_has_feature(p_shop_id, 'customer_chat') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'This shop is not accepting messages right now');
    END IF;
    IF role = 'customer' THEN
      p_customer_id := uid;
    ELSIF public.user_owns_shop(p_shop_id) THEN
      IF p_customer_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Choose a customer');
      END IF;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_customer' AND shop_id = p_shop_id AND customer_id = p_customer_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, customer_id, kind, can_reply, title)
      VALUES (p_shop_id, p_customer_id, 'shop_customer', TRUE, 'Shop chat')
      RETURNING * INTO conv;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);

  ELSIF kind = 'shop_admin' THEN
    IF role = 'admin' THEN
      IF p_shop_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
      END IF;
    ELSIF role = 'shop_owner' THEN
      SELECT id INTO p_shop_id FROM public.shops
      WHERE owner_user_id = uid OR lower(owner_email) = lower(public.current_user_email())
      LIMIT 1;
      IF p_shop_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No shop assigned');
      END IF;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_admin' AND shop_id = p_shop_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, admin_id, kind, can_reply, title)
      VALUES (p_shop_id, CASE WHEN role = 'admin' THEN uid ELSE NULL END, 'shop_admin', TRUE, 'Admin support')
      RETURNING * INTO conv;
    ELSIF role = 'admin' AND conv.admin_id IS NULL THEN
      UPDATE public.chat_conversations SET admin_id = uid WHERE id = conv.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);

  ELSIF kind = 'admin_customer' THEN
    IF role <> 'admin' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    IF p_customer_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Choose a customer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_customer_id AND role = 'customer') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Customer not found');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'admin_customer' AND customer_id = p_customer_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (customer_id, admin_id, kind, can_reply, title)
      VALUES (p_customer_id, uid, 'admin_customer', FALSE, 'LaGecto announcement')
      RETURNING * INTO conv;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Unsupported conversation type');
END;
$$;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_conversation_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  msg_id UUID;
  body TEXT := left(trim(COALESCE(p_body, '')), 4000);
  conv public.chat_conversations%ROWTYPE;
  preview TEXT;
  shop_name TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Write a message');
  END IF;
  IF NOT public.chat_can_send(p_conversation_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot reply in this conversation');
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  preview := left(body, 80);
  INSERT INTO public.chat_messages (conversation_id, sender_id, body)
  VALUES (p_conversation_id, uid, body)
  RETURNING id INTO msg_id;
  UPDATE public.chat_conversations
  SET last_message_at = NOW(), last_message_preview = preview
  WHERE id = p_conversation_id;

  IF conv.kind = 'shop_customer' THEN
    SELECT name INTO shop_name FROM public.shops WHERE id = conv.shop_id;
    IF conv.customer_id IS DISTINCT FROM uid THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, href)
      VALUES (conv.customer_id, COALESCE(shop_name, 'Shop'), 'New message', 'message', conv.id, '/customer/chat?c=' || conv.id);
    ELSE
      INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
      VALUES (conv.shop_id, 'New customer message', 'You have a new chat message', 'message', '/shop/chat?c=' || conv.id, conv.id);
    END IF;
  ELSIF conv.kind = 'shop_admin' THEN
    IF public.is_platform_admin() THEN
      INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
      VALUES (conv.shop_id, 'Message from LaGecto', 'New admin message', 'message', '/shop/chat?c=' || conv.id, conv.id);
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, href)
      SELECT u.id, COALESCE((SELECT name FROM public.shops WHERE id = conv.shop_id), 'Shop'), 'New shop message', 'message', conv.id, '/admin/chat?c=' || conv.id
      FROM public.users u
      WHERE u.role = 'admin' AND u.account_status = 'active'
      LIMIT 8;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'message_id', msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_read(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.chat_can_read(p_conversation_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  INSERT INTO public.chat_reads (conversation_id, user_id, last_read_at)
  VALUES (p_conversation_id, auth.uid(), NOW())
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = NOW();
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_ops_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos_amount NUMERIC := 0;
  exp_amount NUMERIC := 0;
  unread_reports INTEGER := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT COALESCE(SUM(total), 0) INTO pos_amount FROM public.platform_receipts;
  SELECT COALESCE(SUM(amount), 0) INTO exp_amount FROM public.platform_expenses WHERE status = 'active';
  SELECT COUNT(*) INTO unread_reports FROM public.manager_reports WHERE status = 'open';
  RETURN jsonb_build_object(
    'ok', true,
    'platform_pos_amount', pos_amount,
    'platform_expenses', exp_amount,
    'platform_operating_result', pos_amount - exp_amount,
    'unread_manager_reports', unread_reports,
    'note', 'LaGecto till and operating expenses only. Shop sales are not included.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_package_key(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_enabled_features(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_feature(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_employee(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_employee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payroll_record(UUID, DATE, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_payroll_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_shop_expense(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_shop_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_platform_expense(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_platform_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_manager_report(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_manager_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_inventory_insights(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_dashboard_stats(UUID, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_financial_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_ops_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_employee_number(UUID) TO authenticated;
