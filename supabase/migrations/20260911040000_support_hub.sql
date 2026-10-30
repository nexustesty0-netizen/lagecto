-- LaGecto Support Hub: tickets, bugs, feedback, shop reports, help CMS, legal versions.
-- Reuses faq_entries as the single FAQ source of truth.

CREATE SEQUENCE IF NOT EXISTS public.support_case_seq START WITH 10001;

ALTER TABLE public.faq_entries
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.faq_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'article' CHECK (kind IN ('article', 'troubleshooting')),
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  audience TEXT NOT NULL DEFAULT 'all',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.about_content (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.legal_documents (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_slug TEXT NOT NULL REFERENCES public.legal_documents(slug) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  effective_on DATE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_slug, version)
);

CREATE TABLE IF NOT EXISTS public.support_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('support', 'bug', 'technical', 'feedback', 'shop_report')),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  severity TEXT CHECK (severity IS NULL OR severity IN ('minor', 'moderate', 'major', 'blocking')),
  area TEXT,
  steps_to_reproduce TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  order_number TEXT,
  reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  duplicate_of UUID REFERENCES public.support_cases(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_cases_reporter_idx ON public.support_cases (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_kind_status_idx ON public.support_cases (kind, status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_cases_shop_idx ON public.support_cases (shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_cases_assigned_idx ON public.support_cases (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_messages_case_idx ON public.support_messages (case_id, created_at);
CREATE INDEX IF NOT EXISTS support_notes_case_idx ON public.support_internal_notes (case_id, created_at);
CREATE INDEX IF NOT EXISTS help_articles_pub_idx ON public.help_articles (is_published, kind, category);
CREATE INDEX IF NOT EXISTS faq_entries_section_idx ON public.faq_entries (section, sort_order);
CREATE INDEX IF NOT EXISTS legal_versions_doc_idx ON public.legal_document_versions (document_slug, status, version DESC);

ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY faq_categories_read ON public.faq_categories FOR SELECT USING (is_active OR public.is_platform_admin());
CREATE POLICY faq_categories_admin ON public.faq_categories FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY help_articles_read ON public.help_articles FOR SELECT
  USING ((is_published AND NOT is_archived) OR public.is_platform_admin());
CREATE POLICY help_articles_admin ON public.help_articles FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY about_content_read ON public.about_content FOR SELECT
  USING (status = 'published' OR public.is_platform_admin());
CREATE POLICY about_content_admin ON public.about_content FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY legal_docs_read ON public.legal_documents FOR SELECT USING (TRUE);
CREATE POLICY legal_docs_admin ON public.legal_documents FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY legal_versions_read ON public.legal_document_versions FOR SELECT
  USING (status = 'published' OR public.is_platform_admin());
CREATE POLICY legal_versions_admin ON public.legal_document_versions FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Customers see only their cases. Shop owners cannot read shop_report rows.
CREATE POLICY support_cases_own_select ON public.support_cases FOR SELECT
  USING (
    reporter_user_id = auth.uid()
    OR public.is_platform_admin()
  );
CREATE POLICY support_messages_own_select ON public.support_messages FOR SELECT
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_cases c
      WHERE c.id = case_id AND c.reporter_user_id = auth.uid()
    )
  );
CREATE POLICY support_notes_admin_select ON public.support_internal_notes FOR SELECT
  USING (public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.is_legal_admin()
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
      AND (admin_role = 'super_admin' OR public.is_protected_admin_user(id))
  );
$$;

CREATE OR REPLACE FUNCTION public.next_support_ticket_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'LG-H-' || nextval('public.support_case_seq')::text;
$$;

CREATE OR REPLACE FUNCTION public.cap_support_priority(p_category TEXT, p_priority TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_priority, 'normal')) = 'urgent'
      AND lower(COALESCE(p_category, '')) IN ('payment', 'payments', 'security', 'account')
      THEN 'urgent'
    WHEN lower(COALESCE(p_priority, 'normal')) IN ('high', 'urgent') THEN 'high'
    ELSE 'normal'
  END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_case(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  kind TEXT := COALESCE(p_payload->>'kind', 'support');
  category TEXT := left(COALESCE(NULLIF(p_payload->>'category', ''), 'other'), 40);
  subject TEXT := left(btrim(COALESCE(p_payload->>'subject', '')), 120);
  description TEXT := left(btrim(COALESCE(p_payload->>'description', '')), 4000);
  priority TEXT;
  rec public.support_cases%ROWTYPE;
  similar_bugs JSONB := '[]'::jsonb;
  allowed BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in to submit this.');
  END IF;
  IF kind NOT IN ('support', 'bug', 'technical', 'feedback', 'shop_report') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown request type.');
  END IF;
  IF subject = '' OR description = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Subject and description are required.');
  END IF;
  IF kind = 'shop_report' AND (p_payload->>'shop_id') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose the shop you are reporting.');
  END IF;

  allowed := public.check_auth_rate_limit(
    'support:' || uid::text || ':' || kind,
    CASE WHEN kind = 'shop_report' THEN 5 ELSE 8 END,
    3600
  );
  IF allowed IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please wait before sending another report.');
  END IF;

  priority := public.cap_support_priority(category, p_payload->>'priority');

  INSERT INTO public.support_cases (
    ticket_number, kind, category, subject, description, status, priority, severity, area,
    steps_to_reproduce, rating, shop_id, order_number, reporter_user_id, details, attachments
  ) VALUES (
    public.next_support_ticket_number(),
    kind,
    category,
    subject,
    description,
    CASE kind
      WHEN 'bug' THEN 'new'
      WHEN 'feedback' THEN 'new'
      WHEN 'shop_report' THEN 'new'
      ELSE 'open'
    END,
    priority,
    NULLIF(p_payload->>'severity', ''),
    NULLIF(left(COALESCE(p_payload->>'area', ''), 40), ''),
    NULLIF(left(COALESCE(p_payload->>'steps_to_reproduce', ''), 2000), ''),
    NULLIF(p_payload->>'rating', '')::int,
    NULLIF(p_payload->>'shop_id', '')::uuid,
    NULLIF(left(COALESCE(p_payload->>'order_number', ''), 40), ''),
    uid,
    COALESCE(p_payload->'details', '{}'::jsonb),
    COALESCE(p_payload->'attachments', '[]'::jsonb)
  )
  RETURNING * INTO rec;

  IF kind = 'bug' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'ticket_number', c.ticket_number, 'subject', c.subject)), '[]'::jsonb)
    INTO similar_bugs
    FROM (
      SELECT c.id, c.ticket_number, c.subject
      FROM public.support_cases c
      WHERE c.kind = 'bug' AND c.id <> rec.id
        AND c.area IS NOT DISTINCT FROM rec.area
        AND (
          lower(c.subject) = lower(rec.subject)
          OR left(lower(c.subject), 24) = left(lower(rec.subject), 24)
        )
      ORDER BY c.created_at DESC
      LIMIT 6
    ) c;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
  VALUES (
    uid,
    CASE kind
      WHEN 'shop_report' THEN 'Shop report received'
      WHEN 'bug' THEN 'Bug report received'
      WHEN 'feedback' THEN 'Thanks for your feedback'
      ELSE 'Support request received'
    END,
    'Reference ' || rec.ticket_number || '. We will review this and update you here.',
    'support',
    '/support/tickets/' || rec.id::text,
    rec.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', rec.id,
    'ticket_number', rec.ticket_number,
    'priority', rec.priority,
    'similar', similar_bugs
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reply_support_case(p_case_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.support_cases%ROWTYPE;
  staff BOOLEAN := public.is_platform_admin();
  body TEXT := left(btrim(COALESCE(p_body, '')), 4000);
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please sign in.');
  END IF;
  IF body = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Write a message.');
  END IF;
  SELECT * INTO rec FROM public.support_cases WHERE id = p_case_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found.');
  END IF;
  IF NOT staff AND rec.reporter_user_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized.');
  END IF;
  IF NOT public.check_auth_rate_limit('support-reply:' || uid::text, 20, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please wait before sending another message.');
  END IF;

  INSERT INTO public.support_messages (case_id, author_id, body, is_staff)
  VALUES (rec.id, uid, body, staff);

  UPDATE public.support_cases
  SET
    updated_at = NOW(),
    status = CASE
      WHEN staff AND rec.status IN ('open', 'new', 'waiting_customer') THEN 'in_progress'
      WHEN NOT staff AND rec.status IN ('waiting_customer', 'resolved') THEN 'open'
      ELSE rec.status
    END
  WHERE id = rec.id;

  IF staff AND rec.reporter_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
    VALUES (rec.reporter_user_id, 'Support replied', 'There is a new reply on ' || rec.ticket_number || '.', 'support', '/support/tickets/' || rec.id::text, rec.id);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_support_case(p_case_id UUID, p_patch JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.support_cases%ROWTYPE;
  new_status TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT * INTO rec FROM public.support_cases WHERE id = p_case_id;
  IF rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found.');
  END IF;
  new_status := COALESCE(NULLIF(p_patch->>'status', ''), rec.status);

  UPDATE public.support_cases
  SET
    status = new_status,
    priority = COALESCE(NULLIF(p_patch->>'priority', ''), priority),
    severity = COALESCE(NULLIF(p_patch->>'severity', ''), severity),
    assigned_to = COALESCE(NULLIF(p_patch->>'assigned_to', '')::uuid, assigned_to),
    duplicate_of = COALESCE(NULLIF(p_patch->>'duplicate_of', '')::uuid, duplicate_of),
    resolved_at = CASE WHEN new_status IN ('resolved', 'closed', 'dismissed') THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
    updated_at = NOW()
  WHERE id = rec.id;

  PERFORM public.log_security_event(
    'support_case_update',
    auth.uid(),
    rec.reporter_user_id,
    rec.shop_id,
    rec.ticket_number,
    NULL, NULL, 'success',
    jsonb_build_object('status', new_status, 'kind', rec.kind)
  );

  IF new_status IS DISTINCT FROM rec.status AND rec.reporter_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
    VALUES (
      rec.reporter_user_id,
      'Support update',
      rec.ticket_number || ' is now ' || replace(new_status, '_', ' ') || '.',
      'support',
      '/support/tickets/' || rec.id::text,
      rec.id
    );
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_internal_note(p_case_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  IF btrim(COALESCE(p_body, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Note is required.');
  END IF;
  INSERT INTO public.support_internal_notes (case_id, author_id, body)
  VALUES (p_case_id, auth.uid(), left(btrim(p_body), 4000));
  PERFORM public.log_security_event(
    'support_internal_note', auth.uid(), NULL, NULL, p_case_id::text, NULL, NULL, 'success', '{}'::jsonb
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.search_help(p_query TEXT, p_audience TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q TEXT := left(btrim(COALESCE(p_query, '')), 80);
  pattern TEXT;
BEGIN
  IF length(q) < 2 THEN
    RETURN jsonb_build_object('ok', true, 'faqs', '[]'::jsonb, 'articles', '[]'::jsonb, 'suggestions', '[]'::jsonb);
  END IF;
  pattern := '%' || replace(replace(q, '%', ''), '_', '') || '%';
  RETURN jsonb_build_object(
    'ok', true,
    'faqs', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT id, section, question, left(answer, 280) AS excerpt
        FROM public.faq_entries
        WHERE is_published AND NOT COALESCE(is_archived, FALSE)
          AND (audience = 'all' OR audience = p_audience OR p_audience = 'all')
          AND (question ILIKE pattern OR answer ILIKE pattern OR COALESCE(array_to_string(keywords, ' '), '') ILIKE pattern)
        ORDER BY featured DESC, sort_order
        LIMIT 12
      ) x
    ),
    'articles', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      FROM (
        SELECT id, slug, kind, title, summary, category
        FROM public.help_articles
        WHERE is_published AND NOT is_archived
          AND (audience = 'all' OR audience = p_audience OR p_audience = 'all')
          AND (title ILIKE pattern OR COALESCE(summary, '') ILIKE pattern OR body ILIKE pattern)
        ORDER BY sort_order
        LIMIT 8
      ) x
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.support_analytics_admin()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_hours NUMERIC;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;
  SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0)
  INTO avg_hours
  FROM public.support_cases
  WHERE resolved_at IS NOT NULL AND kind IN ('support', 'technical');

  RETURN jsonb_build_object(
    'ok', true,
    'open_tickets', (SELECT COUNT(*) FROM public.support_cases WHERE kind IN ('support', 'technical') AND status IN ('open', 'in_progress', 'waiting_customer')),
    'high_priority', (SELECT COUNT(*) FROM public.support_cases WHERE priority IN ('high', 'urgent') AND status NOT IN ('resolved', 'closed', 'dismissed')),
    'bugs', (SELECT COUNT(*) FROM public.support_cases WHERE kind = 'bug' AND status NOT IN ('resolved', 'closed', 'cannot_reproduce')),
    'shop_reports', (SELECT COUNT(*) FROM public.support_cases WHERE kind = 'shop_report' AND status NOT IN ('resolved', 'dismissed')),
    'feedback', (SELECT COUNT(*) FROM public.support_cases WHERE kind = 'feedback'),
    'resolved', (SELECT COUNT(*) FROM public.support_cases WHERE status IN ('resolved', 'closed')),
    'avg_resolution_hours', avg_hours
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_legal_version(p_version_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ver public.legal_document_versions%ROWTYPE;
BEGIN
  IF NOT public.is_legal_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a super admin can publish legal documents.');
  END IF;
  SELECT * INTO ver FROM public.legal_document_versions WHERE id = p_version_id;
  IF ver.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Version not found.');
  END IF;
  UPDATE public.legal_document_versions
  SET status = 'archived'
  WHERE document_slug = ver.document_slug AND status = 'published' AND id <> ver.id;
  UPDATE public.legal_document_versions
  SET status = 'published', published_at = NOW(), published_by = auth.uid()
  WHERE id = ver.id;
  PERFORM public.log_security_event(
    'legal_publish', auth.uid(), NULL, NULL, ver.document_slug, NULL, NULL, 'success',
    jsonb_build_object('version', ver.version)
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_legal_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_case(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_case(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_case(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_internal_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_help(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_analytics_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_legal_version(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cap_support_priority(TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.next_support_ticket_number() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('support-uploads', 'support-uploads', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN insufficient_privilege THEN
    NULL;
END $$;
