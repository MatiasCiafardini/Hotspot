ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_day_started_at TIMESTAMPTZ;

UPDATE public.store_settings
SET current_day_started_at = COALESCE(current_day_started_at, now())
WHERE is_open = true;
