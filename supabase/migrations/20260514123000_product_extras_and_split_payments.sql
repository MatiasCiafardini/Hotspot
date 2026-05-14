ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS extra_ingredient_prices JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_cash_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_transfer_amount NUMERIC(10,2);
