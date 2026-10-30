-- Support Hub follow-up: legal history, archived FAQs, notification prefs, storage, shop lookup.

DROP POLICY IF EXISTS legal_versions_read ON public.legal_document_versions;
CREATE POLICY legal_versions_read ON public.legal_document_versions FOR SELECT
  USING (status IN ('published', 'archived') OR public.is_platform_admin());

DROP POLICY IF EXISTS legal_versions_admin ON public.legal_document_versions;
CREATE POLICY legal_versions_write ON public.legal_document_versions FOR ALL
  USING (public.is_legal_admin()) WITH CHECK (public.is_legal_admin());

DROP POLICY IF EXISTS legal_docs_admin ON public.legal_documents;
CREATE POLICY legal_docs_write ON public.legal_documents FOR INSERT
  WITH CHECK (public.is_legal_admin());
CREATE POLICY legal_docs_update ON public.legal_documents FOR UPDATE
  USING (public.is_legal_admin()) WITH CHECK (public.is_legal_admin());
CREATE POLICY legal_docs_delete ON public.legal_documents FOR DELETE
  USING (public.is_legal_admin());

DROP POLICY IF EXISTS faq_public ON public.faq_entries;
CREATE POLICY faq_public ON public.faq_entries FOR SELECT
  USING (
    (is_published = TRUE AND COALESCE(is_archived, FALSE) = FALSE)
    OR public.is_platform_admin()
  );

CREATE OR REPLACE FUNCTION public.wants_support_notifications(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN s.notification_preferences->>'support' = 'false' THEN FALSE
        ELSE TRUE
      END
      FROM public.user_settings s
      WHERE s.user_id = p_user_id
    ),
    TRUE
  );
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
  shop_uuid UUID;
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
  IF kind = 'shop_report' AND NULLIF(p_payload->>'shop_id', '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Choose the shop you are reporting.');
  END IF;

  shop_uuid := NULLIF(p_payload->>'shop_id', '')::uuid;
  IF shop_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_uuid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'We could not find that shop.');
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
    shop_uuid,
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
          OR left(lower(c.description), 48) = left(lower(rec.description), 48)
        )
      ORDER BY c.created_at DESC
      LIMIT 6
    ) c;
  END IF;

  IF public.wants_support_notifications(uid) THEN
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
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', rec.id,
    'ticket_number', rec.ticket_number,
    'priority', rec.priority,
    'similar', similar_bugs
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That value is not valid.');
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'We could not find that shop.');
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

  IF staff AND rec.reporter_user_id IS NOT NULL AND public.wants_support_notifications(rec.reporter_user_id) THEN
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
  note TEXT;
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
    resolved_at = CASE WHEN new_status IN ('resolved', 'closed', 'dismissed', 'cannot_reproduce') THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END,
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

  IF new_status IS DISTINCT FROM rec.status AND rec.reporter_user_id IS NOT NULL AND public.wants_support_notifications(rec.reporter_user_id) THEN
    note := CASE
      WHEN rec.kind = 'shop_report' AND new_status = 'awaiting_information' THEN 'We need a little more information about your shop report ' || rec.ticket_number || '.'
      WHEN rec.kind = 'feedback' AND new_status IN ('resolved', 'closed') THEN 'Thanks — we reviewed your feedback ' || rec.ticket_number || '.'
      ELSE rec.ticket_number || ' is now ' || replace(new_status, '_', ' ') || '.'
    END;
    INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
    VALUES (
      rec.reporter_user_id,
      CASE
        WHEN rec.kind = 'shop_report' AND new_status = 'awaiting_information' THEN 'Shop report needs information'
        WHEN rec.kind = 'bug' THEN 'Bug report updated'
        ELSE 'Support update'
      END,
      note,
      'support',
      '/support/tickets/' || rec.id::text,
      rec.id
    );
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.wants_support_notifications(UUID) TO authenticated;

DO $$
BEGIN
  DROP POLICY IF EXISTS support_uploads_select ON storage.objects;
  CREATE POLICY support_uploads_select ON storage.objects FOR SELECT
    USING (bucket_id = 'support-uploads' AND public.is_platform_admin());
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;
