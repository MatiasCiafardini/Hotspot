-- Grant admin access to the known store owner account.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::public.app_role
FROM auth.users
WHERE lower(email) = 'matiasciafardini@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
