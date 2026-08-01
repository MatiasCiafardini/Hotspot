ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS hero_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.store_settings.hero_product_id IS
  'Producto cuya imagen se muestra en el hero de la pagina de inicio. NULL selecciona la primera hamburguesa disponible.';
