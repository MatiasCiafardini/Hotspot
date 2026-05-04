CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories public read" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories insert" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories update" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories delete" ON public.product_categories;

CREATE POLICY "Categories public read" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated manage categories insert" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage categories update" ON public.product_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage categories delete" ON public.product_categories FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_product_categories_updated ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_categories (key, label, sort_order, active) VALUES
  ('burgers', 'Hamburguesas', 1, true),
  ('sides', 'Sides', 2, true),
  ('drinks', 'Bebidas', 3, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;
