WITH product_extra_prices AS (
  SELECT
    id,
    ingredients,
    EXISTS (
      SELECT 1 FROM unnest(ingredients) AS ingredient
      WHERE lower(ingredient) LIKE '%carne%'
         OR lower(ingredient) LIKE '%medallon%'
    ) AS has_meat,
    EXISTS (
      SELECT 1 FROM unnest(ingredients) AS ingredient
      WHERE lower(ingredient) LIKE '%cheddar%'
         OR lower(ingredient) LIKE '%chedar%'
    ) AS has_cheddar
  FROM public.products
),
normalized_extra_prices AS (
  SELECT
    id,
    (
      CASE WHEN has_meat AND has_cheddar
        THEN jsonb_build_object('Carne y cheddar', 3500)
        ELSE '{}'::jsonb
      END
      ||
      CASE WHEN has_meat AND NOT has_cheddar
        THEN jsonb_build_object('Carne', 3500)
        ELSE '{}'::jsonb
      END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%lechuga%'
      ) THEN jsonb_build_object('Lechuga', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%tomate%'
      ) THEN jsonb_build_object('Tomate', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%pepinillo%'
      ) THEN jsonb_build_object('Pepinillos', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%aro%'
          AND lower(ingredient) LIKE '%cebolla%'
      ) THEN jsonb_build_object('Aros de cebolla', 1500) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%cebolla crispy%'
           OR lower(ingredient) LIKE '%cebollita crispy%'
           OR lower(ingredient) LIKE '%cebolla crispi%'
      ) THEN jsonb_build_object('Cebolla crispy', 1500) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%cebolla caramel%'
           OR lower(ingredient) LIKE '%cebollita caramel%'
      ) THEN jsonb_build_object('Cebolla caramelizada', 1500) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) = 'cebolla'
           OR lower(ingredient) LIKE '%cebolla cruda%'
      ) THEN jsonb_build_object('Cebolla', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%huevo%'
      ) THEN jsonb_build_object('Huevo frito', 1500) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%cheddar liquido%'
           OR lower(ingredient) LIKE '%chedar liquido%'
           OR lower(ingredient) LIKE '%cheddar fundido%'
      ) THEN jsonb_build_object('Chedar liquido', 2000) ELSE '{}'::jsonb END
      ||
      CASE WHEN has_cheddar AND NOT (has_meat AND has_cheddar)
        THEN jsonb_build_object('Chedar feta', 1000)
        ELSE '{}'::jsonb
      END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%mayonesa%'
      ) THEN jsonb_build_object('Mayonesa', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%mostaza%'
      ) THEN jsonb_build_object('Mostaza', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%ketchup%'
           OR lower(ingredient) LIKE '%quetchup%'
      ) THEN jsonb_build_object('Ketchup', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%bbq%'
      ) THEN jsonb_build_object('BBQ', 1000) ELSE '{}'::jsonb END
      ||
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(ingredients) AS ingredient
        WHERE lower(ingredient) LIKE '%barbacoa%'
      ) THEN jsonb_build_object('Barbacoa', 1000) ELSE '{}'::jsonb END
    ) AS extra_ingredient_prices
  FROM product_extra_prices
)
UPDATE public.products AS product
SET extra_ingredient_prices = normalized_extra_prices.extra_ingredient_prices
FROM normalized_extra_prices
WHERE product.id = normalized_extra_prices.id;
