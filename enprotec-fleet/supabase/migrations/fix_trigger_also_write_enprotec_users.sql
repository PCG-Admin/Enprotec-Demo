-- =============================================================
--  Fix handle_new_user trigger to also write to enprotec_users
--
--  enprotec_users schema:
--    role   → public.user_role  (enum)
--    status → public.user_status (enum)
--
--  Run once in Supabase SQL Editor.
-- =============================================================

-- ── 1. Replace the trigger function ──────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name       TEXT;
  v_role       TEXT;
  v_fleet_role TEXT;
  v_status     TEXT;
BEGIN
  v_name       := COALESCE(NEW.raw_user_meta_data->>'name',   split_part(NEW.email, '@', 1));
  v_role       := COALESCE(NEW.raw_user_meta_data->>'role',   'Driver');
  v_fleet_role := NEW.raw_user_meta_data->>'fleet_role';
  v_status     := COALESCE(NEW.raw_user_meta_data->>'status', 'Active');

  -- Write to profiles (TEXT columns — no enum cast needed)
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    v_name,
    COALESCE(NEW.email, ''),
    v_role,
    v_status
  )
  ON CONFLICT (id) DO UPDATE
    SET role   = EXCLUDED.role,
        name   = EXCLUDED.name,
        status = EXCLUDED.status;

  -- Write to enprotec_users (role → user_role enum, status → user_status enum)
  INSERT INTO public.enprotec_users (id, name, email, role, fleet_role, status, sites, departments)
  VALUES (
    NEW.id,
    v_name,
    COALESCE(NEW.email, ''),
    initcap(v_role)::user_role,
    v_fleet_role,
    initcap(v_status)::user_status,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'sites')),
      '{}'::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'departments')),
      '{}'::text[]
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET role       = EXCLUDED.role,
        fleet_role = EXCLUDED.fleet_role,
        name       = EXCLUDED.name,
        status     = EXCLUDED.status;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── 2. Backfill: profiles → enprotec_users ─────────────────────────
-- profiles.role and profiles.status are TEXT, cast to enums for enprotec_users
INSERT INTO public.enprotec_users (id, name, email, role, status)
SELECT
  p.id,
  p.name,
  p.email,
  initcap(p.role)::user_role,
  initcap(p.status)::user_status
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.enprotec_users eu WHERE eu.id = p.id
)
ON CONFLICT (id) DO NOTHING;


-- ── 3. Backfill: enprotec_users → profiles ─────────────────────────
-- enprotec_users.role and enprotec_users.status are enums, cast to TEXT for profiles
INSERT INTO public.profiles (id, name, email, role, status)
SELECT
  eu.id,
  eu.name,
  eu.email,
  eu.role::TEXT,
  eu.status::TEXT
FROM public.enprotec_users eu
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = eu.id
)
ON CONFLICT (id) DO NOTHING;
