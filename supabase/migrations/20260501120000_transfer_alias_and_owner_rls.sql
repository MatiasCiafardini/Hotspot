ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS transfer_alias TEXT NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "Authenticated read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owner read settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public read settings" ON public.store_settings;
CREATE POLICY "Public read settings" ON public.store_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated manage settings update" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings insert" ON public.store_settings;
DROP POLICY IF EXISTS "Owner manage settings update" ON public.store_settings;
CREATE POLICY "Owner manage settings insert" ON public.store_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage settings update" ON public.store_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated manage products insert" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products update" ON public.products;
DROP POLICY IF EXISTS "Authenticated manage products delete" ON public.products;
DROP POLICY IF EXISTS "Owner manage products insert" ON public.products;
DROP POLICY IF EXISTS "Owner manage products update" ON public.products;
DROP POLICY IF EXISTS "Owner manage products delete" ON public.products;
CREATE POLICY "Owner manage products insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage products update" ON public.products
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage products delete" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated manage categories insert" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories update" ON public.product_categories;
DROP POLICY IF EXISTS "Authenticated manage categories delete" ON public.product_categories;
DROP POLICY IF EXISTS "Owner manage categories insert" ON public.product_categories;
DROP POLICY IF EXISTS "Owner manage categories update" ON public.product_categories;
DROP POLICY IF EXISTS "Owner manage categories delete" ON public.product_categories;
CREATE POLICY "Owner manage categories insert" ON public.product_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage categories update" ON public.product_categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage categories delete" ON public.product_categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;
DROP POLICY IF EXISTS "Owner read orders" ON public.orders;
DROP POLICY IF EXISTS "Owner update orders" ON public.orders;
CREATE POLICY "Owner read orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated read order items" ON public.order_items;
DROP POLICY IF EXISTS "Owner read order items" ON public.order_items;
CREATE POLICY "Owner read order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Authenticated manage stock delete" ON public.stock_items;
DROP POLICY IF EXISTS "Owner read stock" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock insert" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock update" ON public.stock_items;
DROP POLICY IF EXISTS "Owner manage stock delete" ON public.stock_items;
CREATE POLICY "Owner read stock" ON public.stock_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock insert" ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock update" ON public.stock_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner manage stock delete" ON public.stock_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner update product images" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete product images" ON storage.objects;
CREATE POLICY "Owner upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner update product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'owner')) WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'owner'));
