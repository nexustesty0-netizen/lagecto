-- Public media buckets: anyone may read published files. Writes go through
-- the Next.js upload API (service role). Catalog POS lines use server prices.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS shop_media_public_read ON storage.objects;
    DROP POLICY IF EXISTS product_media_public_read ON storage.objects;
    DROP POLICY IF EXISTS storefront_media_public_read ON storage.objects;
    DROP POLICY IF EXISTS media_client_write ON storage.objects;
    DROP POLICY IF EXISTS media_client_update ON storage.objects;
    DROP POLICY IF EXISTS media_client_delete ON storage.objects;

    CREATE POLICY shop_media_public_read ON storage.objects FOR SELECT
      USING (bucket_id IN ('shop-media', 'product-media', 'storefront-media'));

    CREATE POLICY media_client_write ON storage.objects FOR INSERT
      WITH CHECK (false);
    CREATE POLICY media_client_update ON storage.objects FOR UPDATE
      USING (false);
    CREATE POLICY media_client_delete ON storage.objects FOR DELETE
      USING (false);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
