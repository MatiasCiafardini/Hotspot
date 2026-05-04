CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS public.stores (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Hotspot',
  slug TEXT NOT NULL UNIQUE DEFAULT 'hotspot',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.stores (id, name, slug)
VALUES (1, 'Hotspot', 'hotspot')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_provider') THEN
    CREATE TYPE public.customer_provider AS ENUM ('email', 'google');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id BIGINT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT,
  provider public.customer_provider NOT NULL DEFAULT 'email',
  google_id TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, email)
);

CREATE INDEX IF NOT EXISTS customers_store_id_idx ON public.customers (store_id);
CREATE INDEX IF NOT EXISTS customers_store_email_lower_idx ON public.customers (store_id, lower(email));

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id BIGINT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,
  street TEXT NOT NULL,
  number TEXT,
  city TEXT,
  reference TEXT,
  phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_addresses_store_customer_idx
  ON public.customer_addresses (store_id, customer_id);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id BIGINT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_store_customer_idx
  ON public.password_reset_tokens (store_id, customer_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_id BIGINT REFERENCES public.stores(id);

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS store_id BIGINT REFERENCES public.stores(id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id BIGINT REFERENCES public.stores(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS store_id BIGINT REFERENCES public.stores(id);

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS store_id BIGINT REFERENCES public.stores(id);

UPDATE public.products SET store_id = 1 WHERE store_id IS NULL;
UPDATE public.product_categories SET store_id = 1 WHERE store_id IS NULL;
UPDATE public.orders SET store_id = 1 WHERE store_id IS NULL;
UPDATE public.stock_items SET store_id = 1 WHERE store_id IS NULL;
UPDATE public.store_settings SET store_id = 1 WHERE store_id IS NULL;

ALTER TABLE public.products ALTER COLUMN store_id SET DEFAULT 1;
ALTER TABLE public.product_categories ALTER COLUMN store_id SET DEFAULT 1;
ALTER TABLE public.orders ALTER COLUMN store_id SET DEFAULT 1;
ALTER TABLE public.stock_items ALTER COLUMN store_id SET DEFAULT 1;
ALTER TABLE public.store_settings ALTER COLUMN store_id SET DEFAULT 1;

ALTER TABLE public.products ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.product_categories ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.stock_items ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE public.store_settings ALTER COLUMN store_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS products_store_id_idx ON public.products (store_id);
CREATE INDEX IF NOT EXISTS product_categories_store_id_idx ON public.product_categories (store_id);
CREATE INDEX IF NOT EXISTS orders_store_id_idx ON public.orders (store_id);
CREATE INDEX IF NOT EXISTS orders_store_customer_idx ON public.orders (store_id, customer_id);
CREATE INDEX IF NOT EXISTS stock_items_store_id_idx ON public.stock_items (store_id);
CREATE INDEX IF NOT EXISTS store_settings_store_id_idx ON public.store_settings (store_id);

DROP TRIGGER IF EXISTS trg_stores_updated ON public.stores;
CREATE TRIGGER trg_stores_updated
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated ON public.customers;
CREATE TRIGGER trg_customers_updated
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customer_addresses_updated ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
