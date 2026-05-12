-- Reset stock for the real burger menu.
-- Products in category burgers start with 100 units.
-- Every unique burger ingredient starts with 1000 units.

UPDATE public.products
SET stock_quantity = 100,
    low_stock_threshold = 10
WHERE store_id = 1
  AND category = 'burgers'
  AND available = true;

DELETE FROM public.stock_items
WHERE store_id = 1;

INSERT INTO public.stock_items (
  store_id,
  name,
  type,
  quantity,
  low_stock_threshold,
  available
)
SELECT
  1,
  name,
  'product',
  100,
  10,
  true
FROM public.products
WHERE store_id = 1
  AND category = 'burgers'
  AND available = true
ORDER BY sort_order, name;

INSERT INTO public.stock_items (
  store_id,
  name,
  type,
  quantity,
  low_stock_threshold,
  available
)
SELECT
  1,
  ingredient,
  'ingredient',
  1000,
  100,
  true
FROM (
  SELECT DISTINCT trim(ingredient) AS ingredient
  FROM public.products
  CROSS JOIN LATERAL unnest(ingredients) AS ingredient
  WHERE store_id = 1
    AND category = 'burgers'
    AND available = true
    AND trim(ingredient) <> ''
) unique_ingredients
ORDER BY ingredient;
