-- Real-time notification delivery on the existing notifications tables.
-- History is preserved. Recipients stay scoped by current RLS.

CREATE INDEX IF NOT EXISTS idx_notifications_unread_user
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications (user_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_notifications_unread_shop
  ON public.shop_notifications (shop_id, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_shop_notifications_shop_type
  ON public.shop_notifications (shop_id, type, created_at DESC);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.shop_notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'general',
  p_href TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid UUID;
  title_text TEXT := left(btrim(COALESCE(p_title, 'Update')), 120);
  body_text TEXT := left(btrim(COALESCE(p_message, '')), 400);
  kind TEXT := lower(left(btrim(COALESCE(p_type, 'general')), 40));
BEGIN
  IF p_user_id IS NULL OR title_text = '' THEN
    RETURN NULL;
  END IF;
  IF p_reference_id IS NOT NULL THEN
    UPDATE public.notifications
    SET title = title_text,
        message = body_text,
        href = COALESCE(NULLIF(p_href, ''), href),
        type = kind
    WHERE user_id = p_user_id
      AND type = kind
      AND reference_id = p_reference_id
      AND is_read = FALSE
    RETURNING id INTO nid;
    IF nid IS NOT NULL THEN
      RETURN nid;
    END IF;
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type, href, reference_id)
  VALUES (p_user_id, title_text, body_text, kind, NULLIF(p_href, ''), p_reference_id)
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_shop(
  p_shop_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'general',
  p_href TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nid UUID;
  title_text TEXT := left(btrim(COALESCE(p_title, 'Update')), 120);
  body_text TEXT := left(btrim(COALESCE(p_message, '')), 400);
  kind TEXT := lower(left(btrim(COALESCE(p_type, 'general')), 40));
BEGIN
  IF p_shop_id IS NULL OR title_text = '' THEN
    RETURN NULL;
  END IF;
  IF p_reference_id IS NOT NULL THEN
    UPDATE public.shop_notifications
    SET title = title_text,
        message = body_text,
        href = COALESCE(NULLIF(p_href, ''), href),
        type = kind
    WHERE shop_id = p_shop_id
      AND type = kind
      AND reference_id = p_reference_id
      AND is_read = FALSE
    RETURNING id INTO nid;
    IF nid IS NOT NULL THEN
      RETURN nid;
    END IF;
  END IF;
  INSERT INTO public.shop_notifications (shop_id, title, message, type, href, reference_id)
  VALUES (p_shop_id, title_text, body_text, kind, NULLIF(p_href, ''), p_reference_id)
  RETURNING id INTO nid;
  RETURN nid;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'admin',
  p_href TEXT DEFAULT '/admin/notifications',
  p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id
    FROM public.users
    WHERE role = 'admin'
      AND account_status = 'active'
      AND (admin_role = 'super_admin' OR lower(email) = 'lagecto@outlook.com')
    LIMIT 12
  LOOP
    PERFORM public.notify_user(rec.id, p_title, p_message, p_type, p_href, p_reference_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.notify_shop(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_shop(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;

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
  customer_name TEXT;
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
    SELECT COALESCE(NULLIF(btrim(name), ''), 'A customer') INTO customer_name
    FROM public.users WHERE id = conv.customer_id;
    IF conv.customer_id IS DISTINCT FROM uid THEN
      PERFORM public.notify_user(
        conv.customer_id,
        'New message',
        COALESCE(shop_name, 'A shop') || ' sent you a message.',
        'message',
        '/customer/chat?c=' || conv.id,
        conv.id
      );
    ELSE
      PERFORM public.notify_shop(
        conv.shop_id,
        'New customer enquiry',
        customer_name || ' sent you a message.',
        'message',
        '/shop/chat?c=' || conv.id,
        conv.id
      );
    END IF;
  ELSIF conv.kind = 'shop_admin' THEN
    IF public.is_super_admin() THEN
      PERFORM public.notify_shop(
        conv.shop_id,
        'LaGecto Support',
        'You have received a new message from LaGecto.',
        'support',
        '/shop/chat?c=' || conv.id,
        conv.id
      );
    ELSE
      PERFORM public.notify_admins(
        'New support message',
        COALESCE((SELECT name FROM public.shops WHERE id = conv.shop_id), 'A shop') || ' sent a support message.',
        'support',
        '/admin/chat?c=' || conv.id,
        conv.id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'message_id', msg_id, 'created_at', NOW());
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shop_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_notifications;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
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
  delta INTEGER := COALESCE(p_delta, 0);
  reason TEXT := lower(btrim(COALESCE(p_reason, 'adjustment')));
  tx_type TEXT := 'adjustment';
BEGIN
  IF delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must not be zero.');
  END IF;

  SELECT * INTO product_row FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF product_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;
  IF product_row.type IS DISTINCT FROM 'product' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Services do not keep stock.');
  END IF;
  IF NOT (public.is_platform_admin() OR public.user_manages_shop(product_row.shop_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  next_stock := COALESCE(product_row.stock, 0) + delta;
  IF next_stock < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stock cannot go below zero.');
  END IF;

  IF reason IN ('restock', 'received') THEN
    tx_type := 'received';
    reason := 'restock';
  ELSIF reason IN ('returned', 'return') THEN
    tx_type := 'returned';
    reason := 'returned';
  ELSIF reason = 'damaged' THEN
    tx_type := 'damaged';
  ELSIF reason = 'sold' THEN
    tx_type := 'sold';
  ELSE
    tx_type := 'adjustment';
    reason := 'adjustment';
  END IF;

  UPDATE public.products
  SET stock = next_stock, updated_at = NOW()
  WHERE id = product_row.id;

  INSERT INTO public.inventory_transactions (
    shop_id, product_id, transaction_type, quantity, previous_quantity, new_quantity, reason, notes, created_by
  ) VALUES (
    product_row.shop_id,
    product_row.id,
    tx_type,
    delta,
    product_row.stock,
    next_stock,
    reason,
    NULLIF(left(btrim(COALESCE(p_notes, '')), 400), ''),
    auth.uid()
  );

  IF delta < 0 THEN
    IF next_stock = 0 THEN
      PERFORM public.notify_shop(
        product_row.shop_id,
        'Out of stock',
        left(COALESCE(product_row.name, 'A product'), 80) || ' is out of stock.',
        'stock',
        '/shop/inventory',
        product_row.id
      );
    ELSIF next_stock <= 5 THEN
      PERFORM public.notify_shop(
        product_row.shop_id,
        'Low stock',
        left(COALESCE(product_row.name, 'A product'), 80) || ' has ' || next_stock || ' left.',
        'stock',
        '/shop/inventory',
        product_row.id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'stock', next_stock, 'previous', product_row.stock);
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, INTEGER, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_shop_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'New shop registration',
    left(COALESCE(NEW.shop_name, 'A shop'), 80) || ' has submitted a registration request.',
    'registration',
    '/admin/verification?tab=registrations',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shop_registration ON public.shop_registration_requests;
CREATE TRIGGER trg_notify_shop_registration
  AFTER INSERT ON public.shop_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_shop_registration();

DO $$
BEGIN
  IF to_regclass('public.verification_requests') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.trg_notify_verification_request()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        PERFORM public.notify_admins(
          'Shop verification request',
          COALESCE((SELECT left(name, 80) FROM public.shops WHERE id = NEW.shop_id), 'A shop') || ' asked to be verified.',
          'verification',
          '/admin/verification',
          NEW.id
        );
        RETURN NEW;
      END;
      $body$;
    $fn$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_verification_request ON public.verification_requests';
    EXECUTE 'CREATE TRIGGER trg_notify_verification_request AFTER INSERT ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.trg_notify_verification_request()';
  END IF;
END;
$$;
