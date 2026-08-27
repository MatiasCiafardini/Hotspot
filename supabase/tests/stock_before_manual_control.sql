-- Fixture que representa inventario cargado manualmente antes de la migracion.
-- No contiene datos de produccion.
INSERT INTO public.stock_items (
  id, store_id, name, type, quantity, low_stock_threshold, available, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  1,
  'Item de prueba ' || lpad(number::text, 3, '0'),
  'ingredient',
  (number * 1.0)::integer,
  ((number % 7) + 2)::integer,
  number % 9 <> 0,
  now() - make_interval(days => number),
  now() - make_interval(hours => number)
FROM generate_series(1, 100) number;
