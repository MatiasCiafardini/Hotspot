ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_discount_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_type_check
      CHECK (discount_type IS NULL OR discount_type IN ('percent', 'fixed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_discount_values_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_discount_values_check
      CHECK (
        (discount_value IS NULL OR discount_value >= 0)
        AND (discount_amount IS NULL OR discount_amount >= 0)
        AND (delivery_fee IS NULL OR delivery_fee >= 0)
      );
  END IF;
END
$$;
