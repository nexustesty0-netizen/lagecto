-- Guest shop registration, public reference codes, and status lookup.
ALTER TABLE public.shop_registration_requests
  ADD COLUMN IF NOT EXISTS public_ref TEXT;

UPDATE public.shop_registration_requests
SET public_ref = 'LG-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE public_ref IS NULL;

ALTER TABLE public.shop_registration_requests
  ALTER COLUMN public_ref SET DEFAULT ('LG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

CREATE UNIQUE INDEX IF NOT EXISTS shop_registration_requests_public_ref_key
  ON public.shop_registration_requests (public_ref);

DROP POLICY IF EXISTS shop_reg_insert ON public.shop_registration_requests;
CREATE POLICY shop_reg_insert ON public.shop_registration_requests FOR INSERT
  WITH CHECK (requester_user_id IS NULL OR requester_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.lookup_shop_registration(p_ref TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.shop_registration_requests%ROWTYPE;
  ref_key TEXT := upper(trim(COALESCE(p_ref, '')));
  phone_key TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
BEGIN
  IF ref_key = '' OR phone_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter your request reference and phone number.');
  END IF;

  SELECT * INTO rec
  FROM public.shop_registration_requests
  WHERE upper(COALESCE(public_ref, '')) = ref_key
     OR id::text = lower(ref_key)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found.');
  END IF;

  IF regexp_replace(COALESCE(rec.phone, ''), '\D', '', 'g') <> phone_key THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Request not found.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ref', rec.public_ref,
    'shop_name', rec.shop_name,
    'status', rec.status,
    'admin_notes', rec.admin_notes,
    'created_at', rec.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_shop_registration(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_shop_registration(TEXT, TEXT) TO anon, authenticated, service_role;
