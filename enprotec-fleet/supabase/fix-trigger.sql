-- =============================================================
--  FIX — "Database error creating new user"
--
--  Run each block ONE AT A TIME in the Supabase SQL Editor.
--  Use the "Run" button for each block separately.
-- =============================================================


-- ─── BLOCK 1: Diagnose what exists ────────────────────────────
-- Run this first to understand the current state.
SELECT
  (SELECT COUNT(*) FROM pg_type      WHERE typname    = 'user_role')            AS user_role_exists,
  (SELECT COUNT(*) FROM pg_tables    WHERE schemaname = 'public' AND tablename = 'profiles') AS profiles_table_exists,
  (SELECT COUNT(*) FROM pg_proc      WHERE proname    = 'handle_new_user')      AS function_exists,
  (SELECT COUNT(*) FROM pg_trigger   WHERE tgname     = 'trg_on_auth_user_created') AS trigger_exists;


-- ─── BLOCK 2: Nuke the broken trigger ─────────────────────────
-- Run this to completely remove the trigger blocking user creation.
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;


-- ─── BLOCK 3: Ensure user_role enum has the required values ───
-- Only run if Block 1 showed user_role_exists = 1.
-- If user_role_exists = 0, skip this block — schema.sql will create it.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Driver';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Fleet Coordinator';


-- ─── BLOCK 4: Recreate the trigger (safe version) ─────────────
-- Run this after Block 2 (and Block 3 if needed).
-- This version has no type dependencies in DECLARE and catches all errors.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    'Driver',   -- safe default; update via Administration page after login
    'Active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Silently ignore profile insert errors — never block auth user creation.
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Grant the function access to the profiles table
GRANT USAGE ON SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL   ON public.profiles TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── BLOCK 5: Try creating a user now ─────────────────────────
-- Go to Supabase Dashboard → Authentication → Users → Add User
-- If it works, continue to Block 6.


-- ─── BLOCK 6: Run full schema (if not done yet) ───────────────
-- Open schema.sql and run it in the SQL Editor.
-- This creates the profiles table, vehicles, licenses, etc.


-- ─── BLOCK 7: Backfill profiles for already-created users ─────
-- Run AFTER schema.sql if users were created before the profiles table existed.
INSERT INTO public.profiles (id, name, email, role, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  COALESCE(u.email, ''),
  'Driver',
  'Active'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- After backfill, set correct roles in the Table Editor:
-- public.profiles → find each user → set role to 'Admin' or 'Fleet Coordinator'
