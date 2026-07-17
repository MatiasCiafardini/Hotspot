CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id BIGINT NOT NULL DEFAULT 1 REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS admin_push_subscriptions_store_idx
  ON public.admin_push_subscriptions (store_id);

ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read own push subscriptions" ON public.admin_push_subscriptions;
DROP POLICY IF EXISTS "Owner insert own push subscriptions" ON public.admin_push_subscriptions;
DROP POLICY IF EXISTS "Owner update own push subscriptions" ON public.admin_push_subscriptions;
DROP POLICY IF EXISTS "Owner delete own push subscriptions" ON public.admin_push_subscriptions;

CREATE POLICY "Owner read own push subscriptions" ON public.admin_push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner insert own push subscriptions" ON public.admin_push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner update own push subscriptions" ON public.admin_push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner delete own push subscriptions" ON public.admin_push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'owner'));
