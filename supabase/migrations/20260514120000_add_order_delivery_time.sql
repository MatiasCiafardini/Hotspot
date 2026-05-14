ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_time TIME;
