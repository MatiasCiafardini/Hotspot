-- Manual inventory controls. This migration is intentionally additive: existing
-- stock_items rows and identifiers are preserved verbatim.

CREATE TABLE IF NOT EXISTS public.stock_items_pre_manual_control_backup
AS TABLE public.stock_items WITH DATA;

ALTER TABLE public.stock_items_pre_manual_control_backup ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.stock_items_pre_manual_control_backup) <>
     (SELECT count(*) FROM public.stock_items) THEN
    RAISE EXCEPTION 'stock_items backup validation failed';
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

ALTER TABLE public.stock_items
  ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric,
  ALTER COLUMN low_stock_threshold TYPE numeric(12,3) USING low_stock_threshold::numeric,
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'unidades',
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS target_stock numeric(12,3),
  ADD COLUMN IF NOT EXISTS allow_negative boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stock_items_pre_manual_control_backup backup
    FULL JOIN public.stock_items current_item USING (id)
    WHERE backup.id IS NULL
       OR current_item.id IS NULL
       OR backup.name IS DISTINCT FROM current_item.name
       OR backup.quantity::numeric IS DISTINCT FROM current_item.quantity
       OR backup.low_stock_threshold::numeric IS DISTINCT FROM current_item.low_stock_threshold
       OR backup.available IS DISTINCT FROM current_item.available
  ) THEN
    RAISE EXCEPTION 'stock_items values changed during manual control migration';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL DEFAULT 1,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

CREATE TABLE IF NOT EXISTS public.stock_list_items (
  list_id uuid NOT NULL REFERENCES public.stock_lists(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  step numeric(12,3) NOT NULL DEFAULT 1 CHECK (step > 0),
  PRIMARY KEY (list_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS public.stock_list_assignments (
  list_id uuid NOT NULL REFERENCES public.stock_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL DEFAULT 1,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  business_hours text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);

CREATE TABLE IF NOT EXISTS public.stock_item_suppliers (
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stock_item_id, supplier_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_item_one_primary_supplier
  ON public.stock_item_suppliers (stock_item_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL DEFAULT 1,
  list_id uuid NOT NULL REFERENCES public.stock_lists(id) ON DELETE RESTRICT,
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  unit text NOT NULL,
  previous_quantity numeric(12,3) NOT NULL,
  counted_quantity numeric(12,3) NOT NULL,
  difference numeric(12,3) NOT NULL,
  low_stock_threshold numeric(12,3) NOT NULL,
  target_stock numeric(12,3),
  UNIQUE (count_id, stock_item_id)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id bigint NOT NULL DEFAULT 1,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','prepared','ordered','cancelled')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ordered_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit text NOT NULL,
  current_quantity numeric(12,3) NOT NULL,
  target_stock numeric(12,3),
  suggested_quantity numeric(12,3) NOT NULL DEFAULT 0,
  order_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (order_quantity >= 0),
  included boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS stock_list_items_item_idx ON public.stock_list_items(stock_item_id);
CREATE INDEX IF NOT EXISTS stock_counts_list_created_idx ON public.stock_counts(list_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_count_items_item_idx ON public.stock_count_items(stock_item_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_created_idx ON public.purchase_orders(supplier_id, created_at DESC);

INSERT INTO public.stock_lists (store_id, name, slug, description)
SELECT 1, 'Stock general', 'stock-general', 'Lista inicial creada con el inventario existente.'
WHERE NOT EXISTS (SELECT 1 FROM public.stock_lists WHERE store_id = 1 AND slug = 'stock-general');

INSERT INTO public.stock_list_items (list_id, stock_item_id, sort_order)
SELECT list.id, item.id, row_number() OVER (ORDER BY lower(item.name)) - 1
FROM public.stock_lists list
JOIN public.stock_items item ON item.store_id = list.store_id
WHERE list.store_id = 1 AND list.slug = 'stock-general'
ON CONFLICT (list_id, stock_item_id) DO NOTHING;

ALTER TABLE public.stock_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_list_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_item_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- The server API uses the service role. Explicit grants are required on a
-- database rebuilt only from migrations (Dashboard-created projects may have
-- inherited these grants already).
GRANT ALL ON TABLE public.stock_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_roles TO service_role;
GRANT SELECT ON TABLE public.stock_items_pre_manual_control_backup TO service_role;
GRANT ALL ON TABLE public.stock_lists, public.stock_list_items,
  public.stock_list_assignments, public.suppliers, public.stock_item_suppliers,
  public.stock_counts, public.stock_count_items, public.purchase_orders,
  public.purchase_order_items TO service_role;

CREATE OR REPLACE FUNCTION public.can_access_stock_list(_user_id uuid, _list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'owner') OR EXISTS (
    SELECT 1 FROM public.stock_list_assignments
    WHERE list_id = _list_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Stock lists assigned read" ON public.stock_lists;
CREATE POLICY "Stock lists assigned read" ON public.stock_lists FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.can_access_stock_list(auth.uid(), id));

DROP POLICY IF EXISTS "Stock list items assigned read" ON public.stock_list_items;
CREATE POLICY "Stock list items assigned read" ON public.stock_list_items FOR SELECT TO authenticated
USING (public.can_access_stock_list(auth.uid(), list_id));

DROP POLICY IF EXISTS "Owners manage stock lists" ON public.stock_lists;
CREATE POLICY "Owners manage stock lists" ON public.stock_lists FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Owners manage stock list items" ON public.stock_list_items;
CREATE POLICY "Owners manage stock list items" ON public.stock_list_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Owners manage stock assignments" ON public.stock_list_assignments;
CREATE POLICY "Owners manage stock assignments" ON public.stock_list_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owners manage suppliers" ON public.suppliers;
CREATE POLICY "Owners manage suppliers" ON public.suppliers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Owners manage item suppliers" ON public.stock_item_suppliers;
CREATE POLICY "Owners manage item suppliers" ON public.stock_item_suppliers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Stock counts assigned read" ON public.stock_counts;
CREATE POLICY "Stock counts assigned read" ON public.stock_counts FOR SELECT TO authenticated
USING (public.can_access_stock_list(auth.uid(), list_id));
DROP POLICY IF EXISTS "Stock count items assigned read" ON public.stock_count_items;
CREATE POLICY "Stock count items assigned read" ON public.stock_count_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stock_counts c WHERE c.id = count_id AND public.can_access_stock_list(auth.uid(), c.list_id)));

DROP POLICY IF EXISTS "Owners manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Owners manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Owners manage purchase order items" ON public.purchase_order_items;
CREATE POLICY "Owners manage purchase order items" ON public.purchase_order_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.save_stock_count(
  _actor_id uuid,
  _list_id uuid,
  _notes text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count_id uuid;
  _entry jsonb;
  _current public.stock_items%ROWTYPE;
  _quantity numeric(12,3);
  _expected_updated_at timestamptz;
BEGIN
  IF NOT public.can_access_stock_list(_actor_id, _list_id) THEN
    RAISE EXCEPTION 'No autorizado para esta lista';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'El control no contiene items';
  END IF;

  INSERT INTO public.stock_counts(store_id, list_id, operator_id, notes)
  SELECT store_id, id, _actor_id, coalesce(_notes, '') FROM public.stock_lists WHERE id = _list_id
  RETURNING id INTO _count_id;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _current FROM public.stock_items
    WHERE id = (_entry->>'stock_item_id')::uuid FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM public.stock_list_items
      WHERE list_id = _list_id AND stock_item_id = _current.id
    ) THEN RAISE EXCEPTION 'Item invalido para la lista'; END IF;

    _quantity := (_entry->>'quantity')::numeric;
    _expected_updated_at := (_entry->>'expected_updated_at')::timestamptz;
    IF _current.updated_at IS DISTINCT FROM _expected_updated_at THEN
      RAISE EXCEPTION 'CONFLICT:%', _current.name;
    END IF;
    IF _quantity < 0 AND NOT _current.allow_negative THEN
      RAISE EXCEPTION 'Cantidad negativa no permitida: %', _current.name;
    END IF;

    INSERT INTO public.stock_count_items(
      count_id, stock_item_id, item_name, unit, previous_quantity,
      counted_quantity, difference, low_stock_threshold, target_stock
    ) VALUES (
      _count_id, _current.id, _current.name, _current.unit, _current.quantity,
      _quantity, _quantity - _current.quantity, _current.low_stock_threshold, _current.target_stock
    );
    UPDATE public.stock_items SET quantity = _quantity WHERE id = _current.id;
  END LOOP;
  RETURN _count_id;
END $$;

REVOKE ALL ON FUNCTION public.save_stock_count(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_stock_count(uuid, uuid, text, jsonb) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.stock_items source
    FULL JOIN public.stock_items_pre_manual_control_backup backup USING (id)
    WHERE source.id IS NULL OR backup.id IS NULL
      OR source.name IS DISTINCT FROM backup.name
      OR source.quantity IS DISTINCT FROM backup.quantity
      OR source.low_stock_threshold IS DISTINCT FROM backup.low_stock_threshold
      OR source.available IS DISTINCT FROM backup.available
  ) THEN RAISE EXCEPTION 'stock_items preservation validation failed'; END IF;
END $$;
