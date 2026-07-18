ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS transfer_alias TEXT;

UPDATE public.store_settings
SET transfer_alias = ''
WHERE transfer_alias IS NULL;

ALTER TABLE public.store_settings
  ALTER COLUMN transfer_alias SET DEFAULT '',
  ALTER COLUMN transfer_alias SET NOT NULL;
