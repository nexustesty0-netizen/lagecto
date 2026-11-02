-- Customer home: recently viewed lookups by the signed-in user only.
CREATE INDEX IF NOT EXISTS idx_marketplace_events_user_type_created
  ON public.marketplace_events (user_id, event_type, created_at DESC)
  WHERE user_id IS NOT NULL;
