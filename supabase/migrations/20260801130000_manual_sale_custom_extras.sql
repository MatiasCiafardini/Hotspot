ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS custom_extras JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.order_items.custom_extras IS
  'Extras de precio libre agregados por el administrador durante una venta manual.';
