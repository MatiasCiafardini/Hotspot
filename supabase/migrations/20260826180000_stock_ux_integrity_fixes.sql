-- Atomic owner operations and protection against duplicate active purchase drafts.

CREATE OR REPLACE FUNCTION public.save_stock_supplier(
  _supplier_id uuid,
  _store_id bigint,
  _name text,
  _phone text,
  _address text,
  _business_hours text,
  _notes text,
  _active boolean,
  _item_ids uuid[],
  _primary_item_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _result_id uuid;
BEGIN
  IF nullif(trim(_name), '') IS NULL THEN
    RAISE EXCEPTION 'El proveedor necesita un nombre';
  END IF;

  IF _supplier_id IS NULL THEN
    INSERT INTO public.suppliers(store_id, name, phone, address, business_hours, notes, active)
    VALUES (_store_id, trim(_name), coalesce(_phone, ''), coalesce(_address, ''),
      coalesce(_business_hours, ''), coalesce(_notes, ''), coalesce(_active, true))
    RETURNING id INTO _result_id;
  ELSE
    UPDATE public.suppliers SET
      name = trim(_name), phone = coalesce(_phone, ''), address = coalesce(_address, ''),
      business_hours = coalesce(_business_hours, ''), notes = coalesce(_notes, ''),
      active = coalesce(_active, true), updated_at = now()
    WHERE id = _supplier_id AND store_id = _store_id
    RETURNING id INTO _result_id;
    IF _result_id IS NULL THEN RAISE EXCEPTION 'Proveedor inexistente'; END IF;
  END IF;

  UPDATE public.stock_item_suppliers
    SET is_primary = false
    WHERE stock_item_id = ANY(coalesce(_primary_item_ids, ARRAY[]::uuid[]));
  DELETE FROM public.stock_item_suppliers WHERE supplier_id = _result_id;
  INSERT INTO public.stock_item_suppliers(stock_item_id, supplier_id, is_primary)
    SELECT item_id, _result_id, item_id = ANY(coalesce(_primary_item_ids, ARRAY[]::uuid[]))
    FROM unnest(coalesce(_item_ids, ARRAY[]::uuid[])) item_id;

  RETURN _result_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_stock_purchase_order(
  _store_id bigint,
  _supplier_id uuid,
  _created_by uuid,
  _notes text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid;
  _entry jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_store_id::text || ':' || coalesce(_supplier_id::text, ''), 0));
  IF EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE store_id = _store_id AND supplier_id = _supplier_id
      AND status IN ('draft', 'prepared')
  ) THEN
    RAISE EXCEPTION 'ACTIVE_ORDER_EXISTS';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'El pedido no contiene productos';
  END IF;

  INSERT INTO public.purchase_orders(store_id, supplier_id, created_by, notes, status)
  VALUES (_store_id, _supplier_id, _created_by, coalesce(_notes, ''), 'draft')
  RETURNING id INTO _order_id;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF coalesce((_entry->>'order_quantity')::numeric, 0) > 0 THEN
      INSERT INTO public.purchase_order_items(
        purchase_order_id, stock_item_id, item_name, unit, current_quantity,
        target_stock, suggested_quantity, order_quantity, included
      ) VALUES (
        _order_id, nullif(_entry->>'stock_item_id', '')::uuid, _entry->>'item_name',
        coalesce(_entry->>'unit', 'unidades'), (_entry->>'current_quantity')::numeric,
        nullif(_entry->>'target_stock', '')::numeric,
        coalesce((_entry->>'suggested_quantity')::numeric, 0),
        (_entry->>'order_quantity')::numeric, coalesce((_entry->>'included')::boolean, true)
      );
    END IF;
  END LOOP;
  RETURN _order_id;
END $$;

REVOKE ALL ON FUNCTION public.save_stock_supplier(uuid,bigint,text,text,text,text,text,boolean,uuid[],uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_stock_supplier(uuid,bigint,text,text,text,text,text,boolean,uuid[],uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.create_stock_purchase_order(bigint,uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_purchase_order(bigint,uuid,uuid,text,jsonb) TO service_role;
