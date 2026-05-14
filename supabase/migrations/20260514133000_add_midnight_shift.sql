ALTER TABLE public.store_settings
  DROP CONSTRAINT IF EXISTS store_settings_current_menu_shift_check;

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_current_menu_shift_check
  CHECK (current_menu_shift IN ('lunch', 'dinner', 'midnight'));

ALTER TABLE public.cash_closures
  DROP CONSTRAINT IF EXISTS cash_closures_menu_shift_check;

ALTER TABLE public.cash_closures
  ADD CONSTRAINT cash_closures_menu_shift_check
  CHECK (menu_shift IN ('lunch', 'dinner', 'midnight'));

ALTER TABLE public.product_categories
  ALTER COLUMN menu_shifts SET DEFAULT ARRAY['lunch', 'dinner'];

INSERT INTO public.product_categories (store_id, key, label, sort_order, active, menu_shifts)
VALUES (1, 'midnight', 'Madrugada', 2, true, ARRAY['midnight'])
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  menu_shifts = EXCLUDED.menu_shifts,
  updated_at = now();

DELETE FROM public.products
WHERE store_id = 1
  AND category = 'midnight'
  AND name IN ('Clasica madrugada', 'Cheeseburger madrugada');

INSERT INTO public.products (
  store_id,
  name,
  description,
  price,
  category,
  image_url,
  badge,
  available,
  sort_order,
  stock_quantity,
  low_stock_threshold,
  ingredients,
  extra_ingredient_prices
)
VALUES
  (
    1,
    'Clasica madrugada',
    'Doble carne, cheddar y pan. Version simple, sin papas y sin salsas.',
    10000,
    'midnight',
    '/src/assets/burger-classic.jpg',
    'MADRUGADA',
    true,
    1,
    30,
    5,
    ARRAY['Doble carne', 'Cheddar'],
    '{"Carne y cheddar": 3500}'::jsonb
  ),
  (
    1,
    'Cheeseburger madrugada',
    'Doble carne y doble cheddar. Version simple, sin papas y sin salsas.',
    10000,
    'midnight',
    '/src/assets/burger-double.jpg',
    'MADRUGADA',
    true,
    2,
    30,
    5,
    ARRAY['Doble carne', 'Doble cheddar'],
    '{"Carne y cheddar": 3500}'::jsonb
  );
