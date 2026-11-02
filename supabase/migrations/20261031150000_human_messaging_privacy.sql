-- Human-to-human messaging: privacy, Super Admin support, product enquiries.
-- Does not drop conversations or messages. No Stebo/AI changes.
--
-- Access model (enforced in SECURITY DEFINER RPCs + RLS):
--   shop_customer: customer who owns the thread, or manager/owner of that shop
--   shop_admin:    Super Admin, or manager/owner of that shop (one thread per shop)
--   admin_customer: that customer, or platform admin (read; send is admin-only)
-- Direct INSERT/UPDATE/DELETE on chat tables is revoked from authenticated/anon.
-- Display names never return emails. Cashiers cannot read shop inboxes.

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS product_image TEXT;

CREATE OR REPLACE FUNCTION public.safe_person_display_name(p_user UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_username TEXT;
BEGIN
  IF p_user IS NULL THEN
    RETURN 'Customer';
  END IF;
  SELECT NULLIF(trim(name), ''), NULLIF(trim(username), '')
    INTO v_name, v_username
  FROM public.users
  WHERE id = p_user;
  IF v_name IS NOT NULL AND v_name NOT LIKE '%@%' THEN
    RETURN left(v_name, 80);
  END IF;
  IF v_username IS NOT NULL AND v_username NOT LIKE '%@%' THEN
    RETURN left(v_username, 80);
  END IF;
  RETURN 'Customer';
END;
$$;

CREATE OR REPLACE FUNCTION public.lagecto_support_display_name()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(trim(username), ''), NULLIF(trim(name), ''))
    INTO v_name
  FROM public.users
  WHERE role = 'admin'
    AND account_status = 'active'
    AND (
      admin_role = 'super_admin'
      OR lower(email) = 'lagecto@outlook.com'
    )
  ORDER BY CASE WHEN lower(email) = 'lagecto@outlook.com' THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_name IS NULL OR v_name LIKE '%@%' THEN
    RETURN 'LaGecto';
  END IF;
  RETURN left(v_name, 80);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
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
      AND (
        admin_role = 'super_admin'
        OR lower(email) = 'lagecto@outlook.com'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_manages_shop(p_shop_id);
$$;

CREATE OR REPLACE FUNCTION public.chat_can_read(p_conversation_id UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.chat_conversations%ROWTYPE;
BEGIN
  IF p_user IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF conv.id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF conv.kind = 'shop_customer' THEN
    RETURN conv.customer_id = p_user OR public.chat_shop_member(conv.shop_id);
  END IF;
  IF conv.kind = 'shop_admin' THEN
    RETURN public.is_super_admin() OR public.chat_shop_member(conv.shop_id);
  END IF;
  IF conv.kind = 'admin_customer' THEN
    RETURN conv.customer_id = p_user OR public.is_platform_admin();
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.chat_can_send(p_conversation_id UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv public.chat_conversations%ROWTYPE;
BEGIN
  IF p_user IS NULL OR NOT public.chat_can_read(p_conversation_id, p_user) THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO conv FROM public.chat_conversations WHERE id = p_conversation_id;
  IF conv.kind = 'admin_customer' THEN
    RETURN public.is_platform_admin();
  END IF;
  IF conv.kind = 'shop_admin' THEN
    RETURN public.is_super_admin() OR public.chat_shop_member(conv.shop_id);
  END IF;
  IF conv.kind = 'shop_customer' THEN
    RETURN conv.customer_id = p_user OR public.chat_shop_member(conv.shop_id);
  END IF;
  RETURN FALSE;
END;
$$;

DROP FUNCTION IF EXISTS public.start_chat_conversation(TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.start_chat_conversation(
  p_kind TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL
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
  prod RECORD;
  shop_name TEXT;
  context TEXT;
  opened BOOLEAN := FALSE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  SELECT u.role INTO role FROM public.users u WHERE u.id = uid;

  IF kind = 'shop_customer' THEN
    IF role <> 'customer' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
    END IF;
    IF p_shop_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_customer' AND shop_id = p_shop_id AND customer_id = uid
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, customer_id, kind, can_reply, title)
      VALUES (p_shop_id, uid, 'shop_customer', TRUE, 'Shop chat')
      RETURNING * INTO conv;
      opened := TRUE;
    END IF;
    IF p_product_id IS NOT NULL THEN
      SELECT id, name, image INTO prod
      FROM public.products
      WHERE id = p_product_id AND shop_id = p_shop_id
      LIMIT 1;
      IF prod.id IS NOT NULL THEN
        UPDATE public.chat_conversations
        SET product_id = prod.id,
            product_name = left(prod.name, 160),
            product_image = NULLIF(prod.image, '')
        WHERE id = conv.id;
        SELECT name INTO shop_name FROM public.shops WHERE id = p_shop_id;
        context := 'Enquiry about ' || prod.name || COALESCE(' from ' || shop_name, '') || '.';
        IF opened OR conv.product_id IS DISTINCT FROM prod.id THEN
          INSERT INTO public.chat_messages (conversation_id, sender_id, body, is_system)
          VALUES (conv.id, uid, context, TRUE);
          UPDATE public.chat_conversations
          SET last_message_at = NOW(), last_message_preview = left(context, 80)
          WHERE id = conv.id;
        END IF;
      END IF;
    END IF;
    RETURN jsonb_build_object('ok', true, 'conversation_id', conv.id);

  ELSIF kind = 'shop_admin' THEN
    IF public.is_super_admin() THEN
      IF p_shop_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Choose a shop');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Shop not found');
      END IF;
    ELSE
      SELECT id INTO p_shop_id FROM public.shops
      WHERE owner_user_id = uid OR lower(owner_email) = lower(public.current_user_email())
      LIMIT 1;
      IF p_shop_id IS NULL THEN
        SELECT shop_id INTO p_shop_id
        FROM public.shop_staff_assignments
        WHERE user_id = uid AND role_name IN ('admin', 'manager')
        LIMIT 1;
      END IF;
      IF p_shop_id IS NULL OR NOT public.chat_shop_member(p_shop_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
      END IF;
    END IF;
    SELECT * INTO conv FROM public.chat_conversations
    WHERE kind = 'shop_admin' AND shop_id = p_shop_id
    LIMIT 1;
    IF conv.id IS NULL THEN
      INSERT INTO public.chat_conversations (shop_id, admin_id, kind, can_reply, title)
      VALUES (p_shop_id, CASE WHEN public.is_super_admin() THEN uid ELSE NULL END, 'shop_admin', TRUE, 'LaGecto support')
      RETURNING * INTO conv;
    ELSIF public.is_super_admin() AND conv.admin_id IS NULL THEN
      UPDATE public.chat_conversations SET admin_id = uid WHERE id = conv.id;
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
    IF public.is_super_admin() THEN
      INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
      VALUES (conv.shop_id, 'Message from LaGecto', 'New support message', 'message', '/shop/chat?c=' || conv.id, conv.id);
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, href)
      SELECT u.id, COALESCE((SELECT name FROM public.shops WHERE id = conv.shop_id), 'Shop'), 'New shop message', 'message', conv.id, '/admin/chat?c=' || conv.id
      FROM public.users u
      WHERE u.role = 'admin'
        AND u.account_status = 'active'
        AND (u.admin_role = 'super_admin' OR lower(u.email) = 'lagecto@outlook.com')
      LIMIT 8;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'message_id', msg_id, 'created_at', NOW());
END;
$$;

DROP FUNCTION IF EXISTS public.chat_inbox();
CREATE OR REPLACE FUNCTION public.chat_inbox(p_view TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  view TEXT := lower(trim(COALESCE(p_view, '')));
BEGIN
  IF uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF view NOT IN ('', 'customer', 'shop', 'admin') THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(item ORDER BY (item->>'last_message_at') DESC NULLS LAST)
    FROM (
      SELECT jsonb_build_object(
        'id', c.id,
        'kind', c.kind,
        'can_reply', c.can_reply AND public.chat_can_send(c.id, uid),
        'last_message_at', c.last_message_at,
        'last_message_preview', c.last_message_preview,
        'product_name', c.product_name,
        'product_image', c.product_image,
        'peer_name', CASE
          WHEN c.kind = 'shop_customer' AND c.customer_id = uid THEN COALESCE(NULLIF(trim(s.name), ''), 'Shop')
          WHEN c.kind = 'shop_customer' THEN public.safe_person_display_name(c.customer_id)
          WHEN c.kind = 'shop_admin' AND public.is_super_admin() THEN COALESCE(NULLIF(trim(s.name), ''), 'Shop')
          WHEN c.kind = 'shop_admin' THEN public.lagecto_support_display_name()
          WHEN c.kind = 'admin_customer' AND c.customer_id = uid THEN public.lagecto_support_display_name()
          ELSE public.safe_person_display_name(c.customer_id)
        END,
        'peer_photo', CASE
          WHEN c.kind = 'shop_customer' AND c.customer_id = uid THEN s.logo_url
          WHEN c.kind = 'shop_admin' AND public.is_super_admin() THEN s.logo_url
          ELSE NULL
        END,
        'unread', (
          SELECT COUNT(*)::int
          FROM public.chat_messages m
          LEFT JOIN public.chat_reads r
            ON r.conversation_id = c.id AND r.user_id = uid
          WHERE m.conversation_id = c.id
            AND m.sender_id IS DISTINCT FROM uid
            AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
        )
      ) AS item
      FROM public.chat_conversations c
      LEFT JOIN public.shops s ON s.id = c.shop_id
      WHERE public.chat_can_read(c.id, uid)
        AND (
          view = ''
          OR (view = 'customer' AND c.kind IN ('shop_customer', 'admin_customer') AND c.customer_id = uid)
          OR (view = 'shop' AND c.kind IN ('shop_customer', 'shop_admin') AND public.chat_shop_member(c.shop_id))
          OR (view = 'admin' AND c.kind IN ('shop_admin', 'admin_customer') AND public.is_super_admin())
        )
    ) listed
  ), '[]'::jsonb);
END;
$$;

DROP POLICY IF EXISTS chat_conv_update ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_insert ON public.chat_conversations;
CREATE POLICY chat_conv_insert ON public.chat_conversations FOR INSERT
  WITH CHECK (FALSE);
DROP POLICY IF EXISTS chat_msg_insert ON public.chat_messages;
CREATE POLICY chat_msg_insert ON public.chat_messages FOR INSERT
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS chat_conv_read ON public.chat_conversations;
CREATE POLICY chat_conv_read ON public.chat_conversations FOR SELECT
  USING (public.chat_can_read(id, auth.uid()));

DROP POLICY IF EXISTS chat_msg_read ON public.chat_messages;
CREATE POLICY chat_msg_read ON public.chat_messages FOR SELECT
  USING (public.chat_can_read(conversation_id, auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.chat_conversations FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.safe_person_display_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lagecto_support_display_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_shop_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_can_send(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_chat_conversation(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_inbox(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
    END IF;
  END IF;
END $$;
