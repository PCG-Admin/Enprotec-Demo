-- Update test user emails from @enprotec.com to @pcg.com
-- Run in Supabase SQL Editor

-- 1. Update enprotec_users table
UPDATE public.enprotec_users SET email = 'admin-test@pcg.com'       WHERE email = 'admin-test@enprotec.com';
UPDATE public.enprotec_users SET email = 'driver-test@pcg.com'      WHERE email = 'driver-test@enprotec.com';
UPDATE public.enprotec_users SET email = 'opsmanager-test@pcg.com'  WHERE email = 'opsmanager-test@enprotec.com';
UPDATE public.enprotec_users SET email = 'dual-test@pcg.com'        WHERE email = 'dual-test@enprotec.com';

-- 2. Update auth.users table (Supabase auth)
UPDATE auth.users SET email = 'admin-test@pcg.com',      email_confirmed_at = NOW() WHERE email = 'admin-test@enprotec.com';
UPDATE auth.users SET email = 'driver-test@pcg.com',     email_confirmed_at = NOW() WHERE email = 'driver-test@enprotec.com';
UPDATE auth.users SET email = 'opsmanager-test@pcg.com', email_confirmed_at = NOW() WHERE email = 'opsmanager-test@enprotec.com';
UPDATE auth.users SET email = 'dual-test@pcg.com',       email_confirmed_at = NOW() WHERE email = 'dual-test@enprotec.com';
