-- Enable RLS on customer-auth tables created by 20260504180000_customer_auth_base.sql.
-- Customer data is accessed by trusted server routes with the service role key.

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores public read" ON public.stores;
CREATE POLICY "Stores public read" ON public.stores
  FOR SELECT USING (true);
