ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 5500;

UPDATE public.store_settings
SET delivery_fee = 5500
WHERE delivery_fee IS NULL;

ALTER TABLE public.store_settings
  ALTER COLUMN delivery_fee SET DEFAULT 5500,
  ALTER COLUMN delivery_fee SET NOT NULL;
