UPDATE public.products
SET extra_ingredient_prices =
  (COALESCE(extra_ingredient_prices, '{}'::jsonb) - 'Huevo frito')
  || '{"Carne y cheddar": 4000, "Panceta": 1500, "Huevo": 1500}'::jsonb
WHERE category = 'burgers';
