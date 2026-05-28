-- Hotspot full Supabase setup.
-- Use this for a brand-new Supabase project.
-- Supabase Dashboard > SQL Editor > New query > paste everything > Run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('owner', 'customer');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending',
      'pending_payment',
      'pending_confirmation',
      'confirmed',
      'preparing',
      'ready',
      'delivered',
      'rejected',
      'cancelled'
    );
  ELSE
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_payment';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';
    ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  image_url TEXT,
  modal_image_url TEXT,
  badge TEXT,
  promotion TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  extra_ingredient_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  delivery_method TEXT NOT NULL DEFAULT 'pickup',
  delivery_time TIME,
  payment_method TEXT DEFAULT 'efectivo',
  payment_cash_amount NUMERIC(10,2),
  payment_transfer_amount NUMERIC(10,2),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_receipt_url TEXT,
  notes TEXT,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  status public.order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_time TIME;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS modal_image_url TEXT,
  ADD COLUMN IF NOT EXISTS extra_ingredient_prices JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_cash_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS payment_transfer_amount NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  base_ingredients TEXT[] NOT NULL DEFAULT '{}',
  removed_ingredients TEXT[] NOT NULL DEFAULT '{}',
  added_ingredients TEXT[] NOT NULL DEFAULT '{}',
  item_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ingredient',
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Hotspot',
  logo_url TEXT,
  hours TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  delivery_fee NUMERIC NOT NULL DEFAULT 5500,
  payment_methods TEXT[] NOT NULL DEFAULT '{"Efectivo","Transferencia"}',
  accepts_cash BOOLEAN NOT NULL DEFAULT true,
  accepts_transfer BOOLEAN NOT NULL DEFAULT true,
  automatic_message TEXT NOT NULL DEFAULT '',
  print_width_mm INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Products public read" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products insert" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products update" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products delete" ON public.products;
CREATE POLICY "Products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "Authenticated manage products insert" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage products update" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage products delete" ON public.products FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Categories public read" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories insert" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories update" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories delete" ON public.product_categories;
CREATE POLICY "Categories public read" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated manage categories insert" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage categories update" ON public.product_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage categories delete" ON public.product_categories FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone create order" ON public.orders;
DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;
CREATE POLICY "Anyone create order" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update orders" ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone create order items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated read order items" ON public.order_items;
CREATE POLICY "Anyone create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated read order items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock delete" ON public.stock_items;
CREATE POLICY "Authenticated read stock" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage stock insert" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage stock update" ON public.stock_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage stock delete" ON public.stock_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated manage settings update" ON public.store_settings;
CREATE POLICY "Authenticated read settings" ON public.store_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage settings insert" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage settings update" ON public.store_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Authenticated update product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Authenticated delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_categories_updated ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_stock_items_updated ON public.stock_items;
CREATE TRIGGER trg_stock_items_updated BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_store_settings_updated ON public.store_settings;
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;

INSERT INTO public.product_categories (key, label, sort_order, active) VALUES
  ('burgers', 'Hamburguesas', 1, true),
  ('sides', 'Sides', 2, true),
  ('drinks', 'Bebidas', 3, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

INSERT INTO public.products (
  name, description, price, category, image_url, badge, available, sort_order,
  stock_quantity, low_stock_threshold, ingredients
) VALUES
  ('La Clasica', 'Pan, medallon, queso, lechuga, tomate y salsa de la casa.', 9.00, 'burgers', '/src/assets/burger-classic.jpg', 'TOP', true, 1, 30, 5, ARRAY['Pan','Medallon','Queso','Lechuga','Tomate','Salsa']),
  ('Fuego Callejero', 'Bun negro, jalapenos, pepper jack, bacon ahumado y sriracha.', 11.00, 'burgers', '/src/assets/burger-spicy.jpg', 'PICANTE', true, 2, 25, 5, ARRAY['Pan','Medallon','Queso','Jalapenos','Bacon','Salsa']),
  ('Doble Smash', 'Doble medallon, doble queso, pepinos y salsa especial.', 13.00, 'burgers', '/src/assets/burger-double.jpg', 'TOP', true, 3, 20, 5, ARRAY['Pan','Medallon','Queso','Pepinos','Salsa']),
  ('Veggie Street', 'Medallon veggie, queso, lechuga, tomate y mayo de hierbas.', 10.00, 'burgers', '/src/assets/burger-veggie.jpg', 'VEGGIE', true, 4, 15, 4, ARRAY['Pan','Medallon veggie','Queso','Lechuga','Tomate','Salsa']),
  ('Papas Crocantes', 'Papas fritas doradas con sal y salsa.', 5.00, 'sides', '/src/assets/side-fries.jpg', null, true, 5, 40, 8, ARRAY['Papas','Sal','Salsa']),
  ('Aros de Cebolla', 'Aros rebozados y crujientes.', 5.50, 'sides', '/src/assets/side-rings.jpg', null, true, 6, 35, 8, ARRAY['Cebolla','Rebozado','Salsa']),
  ('Milkshake', 'Shake frio y cremoso.', 4.50, 'drinks', '/src/assets/drink-shake.jpg', null, true, 7, 30, 6, ARRAY[]::TEXT[]),
  ('Cola', 'Bebida cola fria.', 3.00, 'drinks', '/src/assets/drink-cola.jpg', null, true, 8, 50, 10, ARRAY[]::TEXT[])
ON CONFLICT DO NOTHING;

INSERT INTO public.stock_items (name, type, quantity, low_stock_threshold, available)
SELECT name, 'ingredient', stock_quantity, low_stock_threshold, available
FROM public.products
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.stock_items (name, type, quantity, low_stock_threshold, available) VALUES
  ('Pan', 'ingredient', 100, 20, true),
  ('Medallon', 'ingredient', 100, 20, true),
  ('Queso', 'ingredient', 100, 20, true),
  ('Lechuga', 'ingredient', 40, 10, true),
  ('Tomate', 'ingredient', 40, 10, true),
  ('Cebolla', 'ingredient', 40, 10, true),
  ('Salsa', 'ingredient', 60, 10, true)
ON CONFLICT (name, type) DO NOTHING;

INSERT INTO public.store_settings (
  store_name, logo_url, hours, contact_phone, address, delivery_fee, payment_methods,
  accepts_cash, accepts_transfer, automatic_message, print_width_mm
)
SELECT
  'Hotspot',
  '/src/assets/logo_hotspot.png',
  'Todos los dias de 19:00 a 00:00',
  '+54 9 11 0000-0000',
  'Direccion del local',
  5500,
  ARRAY['Efectivo', 'Transferencia'],
  true,
  true,
  'Recibimos tu pedido. Te avisamos cuando este confirmado.',
  80
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);
