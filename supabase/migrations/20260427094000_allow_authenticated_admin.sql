-- Allow every authenticated account to use the admin panel.
-- This intentionally replaces owner-only RLS policies.

DROP POLICY IF EXISTS "Owner manage products insert" ON public.products;
DROP POLICY IF EXISTS "Owner manage products update" ON public.products;
DROP POLICY IF EXISTS "Owner manage products delete" ON public.products;

CREATE POLICY "Authenticated manage products insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage products update" ON public.products
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated manage products delete" ON public.products
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read orders" ON public.orders;
DROP POLICY IF EXISTS "Owner update orders" ON public.orders;

CREATE POLICY "Authenticated read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner read order items" ON public.order_items;

CREATE POLICY "Authenticated read order items" ON public.order_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Owner read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock delete" ON public.stock_items;

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

CREATE POLICY "Authenticated read settings" ON public.store_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage settings insert" ON public.store_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated manage settings update" ON public.store_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
