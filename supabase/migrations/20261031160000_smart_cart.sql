-- Smart cart: saved customer carts and per-line live quotes.
-- Does not change checkout: unavailable items still cannot be ordered.
-- Prices and stock always come from products, not from the browser.

CREATE TABLE IF NOT EXISTS public.customer_cart_items (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS customer_cart_items_user_idx ON public.customer_cart_items (user_id);
CREATE INDEX IF NOT EXISTS customer_cart_items_shop_idx ON public.customer_cart_items (shop_id);

ALTER TABLE public.customer_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_cart_read ON public.customer_cart_items;
CREATE POLICY customer_cart_read ON public.customer_cart_items FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.customer_cart_items FROM authenticated, anon;
GRANT SELECT ON public.customer_cart_items TO authenticated;

CREATE OR REPLACE FUNCTION public.load_customer_cart()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND role = 'customer' AND account_status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', c.product_id,
        'shop_id', c.shop_id,
        'shop_name', COALESCE(NULLIF(trim(s.name), ''), 'Shop'),
        'shop_slug', s.slug,
        'name', COALESCE(NULLIF(trim(p.name), ''), 'Product'),
        'image', p.image,
        'price', p.price,
        'quantity', c.quantity,
        'type', COALESCE(p.type, 'product'),
        'availability', COALESCE(p.availability, 'available'),
        'stock', p.stock,
        'is_available', COALESCE(p.is_available, FALSE)
      ) ORDER BY c.updated_at DESC)
      FROM public.customer_cart_items c
      JOIN public.products p ON p.id = c.product_id
      JOIN public.shops s ON s.id = c.shop_id
      WHERE c.user_id = uid
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_cart(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  item JSONB;
  prod RECORD;
  qty INTEGER;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please log in');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND role = 'customer' AND account_status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;

  DELETE FROM public.customer_cart_items WHERE user_id = uid;

  IF jsonb_typeof(p_items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      qty := LEAST(99, GREATEST(0, COALESCE((item->>'quantity')::int, 0)));
      IF qty < 1 OR NULLIF(item->>'product_id', '') IS NULL THEN
        CONTINUE;
      END IF;
      SELECT p.id, p.shop_id, p.type, p.availability, p.stock
        INTO prod
      FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = (item->>'product_id')::uuid
        AND s.status = 'active'
      LIMIT 1;
      IF prod.id IS NULL THEN
        CONTINUE;
      END IF;
      IF COALESCE(prod.type, 'product') = 'product'
         AND COALESCE(prod.availability, 'available') IS DISTINCT FROM 'on_order'
         AND prod.stock IS NOT NULL THEN
        qty := LEAST(qty, GREATEST(0, prod.stock));
      END IF;
      IF qty < 1 THEN
        CONTINUE;
      END IF;
      INSERT INTO public.customer_cart_items (user_id, product_id, shop_id, quantity)
      VALUES (uid, prod.id, prod.shop_id, qty)
      ON CONFLICT (user_id, product_id) DO UPDATE
        SET quantity = EXCLUDED.quantity, shop_id = EXCLUDED.shop_id, updated_at = NOW();
    END LOOP;
  END IF;

  RETURN public.load_customer_cart();
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_customer_cart(
  p_shop_id UUID,
  p_items JSONB,
  p_promo_code TEXT DEFAULT NULL
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
  pricing JSONB;
  unit_price NUMERIC;
  lines JSONB := '[]'::jsonb;
  promo_items JSONB := '[]'::jsonb;
  subtotal NUMERIC := 0;
  discount_total NUMERIC := 0;
  promo JSONB;
  promo_discount NUMERIC := 0;
  free_delivery BOOLEAN := FALSE;
  allowed BOOLEAN;
  status TEXT;
  max_qty INTEGER;
  low_stock BOOLEAN;
  alternatives JSONB;
  can_checkout BOOLEAN := TRUE;
  line_count INTEGER := 0;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cart is empty');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This shop is not available');
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    line_count := line_count + 1;
    IF line_count > 80 THEN
      EXIT;
    END IF;
    qty := LEAST(99, GREATEST(1, COALESCE((item->>'quantity')::int, 1)));
    SELECT * INTO product_row FROM public.products
    WHERE id = NULLIF(item->>'product_id', '')::uuid AND shop_id = p_shop_id;
    IF product_row.id IS NULL OR product_row.is_available IS DISTINCT FROM TRUE THEN
      can_checkout := FALSE;
      lines := lines || jsonb_build_array(jsonb_build_object(
        'product_id', NULLIF(item->>'product_id', ''),
        'name', COALESCE(product_row.name, 'Product'),
        'image', product_row.image,
        'quantity', qty,
        'list_price', COALESCE(product_row.price, 0),
        'unit_price', COALESCE(product_row.price, 0),
        'line_total', 0,
        'availability', COALESCE(product_row.availability, 'available'),
        'stock', product_row.stock,
        'max_qty', 0,
        'status', 'unavailable',
        'low_stock', FALSE,
        'in_stock', FALSE,
        'alternatives', '[]'::jsonb
      ));
      CONTINUE;
    END IF;

    allowed := public.product_qty_ok(product_row.type, product_row.availability, product_row.stock, qty);
    IF COALESCE(product_row.type, 'product') = 'product'
       AND COALESCE(product_row.availability, 'available') IS DISTINCT FROM 'on_order'
       AND product_row.stock IS NOT NULL THEN
      max_qty := GREATEST(0, product_row.stock);
    ELSE
      max_qty := 99;
    END IF;
    IF NOT allowed THEN
      status := 'insufficient_stock';
      can_checkout := FALSE;
    ELSE
      status := 'ok';
    END IF;
    low_stock := COALESCE(product_row.type, 'product') = 'product'
      AND COALESCE(product_row.availability, 'available') IS DISTINCT FROM 'on_order'
      AND product_row.stock IS NOT NULL
      AND product_row.stock > 0
      AND product_row.stock <= COALESCE(product_row.low_stock_threshold, 5);

    pricing := public.product_effective_price(product_row.id);
    unit_price := COALESCE((pricing->>'unit_price')::numeric, product_row.price);

    IF status = 'ok' THEN
      subtotal := subtotal + (product_row.price * qty);
      discount_total := discount_total + GREATEST(product_row.price - unit_price, 0) * qty;
      promo_items := promo_items || jsonb_build_array(jsonb_build_object(
        'product_id', product_row.id,
        'quantity', qty
      ));
    END IF;

    alternatives := '[]'::jsonb;
    IF status <> 'ok' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', alt.id,
        'name', left(alt.name, 80),
        'image', alt.image,
        'price', alt.price
      )), '[]'::jsonb)
        INTO alternatives
      FROM (
        SELECT p.id, p.name, p.image, p.price
        FROM public.products p
        WHERE p.shop_id = p_shop_id
          AND p.is_available = TRUE
          AND p.id IS DISTINCT FROM product_row.id
        ORDER BY (p.category IS NOT DISTINCT FROM product_row.category) DESC, p.is_popular DESC, p.name
        LIMIT 3
      ) alt;
    END IF;

    lines := lines || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id,
      'name', product_row.name,
      'image', product_row.image,
      'quantity', qty,
      'list_price', product_row.price,
      'unit_price', unit_price,
      'line_total', CASE WHEN status = 'ok' THEN unit_price * qty ELSE 0 END,
      'availability', COALESCE(product_row.availability, 'available'),
      'stock', product_row.stock,
      'max_qty', max_qty,
      'status', status,
      'low_stock', low_stock,
      'in_stock', allowed,
      'alternatives', alternatives
    ));
  END LOOP;

  IF NULLIF(trim(COALESCE(p_promo_code, '')), '') IS NOT NULL AND jsonb_array_length(promo_items) > 0 THEN
    promo := public.validate_promo_code(p_promo_code, p_shop_id, promo_items, FALSE);
    IF promo->>'ok' = 'false' THEN
      RETURN promo;
    END IF;
    promo_discount := COALESCE((promo->>'discount')::numeric, 0);
    free_delivery := COALESCE((promo->>'free_delivery')::boolean, FALSE);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', p_shop_id,
    'items', lines,
    'subtotal', subtotal,
    'discount', discount_total + promo_discount,
    'promotion_discount', discount_total,
    'promo_discount', promo_discount,
    'promo_code', CASE WHEN promo ? 'code' THEN promo->>'code' ELSE NULL END,
    'promo_name', promo->>'name',
    'free_delivery', free_delivery,
    'can_checkout', can_checkout AND subtotal > 0,
    'total', GREATEST(0, subtotal - discount_total - promo_discount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.load_customer_cart() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_customer_cart(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_customer_cart(UUID, JSONB, TEXT) TO anon, authenticated, service_role;
