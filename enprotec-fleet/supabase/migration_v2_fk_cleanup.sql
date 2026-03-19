-- =============================================================
--  Phase 2 — DB Cleanup Migration  (idempotent — safe to re-run)
--  Run this in Supabase SQL Editor once.
--
--  Changes:
--  1. Add fleet_role TEXT to enprotec_users (replaces fleet_access boolean)
--  2. Fix vehicles.site_id FK → enprotec_sites (was pointing to old sites table)
--  3. vehicles.assigned_driver TEXT → assigned_driver_id UUID FK → enprotec_users
--  4. Drop redundant columns (site_name, vehicle_reg, inspector_name, vehicle_registration)
--  5. Fix inspector_id / created_by / assigned_to FKs → enprotec_users
-- =============================================================

-- ─── 1. enprotec_users: add fleet_role ────────────────────────────────────────────
ALTER TABLE public.enprotec_users ADD COLUMN IF NOT EXISTS fleet_role TEXT NULL;

-- Migrate existing fleet_access = true users to Fleet Coordinator role
UPDATE public.enprotec_users
SET fleet_role = 'Fleet Coordinator'
WHERE fleet_access = true
  AND role NOT IN ('Admin', 'Driver')
  AND fleet_role IS NULL;

-- ─── 2. vehicles: fix site_id FK → enprotec_sites ─────────────────────────────────
-- NULL out any site_id values that don't exist in enprotec_sites (orphaned references)
UPDATE public.vehicles
SET site_id = NULL
WHERE site_id IS NOT NULL
  AND site_id NOT IN (SELECT id FROM public.enprotec_sites);

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_site_id_fkey;
ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES public.enprotec_sites(id) ON DELETE SET NULL;

-- Drop redundant site_name (join via site_id)
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS site_name;

-- ─── 3. vehicles: assigned_driver TEXT → assigned_driver_id UUID FK ──────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID
  REFERENCES public.enprotec_users(id) ON DELETE SET NULL;

-- Migrate existing text names to UUIDs (single driver match)
UPDATE public.vehicles v
SET assigned_driver_id = (
  SELECT id FROM public.enprotec_users u
  WHERE u.name = v.assigned_driver
  LIMIT 1
)
WHERE v.assigned_driver IS NOT NULL
  AND v.assigned_driver NOT LIKE '%/%'
  AND v.assigned_driver_id IS NULL;

-- Drop old text column
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS assigned_driver;

-- ─── 4. inspections: fix FKs + drop redundant columns ───────────────────────
ALTER TABLE public.inspections DROP CONSTRAINT IF EXISTS inspections_inspector_id_fkey;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_inspector_id_fkey
  FOREIGN KEY (inspector_id) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;

ALTER TABLE public.inspections DROP COLUMN IF EXISTS vehicle_reg;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS inspector_name;

-- ─── 5. costs: cast created_by → UUID if needed, then fix FK ─────────────────
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'costs' AND column_name = 'created_by') = 'text' THEN
    UPDATE public.costs SET created_by = NULL
    WHERE created_by IS NOT NULL
      AND (created_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR created_by::uuid NOT IN (SELECT id FROM public.enprotec_users));
    ALTER TABLE public.costs ALTER COLUMN created_by TYPE UUID USING created_by::uuid;
  ELSE
    -- Column already UUID — still NULL out orphaned references
    UPDATE public.costs SET created_by = NULL
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.enprotec_users);
  END IF;
  ALTER TABLE public.costs DROP CONSTRAINT IF EXISTS costs_created_by_fkey;
  ALTER TABLE public.costs
    ADD CONSTRAINT costs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;
END $$;

ALTER TABLE public.costs DROP COLUMN IF EXISTS vehicle_registration;

-- ─── 6. compliance_schedule: cast assigned_to → UUID, fix FK ─────────────────
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compliance_schedule' AND column_name = 'assigned_to') = 'text' THEN
    UPDATE public.compliance_schedule SET assigned_to = NULL
    WHERE assigned_to IS NOT NULL
      AND (assigned_to !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR assigned_to::uuid NOT IN (SELECT id FROM public.enprotec_users));
    ALTER TABLE public.compliance_schedule ALTER COLUMN assigned_to TYPE UUID USING assigned_to::uuid;
  ELSE
    UPDATE public.compliance_schedule SET assigned_to = NULL
    WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM public.enprotec_users);
  END IF;
  ALTER TABLE public.compliance_schedule DROP CONSTRAINT IF EXISTS compliance_schedule_assigned_to_fkey;
  ALTER TABLE public.compliance_schedule
    ADD CONSTRAINT compliance_schedule_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;
END $$;

ALTER TABLE public.compliance_schedule DROP COLUMN IF EXISTS vehicle_registration;

-- ─── 7. licenses: add driver_id FK + fix created_by ──────────────────────────
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS driver_id UUID
  REFERENCES public.enprotec_users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'created_by') = 'text' THEN
    UPDATE public.licenses SET created_by = NULL
    WHERE created_by IS NOT NULL
      AND (created_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR created_by::uuid NOT IN (SELECT id FROM public.enprotec_users));
    ALTER TABLE public.licenses ALTER COLUMN created_by TYPE UUID USING created_by::uuid;
  ELSE
    UPDATE public.licenses SET created_by = NULL
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.enprotec_users);
  END IF;
  ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_created_by_fkey;
  ALTER TABLE public.licenses
    ADD CONSTRAINT licenses_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;
END $$;

-- ─── 8. inspection_templates: fix created_by FK ──────────────────────────────
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inspection_templates' AND column_name = 'created_by') = 'text' THEN
    UPDATE public.inspection_templates SET created_by = NULL
    WHERE created_by IS NOT NULL
      AND (created_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR created_by::uuid NOT IN (SELECT id FROM public.enprotec_users));
    ALTER TABLE public.inspection_templates ALTER COLUMN created_by TYPE UUID USING created_by::uuid;
  ELSE
    UPDATE public.inspection_templates SET created_by = NULL
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.enprotec_users);
  END IF;
  ALTER TABLE public.inspection_templates DROP CONSTRAINT IF EXISTS inspection_templates_created_by_fkey;
  ALTER TABLE public.inspection_templates
    ADD CONSTRAINT inspection_templates_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;
END $$;

-- ─── 9. audit_log: fix user_id FK ────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'user_id') = 'text' THEN
    UPDATE public.audit_log SET user_id = NULL
    WHERE user_id IS NOT NULL
      AND (user_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           OR user_id::uuid NOT IN (SELECT id FROM public.enprotec_users));
    ALTER TABLE public.audit_log ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
  ELSE
    -- Column already UUID — NULL out any user_ids not present in enprotec_users
    UPDATE public.audit_log SET user_id = NULL
    WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.enprotec_users);
  END IF;
  ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
  ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.enprotec_users(id) ON DELETE SET NULL;
END $$;

-- ─── 10. RLS helper functions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_fleet_role()
RETURNS TEXT AS $$
  SELECT COALESCE(fleet_role, role::text) FROM public.enprotec_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(fleet_role, role::text) FROM public.enprotec_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 11. Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_en_users_fleet_role ON public.enprotec_users(fleet_role);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON public.vehicles(assigned_driver_id);
