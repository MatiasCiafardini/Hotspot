CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id BIGINT NOT NULL DEFAULT 1 REFERENCES public.stores(id),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  menu_shift TEXT NOT NULL DEFAULT 'dinner' CHECK (menu_shift IN ('lunch', 'dinner')),
  orders_count INTEGER NOT NULL DEFAULT 0,
  chargeable_orders_count INTEGER NOT NULL DEFAULT 0,
  rejected_orders_count INTEGER NOT NULL DEFAULT 0,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  cash_total NUMERIC NOT NULL DEFAULT 0,
  transfer_approved_total NUMERIC NOT NULL DEFAULT 0,
  transfer_pending_total NUMERIC NOT NULL DEFAULT 0,
  order_ids UUID[] NOT NULL DEFAULT '{}',
  orders_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_closures_store_closed_idx
  ON public.cash_closures (store_id, closed_at DESC);

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read cash closures" ON public.cash_closures;
DROP POLICY IF EXISTS "Authenticated insert cash closures" ON public.cash_closures;

CREATE POLICY "Authenticated read cash closures" ON public.cash_closures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert cash closures" ON public.cash_closures
  FOR INSERT TO authenticated WITH CHECK (true);
