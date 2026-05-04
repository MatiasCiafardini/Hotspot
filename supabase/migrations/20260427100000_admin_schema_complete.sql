-- Complete admin schema for Hotspot.
-- Run this in Supabase SQL Editor or through `supabase db push`.
-- It is intentionally idempotent so it can be executed more than once.

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_ingredients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS removed_ingredients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS added_ingredients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS item_notes TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS promotion TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ingredients TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ingredient',
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_items_name_type_key ON public.stock_items (lower(name), type);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Hotspot',
  logo_url TEXT,
  hours TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  payment_methods TEXT[] NOT NULL DEFAULT '{"Efectivo","Transferencia"}',
  accepts_cash BOOLEAN NOT NULL DEFAULT true,
  accepts_transfer BOOLEAN NOT NULL DEFAULT true,
  automatic_message TEXT NOT NULL DEFAULT '',
  print_width_mm INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manage products insert" ON public.products;
DROP POLICY IF EXISTS "Owner manage products update" ON public.products;
DROP POLICY IF EXISTS "Owner manage products delete" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products insert" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products update" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products delete" ON public.products;

CREATE POLICY "Authenticated manage products insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage products update" ON public.products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage products delete" ON public.products
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read orders" ON public.orders;
DROP POLICY IF EXISTS "Owner update orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;

CREATE POLICY "Authenticated read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner read order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated read order items" ON public.order_items;

CREATE POLICY "Authenticated read order items" ON public.order_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock delete" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock delete" ON public.stock_items;

CREATE POLICY "Authenticated read stock" ON public.stock_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage stock insert" ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage stock update" ON public.stock_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage stock delete" ON public.stock_items
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings update" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated manage settings update" ON public.store_settings;

CREATE POLICY "Authenticated read settings" ON public.store_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage settings insert" ON public.store_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage settings update" ON public.store_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_stock_items_updated ON public.stock_items;
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_settings_updated ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_settings (
  store_name,
  logo_url,
  hours,
  contact_phone,
  address,
  payment_methods,
  accepts_cash,
  accepts_transfer,
  automatic_message,
  print_width_mm
)
SELECT
  'Hotspot',
  '/src/assets/logo_hotspot.png',
  'Todos los dias de 19:00 a 00:00',
  '+54 9 11 0000-0000',
  'Direccion del local',
  ARRAY['Efectivo', 'Transferencia'],
  true,
  true,
  'Recibimos tu pedido. Te avisamos cuando este confirmado.',
  80
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

INSERT INTO public.stock_items (name, type, quantity, low_stock_threshold, available)
SELECT name, 'ingredient', stock_quantity, low_stock_threshold, available
FROM public.products
ON CONFLICT (lower(name), type) DO NOTHING;
