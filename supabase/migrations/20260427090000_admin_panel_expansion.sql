-- Expanded admin panel support. Additive and compatible with existing public shop.

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
  type TEXT NOT NULL CHECK (type IN ('product', 'ingredient')),
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock delete" ON public.stock_items;

CREATE POLICY "Owner read stock" ON public.stock_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock insert" ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock update" ON public.stock_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock delete" ON public.stock_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

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
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings update" ON public.store_settings;

CREATE POLICY "Owner read settings" ON public.store_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage settings insert" ON public.store_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage settings update" ON public.store_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP TRIGGER IF EXISTS trg_stock_items_updated ON public.stock_items;
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_settings_updated ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
