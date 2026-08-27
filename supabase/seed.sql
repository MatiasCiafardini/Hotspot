-- Datos ficticios y no personales para probar el modulo de inventario local.
UPDATE public.stock_items
SET unit = CASE
    WHEN lower(name) LIKE '%salsa%' THEN 'litros'
    WHEN lower(name) LIKE '%carne%' OR lower(name) LIKE '%papa%' THEN 'kg'
    ELSE 'unidades'
  END,
  target_stock = greatest(quantity, low_stock_threshold * 2),
  allow_negative = false
WHERE store_id = 1;

INSERT INTO public.suppliers (store_id, name, phone, address, business_hours, notes)
VALUES
  (1, 'Proveedor de prueba A', '5491100000001', 'Direccion ficticia 1', 'Lunes a viernes', 'No enviar: entorno de pruebas'),
  (1, 'Proveedor de prueba B', '5491100000002', 'Direccion ficticia 2', 'Martes y jueves', 'No enviar: entorno de pruebas')
ON CONFLICT (store_id, name) DO UPDATE SET phone = excluded.phone;

INSERT INTO public.stock_item_suppliers (stock_item_id, supplier_id, is_primary)
SELECT item.id, supplier.id, true
FROM (SELECT id FROM public.stock_items WHERE store_id = 1 ORDER BY lower(name) LIMIT 5) item
CROSS JOIN (SELECT id FROM public.suppliers WHERE name = 'Proveedor de prueba A' AND store_id = 1) supplier
ON CONFLICT (stock_item_id, supplier_id) DO UPDATE SET is_primary = true;
