-- Additive diary fields for visual Smart Diary. Existing rows stay valid.
ALTER TABLE public.diary_journal_entries
  ADD COLUMN IF NOT EXISTS tags TEXT;

ALTER TABLE public.diary_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.diary_goals
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS milestones TEXT;

ALTER TABLE public.diary_budget_entries
  ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'expense';

UPDATE public.diary_budget_entries
SET entry_type = 'expense'
WHERE entry_type IS NULL;
