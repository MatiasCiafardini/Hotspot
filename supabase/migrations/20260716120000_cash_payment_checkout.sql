ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS cash_confirmation_message TEXT NOT NULL
  DEFAULT 'Hola {nombre}, confirmamos tu pedido {pedido}. El total es {total}. Pagas en efectivo {entrega}.';

UPDATE public.store_settings
SET cash_confirmation_message =
  'Hola {nombre}, confirmamos tu pedido {pedido}. El total es {total}. Pagas en efectivo {entrega}.'
WHERE btrim(cash_confirmation_message) = '';

UPDATE public.store_settings
SET accepts_cash = true,
    payment_methods = ARRAY['Efectivo']
WHERE NOT accepts_cash AND NOT accepts_transfer;

ALTER TABLE public.store_settings
  DROP CONSTRAINT IF EXISTS store_settings_payment_method_enabled_check;

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_payment_method_enabled_check
  CHECK (accepts_cash OR accepts_transfer);
