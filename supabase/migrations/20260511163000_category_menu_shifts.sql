ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS current_menu_shift TEXT NOT NULL DEFAULT 'dinner'
    CHECK (current_menu_shift IN ('lunch', 'dinner'));

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS menu_shifts TEXT[] NOT NULL DEFAULT ARRAY['lunch', 'dinner'];

UPDATE public.product_categories
SET menu_shifts = CASE
  WHEN key IN ('burgers', 'sides') THEN ARRAY['dinner']
  WHEN key IN ('woks', 'proteico', 'protein') THEN ARRAY['lunch']
  WHEN key IN ('drinks', 'bebidas') THEN ARRAY['lunch', 'dinner']
  ELSE ARRAY['lunch', 'dinner']
END
WHERE menu_shifts IS NULL OR menu_shifts = ARRAY['lunch', 'dinner'];
