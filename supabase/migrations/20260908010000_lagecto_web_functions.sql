-- LaGecto Web — security helpers, auth RPCs, financial archive, POS, checkout.

-- ============================================================
-- VALIDATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(regexp_replace(trim(COALESCE(p_username, '')), '\s+', '', 'g')), '');
$$;

CREATE OR REPLACE FUNCTION public.validate_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := public.normalize_username(p_username);
  reserved TEXT[] := ARRAY[
    'admin', 'administrator', 'lagecto', 'root', 'support', 'system',
    'null', 'undefined', 'owner', 'shop', 'staff', 'superadmin', 'gectotech'
  ];
BEGIN
  IF normalized IS NULL THEN
    RETURN 'Username is required';
  END IF;
  IF length(normalized) < 3 OR length(normalized) > 24 THEN
    RETURN 'Username must be 3 to 24 characters';
  END IF;
  IF length(normalized) = 3 AND normalized !~ '^[a-z0-9]{3}$' THEN
    RETURN 'Username may only contain letters, numbers, dots and underscores';
  END IF;
  IF length(normalized) > 3 AND normalized !~ '^[a-z0-9][a-z0-9._]+[a-z0-9]$' THEN
    RETURN 'Username may only contain letters, numbers, dots and underscores';
  END IF;
  IF normalized ~ '\.\.' OR normalized ~ '__' THEN
    RETURN 'Username cannot contain repeated separators';
  END IF;
  IF normalized = ANY (reserved) THEN
    RETURN 'That username is not available';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_full_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT := trim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g'));
BEGIN
  IF cleaned IS NULL OR length(cleaned) < 2 THEN
    RETURN 'Full name is required';
  END IF;
  IF length(cleaned) > 80 THEN
    RETURN 'Full name is too long';
  END IF;
  IF cleaned ~* '<script|javascript:|onerror=|[\x00-\x08\x0B\x0C\x0E-\x1F]' THEN
    RETURN 'Full name contains invalid characters';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_shop_name_slug(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  slug TEXT;
BEGIN
  slug := lower(trim(COALESCE(p_name, '')));
  slug := regexp_replace(slug, '[^a-z0-9]+', '', 'g');
  slug := left(slug, 24);
  IF length(slug) < 3 THEN
    slug := 'shop';
  END IF;
  RETURN slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_shop_login_id(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  slug TEXT := public.normalize_shop_name_slug(p_name);
  suffix TEXT;
  candidate TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    candidate := slug || '@lg' || suffix;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.shops WHERE lower(login_shop_id) = lower(candidate)
    );
    IF attempts > 16 THEN
      suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      candidate := slug || '@lg' || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.shops WHERE lower(login_shop_id) = lower(candidate)
      );
    END IF;
    IF attempts > 40 THEN
      RAISE EXCEPTION 'Could not generate a unique Shop ID';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_client_ip(p_ip TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_ip IS NULL OR length(trim(p_ip)) = 0 THEN NULL
    ELSE md5(trim(p_ip))
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users
  WHERE id = auth.uid() AND account_status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = p_shop_id
      AND (
        owner_user_id = auth.uid()
        OR lower(COALESCE(owner_email, '')) = lower(COALESCE(public.current_user_email(), ''))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_financial_period_id(p_shop_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.financial_periods
  WHERE shop_id = p_shop_id AND is_current = TRUE
  LIMIT 1;
$$;

-- ============================================================
-- AUDIT / RATE LIMIT / LOGIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_target_shop_id UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_result TEXT DEFAULT 'success',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    event_type, actor_id, target_user_id, target_shop_id,
    identifier, ip_hash, user_agent, result, metadata
  ) VALUES (
    p_event_type,
    p_actor_id,
    p_target_user_id,
    p_target_shop_id,
    CASE WHEN p_identifier IS NULL THEN NULL ELSE left(regexp_replace(p_identifier, '\s+', '', 'g'), 80) END,
    public.hash_client_ip(p_ip),
    left(COALESCE(p_user_agent, ''), 180),
    COALESCE(p_result, 'success'),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO event_id;
  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(
  p_bucket_key TEXT,
  p_max_hits INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.auth_rate_limits%ROWTYPE;
BEGIN
  INSERT INTO public.auth_rate_limits (bucket_key, window_started_at, hit_count)
  VALUES (p_bucket_key, NOW(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hit_count = CASE
          WHEN public.auth_rate_limits.window_started_at < NOW() - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE public.auth_rate_limits.hit_count + 1
        END,
        window_started_at = CASE
          WHEN public.auth_rate_limits.window_started_at < NOW() - make_interval(secs => p_window_seconds)
            THEN NOW()
          ELSE public.auth_rate_limits.window_started_at
        END
  RETURNING * INTO rec;
  RETURN rec.hit_count <= p_max_hits;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_login_identity(p_identifier TEXT)
RETURNS TABLE (
  user_id UUID,
  auth_email TEXT,
  account_role TEXT,
  account_status TEXT,
  login_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ident TEXT := lower(trim(COALESCE(p_identifier, '')));
  shop_row public.shops%ROWTYPE;
  user_row public.users%ROWTYPE;
BEGIN
  IF ident = '' THEN
    RETURN;
  END IF;

  IF ident ~ '^[a-z0-9]+@lg[a-z0-9]+$' THEN
    SELECT * INTO shop_row FROM public.shops WHERE lower(login_shop_id) = ident LIMIT 1;
    IF shop_row.id IS NULL THEN RETURN; END IF;
    IF shop_row.owner_user_id IS NOT NULL THEN
      SELECT * INTO user_row FROM public.users WHERE id = shop_row.owner_user_id;
    END IF;
    IF user_row.id IS NULL THEN
      SELECT * INTO user_row FROM public.users WHERE lower(email) = lower(shop_row.owner_email) LIMIT 1;
    END IF;
    IF user_row.id IS NULL THEN RETURN; END IF;
    user_id := user_row.id;
    auth_email := user_row.email;
    account_role := user_row.role;
    account_status := user_row.account_status;
    login_method := 'shop_id';
    RETURN NEXT;
    RETURN;
  END IF;

  IF ident ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    SELECT * INTO user_row FROM public.users WHERE lower(email) = ident LIMIT 1;
    IF user_row.id IS NULL THEN RETURN; END IF;
    user_id := user_row.id;
    auth_email := user_row.email;
    account_role := user_row.role;
    account_status := user_row.account_status;
    login_method := 'email';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO user_row
  FROM public.users
  WHERE username_normalized = public.normalize_username(ident)
  LIMIT 1;
  IF user_row.id IS NULL THEN RETURN; END IF;
  user_id := user_row.id;
  auth_email := user_row.email;
  account_role := user_row.role;
  account_status := user_row.account_status;
  login_method := 'username';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(
  p_identifier TEXT,
  p_user_id UUID DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ident TEXT := lower(trim(COALESCE(p_identifier, '')));
  attempts INTEGER := 0;
  locked BOOLEAN := FALSE;
  status TEXT;
BEGIN
  PERFORM set_config('lagecto.allow_security_update', 'true', true);

  INSERT INTO public.login_attempts (identifier_normalized, user_id, success, ip_hash, user_agent)
  VALUES (left(ident, 80), p_user_id, FALSE, public.hash_client_ip(p_ip), left(COALESCE(p_user_agent, ''), 180));

  IF p_user_id IS NOT NULL THEN
    UPDATE public.users
    SET
      failed_login_attempts = failed_login_attempts + 1,
      last_failed_login_at = NOW(),
      account_status = CASE
        WHEN failed_login_attempts + 1 >= 5 AND account_status = 'active' THEN 'locked'
        ELSE account_status
      END,
      locked_at = CASE
        WHEN failed_login_attempts + 1 >= 5 AND account_status = 'active' THEN NOW()
        ELSE locked_at
      END,
      locked_reason = CASE
        WHEN failed_login_attempts + 1 >= 5 AND account_status = 'active' THEN 'too_many_failed_logins'
        ELSE locked_reason
      END,
      updated_at = NOW()
    WHERE id = p_user_id
    RETURNING failed_login_attempts, account_status INTO attempts, status;

    locked := status = 'locked';
    PERFORM public.log_security_event(
      CASE WHEN locked AND attempts >= 5 THEN 'account_locked' ELSE 'login_failure' END,
      NULL, p_user_id, NULL, ident, p_ip, p_user_agent, 'failure',
      jsonb_build_object('failed_login_attempts', attempts, 'locked', locked)
    );
  ELSE
    PERFORM public.log_security_event(
      'login_failure', NULL, NULL, NULL, ident, p_ip, p_user_agent, 'failure',
      jsonb_build_object('unknown_identifier', true)
    );
  END IF;

  RETURN jsonb_build_object('failed_login_attempts', COALESCE(attempts, 0), 'locked', locked);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_success(
  p_user_id UUID,
  p_identifier TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_login_method TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET failed_login_attempts = 0, last_login_at = NOW(), updated_at = NOW()
  WHERE id = p_user_id AND account_status = 'active';
  INSERT INTO public.login_attempts (identifier_normalized, user_id, success, ip_hash, user_agent)
  VALUES (left(lower(trim(COALESCE(p_identifier, ''))), 80), p_user_id, TRUE, public.hash_client_ip(p_ip), left(COALESCE(p_user_agent, ''), 180));
  PERFORM public.log_security_event(
    CASE WHEN p_login_method = 'shop_id' THEN 'shop_owner_login_success' ELSE 'login_success' END,
    p_user_id, p_user_id, NULL, p_identifier, p_ip, p_user_agent, 'success',
    jsonb_build_object('login_method', p_login_method)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.change_username(p_new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.users%ROWTYPE;
  validation_error TEXT;
  normalized TEXT;
  next_allowed TIMESTAMPTZ;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in');
  END IF;
  SELECT * INTO rec FROM public.users WHERE id = uid FOR UPDATE;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Account not found');
  END IF;
  IF rec.account_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This account cannot change username right now');
  END IF;
  validation_error := public.validate_username(p_new_username);
  IF validation_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', validation_error);
  END IF;
  normalized := public.normalize_username(p_new_username);
  IF normalized = rec.username_normalized THEN
    RETURN jsonb_build_object('ok', true, 'username', rec.username, 'unchanged', true);
  END IF;
  IF rec.last_username_change_at IS NOT NULL
     AND rec.last_username_change_at > NOW() - INTERVAL '14 days' THEN
    next_allowed := rec.last_username_change_at + INTERVAL '14 days';
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Username can only be changed once every 14 days',
      'next_allowed_at', next_allowed
    );
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.username_normalized = normalized AND u.id <> uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That username is not available');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET username = trim(p_new_username), username_normalized = normalized,
      last_username_change_at = NOW(), updated_at = NOW()
  WHERE id = uid;
  PERFORM public.log_security_event(
    'username_changed', uid, uid, NULL, normalized, NULL, NULL, 'success',
    jsonb_build_object('previous', rec.username_normalized)
  );
  RETURN jsonb_build_object('ok', true, 'username', trim(p_new_username), 'last_username_change_at', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlock_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  PERFORM set_config('lagecto.allow_security_update', 'true', true);
  UPDATE public.users
  SET account_status = 'active',
      failed_login_attempts = 0,
      locked_at = NULL,
      locked_reason = NULL,
      unlocked_at = NOW(),
      unlocked_by = auth.uid(),
      updated_at = NOW()
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;
  PERFORM public.log_security_event(
    'account_unlocked', auth.uid(), p_user_id, NULL, NULL, NULL, NULL, 'success', '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- PROFILE TRIGGER + MASS ASSIGNMENT GUARD
-- ============================================================
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
BEGIN
  INSERT INTO public.users (id, email, name, phone, username, username_normalized, role)
  VALUES (
    NEW.id,
    NEW.email,
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_user_security_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('lagecto.allow_security_update', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
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

DROP TRIGGER IF EXISTS trg_protect_user_security ON public.users;
CREATE TRIGGER trg_protect_user_security
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_security_columns();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','shops','subscriptions','products','orders','sales',
    'shop_expenses','notifications','user_settings','shop_settings',
    'shop_registration_requests','verification_requests','diary_journal_entries'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_shop_rating_stats()
RETURNS TRIGGER AS $$
DECLARE target_shop_id UUID;
BEGIN
  target_shop_id := COALESCE(NEW.shop_id, OLD.shop_id);
  UPDATE public.shops s SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.ratings r
      WHERE r.shop_id = target_shop_id AND r.is_hidden = FALSE
    ), 0),
    total_reviews = COALESCE((
      SELECT COUNT(*) FROM public.ratings r
      WHERE r.shop_id = target_shop_id AND r.is_hidden = FALSE
    ), 0),
    updated_at = NOW()
  WHERE s.id = target_shop_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_refresh_shop_rating_stats ON public.ratings;
CREATE TRIGGER trg_refresh_shop_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_shop_rating_stats();

CREATE OR REPLACE FUNCTION public.ensure_shop_financial_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.financial_periods WHERE shop_id = NEW.id AND is_current) THEN
    INSERT INTO public.financial_periods (shop_id, label, is_current)
    VALUES (NEW.id, to_char(NOW(), 'FMMonth YYYY'), TRUE);
  END IF;
  INSERT INTO public.shop_settings (shop_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_shop_financial_period ON public.shops;
CREATE TRIGGER trg_shop_financial_period
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.ensure_shop_financial_period();

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'LG-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
$$;

CREATE OR REPLACE FUNCTION public.next_receipt_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO n FROM public.receipts WHERE shop_id = p_shop_id;
  RETURN 'R-' || to_char(NOW(), 'YYYYMM') || '-' || lpad(n::text, 5, '0');
END;
$$;

-- ============================================================
-- FINANCIAL ARCHIVE
-- ============================================================
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
          'ended_at', NOW()
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
-- CHECKOUT (server-authoritative totals)
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
BEGIN
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
    items, subtotal, total, status, payment_method, notes
  ) VALUES (
    order_no, p_shop_id, uid, period, profile.name, profile.email, profile.phone,
    built_items, subtotal, subtotal, 'pending', p_payment_method, left(COALESCE(p_notes, ''), 400)
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

  RETURN jsonb_build_object('ok', true, 'order_id', order_id, 'order_number', order_no, 'total', subtotal);
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
  receipt_no TEXT;
  period UUID;
  profit NUMERIC := 0;
  product_row public.products%ROWTYPE;
BEGIN
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

  INSERT INTO public.sales (
    shop_id, order_id, period_id, sale_number, customer_id, customer_name,
    subtotal, total, profit, payment_method, status, completed_by_user_id
  ) VALUES (
    ord.shop_id, ord.id, period, replace(ord.order_number, 'LG-', 'S-'),
    ord.customer_id, ord.customer_name, ord.subtotal, ord.total, profit,
    ord.payment_method, 'completed', auth.uid()
  )
  RETURNING id INTO sale_id;

  receipt_no := public.next_receipt_number(ord.shop_id);
  INSERT INTO public.receipts (
    shop_id, sale_id, order_id, customer_id, period_id, receipt_number,
    customer_name, customer_email, customer_phone, subtotal, total, payment_method,
    shop_details
  )
  SELECT
    ord.shop_id, sale_id, ord.id, ord.customer_id, period, receipt_no,
    ord.customer_name, ord.customer_email, ord.customer_phone, ord.subtotal, ord.total, ord.payment_method,
    jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone, 'email', s.email, 'logo_url', s.logo_url)
  FROM public.shops s WHERE s.id = ord.shop_id
  RETURNING id INTO receipt_id;

  INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT receipt_id, (i->>'product_id')::uuid, i->>'name', (i->>'quantity')::int, (i->>'price')::numeric,
         (i->>'price')::numeric * (i->>'quantity')::int
  FROM jsonb_array_elements(ord.items) i;

  IF ord.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id)
    VALUES (ord.customer_id, 'Order completed', 'Order ' || ord.order_number || ' is complete. Your receipt is ready.', 'order', receipt_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'sale_id', sale_id, 'receipt_id', receipt_id);
END;
$$;

-- ============================================================
-- POS SALE
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
  subtotal NUMERIC := 0;
  profit NUMERIC := 0;
  sale_id UUID;
  receipt_id UUID;
  receipt_no TEXT;
  period UUID;
  sale_no TEXT;
BEGIN
  IF NOT (public.is_platform_admin() OR public.user_owns_shop(p_shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Add at least one item');
  END IF;

  period := public.current_financial_period_id(p_shop_id);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND shop_id = p_shop_id;
    IF product_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid product');
    END IF;
    IF product_row.type = 'product' AND product_row.stock < qty THEN
      RETURN jsonb_build_object('ok', false, 'error', product_row.name || ' does not have enough stock');
    END IF;
    subtotal := subtotal + (product_row.price * qty);
    profit := profit + ((product_row.price - COALESCE(product_row.cost, 0)) * qty);
  END LOOP;

  sale_no := 'S-' || to_char(NOW(), 'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.sales (
    shop_id, period_id, sale_number, customer_name, subtotal, total, profit,
    payment_method, status, completed_by_user_id
  ) VALUES (
    p_shop_id, period, sale_no, NULLIF(trim(p_customer_name), ''),
    subtotal, subtotal, profit, p_payment_method, 'completed', auth.uid()
  )
  RETURNING id INTO sale_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    qty := GREATEST(1, COALESCE((item->>'quantity')::int, 1));
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid;
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price)
    VALUES (sale_id, product_row.id, product_row.name, qty, product_row.price, COALESCE(product_row.cost, 0), product_row.price * qty);
    IF product_row.type = 'product' THEN
      UPDATE public.products SET stock = GREATEST(stock - qty, 0) WHERE id = product_row.id;
      INSERT INTO public.inventory_transactions (
        shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, created_by
      ) VALUES (
        p_shop_id, product_row.id, 'sold', -qty, product_row.stock, GREATEST(product_row.stock - qty, 0), auth.uid()
      );
    END IF;
  END LOOP;

  receipt_no := public.next_receipt_number(p_shop_id);
  INSERT INTO public.receipts (
    shop_id, sale_id, period_id, receipt_number, customer_name, subtotal, total, payment_method, shop_details
  )
  SELECT p_shop_id, sale_id, period, receipt_no, NULLIF(trim(p_customer_name), ''), subtotal, subtotal, p_payment_method,
         jsonb_build_object('name', s.name, 'address', s.address, 'phone', s.phone, 'email', s.email, 'logo_url', s.logo_url)
  FROM public.shops s WHERE s.id = p_shop_id
  RETURNING id INTO receipt_id;

  INSERT INTO public.receipt_items (receipt_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT receipt_id, si.product_id, si.product_name, si.quantity, si.unit_price, si.total_price
  FROM public.sale_items si WHERE si.sale_id = sale_id;

  RETURN jsonb_build_object('ok', true, 'sale_id', sale_id, 'receipt_id', receipt_id, 'total', subtotal, 'sale_number', sale_no);
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_shop(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_identity(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_failure(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_login_success(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_security_event(TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlock_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_new_financial_period(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_customer_order(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shop_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pos_sale(UUID, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_shop_login_id(TEXT) TO authenticated, service_role;
