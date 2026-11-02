-- Shop owners can record extra supplier details and what each supplier provides.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS supplies TEXT;
