-- ============================================
-- PCG DEMO: PART 4 - Fleet Schema
-- Run AFTER Parts 1, 2, 3 complete
-- Creates all fleet tables + fixes FKs to use enprotec_users/enprotec_sites
-- ============================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enum Types ───────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE vehicle_status    AS ENUM ('Active', 'In Maintenance', 'Inactive', 'Decommissioned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE license_category  AS ENUM ('Vehicle', 'Driver');                                       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cost_category     AS ENUM ('Fuel', 'Maintenance', 'Tyres', 'Insurance', 'Licensing', 'Other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE compliance_status AS ENUM ('Overdue', 'Due Soon', 'Scheduled', 'Completed');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE inspection_result AS ENUM ('pass', 'fail', 'requires_attention', 'in_progress');       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE inspection_freq   AS ENUM ('daily', 'weekly', 'monthly', 'custom');                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── fleet_role column on enprotec_users ──────────────────────────────────────
ALTER TABLE public.enprotec_users ADD COLUMN IF NOT EXISTS fleet_role TEXT NULL;

-- ─── Profiles table (required by schema + trigger, even though RLS uses enprotec_users) ──
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL DEFAULT 'Driver',
    status     TEXT NOT NULL DEFAULT 'Active',
    fleet_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Fleet-specific sites table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    location   TEXT NOT NULL DEFAULT '',
    contact    TEXT,
    status     TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vehicles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicles (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    registration         TEXT           NOT NULL UNIQUE,
    make                 TEXT           NOT NULL DEFAULT '',
    model                TEXT           NOT NULL DEFAULT '',
    vehicle_type         TEXT           NOT NULL DEFAULT '',
    year                 INTEGER,
    vin                  TEXT,
    serial_number        TEXT,
    fuel_type            TEXT           DEFAULT 'Diesel',
    current_hours        NUMERIC(10,1)  DEFAULT 0,
    current_mileage      NUMERIC(10,0)  DEFAULT 0,
    site_id              UUID           REFERENCES public.enprotec_sites(id) ON DELETE SET NULL,
    assigned_driver_id   UUID           REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    purchase_date        DATE,
    acquisition_cost     NUMERIC(12,2),
    last_inspection_date DATE,
    next_inspection_date DATE,
    status               vehicle_status NOT NULL DEFAULT 'Active',
    photo_url            TEXT,
    notes                TEXT,
    created_at           TIMESTAMPTZ    DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    DEFAULT NOW()
);

-- ─── Inspection Templates ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_templates (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT            NOT NULL,
    description TEXT            DEFAULT '',
    frequency   inspection_freq NOT NULL DEFAULT 'daily',
    questions   JSONB           NOT NULL DEFAULT '[]'::JSONB,
    active      BOOLEAN         NOT NULL DEFAULT TRUE,
    last_used   DATE,
    created_by  UUID            REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- ─── Inspections ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspections (
    id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID              REFERENCES public.inspection_templates(id) ON DELETE SET NULL,
    vehicle_id      UUID              NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    inspector_id    UUID              REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    inspection_type TEXT              NOT NULL DEFAULT 'Pre-Trip',
    started_at      TIMESTAMPTZ       DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    status          inspection_result NOT NULL DEFAULT 'in_progress',
    answers         JSONB             NOT NULL DEFAULT '{}'::JSONB,
    notes           TEXT,
    odometer        NUMERIC(10,0),
    hour_meter      NUMERIC(10,1),
    signature_url   TEXT,
    created_at      TIMESTAMPTZ       DEFAULT NOW(),
    updated_at      TIMESTAMPTZ       DEFAULT NOW()
);

-- ─── Licenses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.licenses (
    id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    category           license_category NOT NULL DEFAULT 'Vehicle',
    vehicle_id         UUID             REFERENCES public.vehicles(id) ON DELETE CASCADE,
    driver_id          UUID             REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    driver_name        TEXT,
    driver_employee_id TEXT,
    license_type       TEXT             NOT NULL,
    license_number     TEXT             NOT NULL,
    issue_date         DATE             NOT NULL,
    expiry_date        DATE             NOT NULL,
    notes              TEXT,
    document_url       TEXT,
    created_by         UUID             REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ      DEFAULT NOW(),
    updated_at         TIMESTAMPTZ      DEFAULT NOW()
);

-- ─── Costs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.costs (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id     UUID          NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    date           DATE          NOT NULL DEFAULT CURRENT_DATE,
    category       cost_category NOT NULL DEFAULT 'Other',
    amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    description    TEXT          NOT NULL DEFAULT '',
    supplier       TEXT,
    invoice_number TEXT,
    rto_number     TEXT,
    po_number      TEXT,
    quote_number   TEXT,
    km_reading     TEXT,
    receipt_url    TEXT,
    created_by     UUID          REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ   DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── Compliance Schedule ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_schedule (
    id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id       UUID              NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    inspection_type  TEXT              NOT NULL DEFAULT 'Annual Inspection',
    due_date         DATE              NOT NULL,
    scheduled_date   DATE,
    completed_date   DATE,
    status           compliance_status NOT NULL DEFAULT 'Scheduled',
    notes            TEXT,
    assigned_to      UUID              REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ       DEFAULT NOW(),
    updated_at       TIMESTAMPTZ       DEFAULT NOW()
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES public.enprotec_users(id) ON DELETE SET NULL,
    user_name  TEXT        NOT NULL DEFAULT '',
    action     TEXT        NOT NULL,
    module     TEXT        NOT NULL,
    details    TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at    ON public.profiles;
DROP TRIGGER IF EXISTS trg_vehicles_updated_at     ON public.vehicles;
DROP TRIGGER IF EXISTS trg_templates_updated_at    ON public.inspection_templates;
DROP TRIGGER IF EXISTS trg_inspections_updated_at  ON public.inspections;
DROP TRIGGER IF EXISTS trg_licenses_updated_at     ON public.licenses;
DROP TRIGGER IF EXISTS trg_costs_updated_at        ON public.costs;
DROP TRIGGER IF EXISTS trg_compliance_updated_at   ON public.compliance_schedule;

CREATE TRIGGER trg_profiles_updated_at    BEFORE UPDATE ON public.profiles            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated_at    BEFORE UPDATE ON public.vehicles             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated_at   BEFORE UPDATE ON public.inspection_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inspections_updated_at BEFORE UPDATE ON public.inspections          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_licenses_updated_at    BEFORE UPDATE ON public.licenses             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_costs_updated_at       BEFORE UPDATE ON public.costs                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_compliance_updated_at  BEFORE UPDATE ON public.compliance_schedule  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS helper: reads fleet_role from enprotec_users (falls back to role) ────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT COALESCE(fleet_role, role::text) FROM public.enprotec_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_fleet_role()
RETURNS TEXT AS $$
    SELECT COALESCE(fleet_role, role::text) FROM public.enprotec_users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Backfill profiles for already-created auth users ─────────────────────────
INSERT INTO public.profiles (id, name, email, role, status)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    COALESCE(u.email, ''),
    'Driver',
    'Active'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('profiles','vehicles','inspection_templates','inspections','licenses','costs','compliance_schedule','audit_log')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- SELECT: all authenticated users can read
CREATE POLICY "auth_select_profiles"    ON public.profiles             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_vehicles"    ON public.vehicles             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_templates"   ON public.inspection_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_inspections" ON public.inspections          FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_licenses"    ON public.licenses             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_costs"       ON public.costs                FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_compliance"  ON public.compliance_schedule  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select_audit"       ON public.audit_log            FOR SELECT TO authenticated USING (true);

-- Vehicles: Admin / Fleet Coordinator can write
CREATE POLICY "fc_insert_vehicles"    ON public.vehicles FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "fc_update_vehicles"    ON public.vehicles FOR UPDATE TO authenticated USING    (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "admin_delete_vehicles" ON public.vehicles FOR DELETE TO authenticated USING    (get_user_role() = 'Admin');

-- Templates: Admin only
CREATE POLICY "admin_insert_templates" ON public.inspection_templates FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'Admin');
CREATE POLICY "admin_update_templates" ON public.inspection_templates FOR UPDATE TO authenticated USING    (get_user_role() = 'Admin');
CREATE POLICY "admin_delete_templates" ON public.inspection_templates FOR DELETE TO authenticated USING    (get_user_role() = 'Admin');

-- Inspections: everyone can create; own or FC/Admin can update
CREATE POLICY "auth_insert_inspections"  ON public.inspections FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_inspections"  ON public.inspections FOR UPDATE TO authenticated USING (inspector_id = auth.uid() OR get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "admin_delete_inspections" ON public.inspections FOR DELETE TO authenticated USING (get_user_role() = 'Admin');

-- Licenses, Costs, Compliance: FC/Admin write
CREATE POLICY "fc_insert_licenses"    ON public.licenses             FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "fc_update_licenses"    ON public.licenses             FOR UPDATE TO authenticated USING    (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "admin_delete_licenses" ON public.licenses             FOR DELETE TO authenticated USING    (get_user_role() = 'Admin');
CREATE POLICY "fc_insert_costs"       ON public.costs                FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "fc_update_costs"       ON public.costs                FOR UPDATE TO authenticated USING    (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "admin_delete_costs"    ON public.costs                FOR DELETE TO authenticated USING    (get_user_role() = 'Admin');
CREATE POLICY "fc_insert_compliance"  ON public.compliance_schedule  FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "fc_update_compliance"  ON public.compliance_schedule  FOR UPDATE TO authenticated USING    (get_user_role() IN ('Admin', 'Fleet Coordinator'));
CREATE POLICY "admin_delete_compliance" ON public.compliance_schedule FOR DELETE TO authenticated USING   (get_user_role() = 'Admin');

-- Profiles: admin or own
CREATE POLICY "admin_update_profiles" ON public.profiles FOR UPDATE TO authenticated USING (get_user_role() = 'Admin' OR id = auth.uid());

-- Audit log: any authenticated user can insert
CREATE POLICY "auth_insert_audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_registration  ON public.vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_status        ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_site          ON public.vehicles(site_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver        ON public.vehicles(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_inspections_vehicle    ON public.inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector  ON public.inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status     ON public.inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_started    ON public.inspections(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_licenses_vehicle       ON public.licenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry        ON public.licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_costs_vehicle          ON public.costs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_costs_date             ON public.costs(date DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_vehicle     ON public.compliance_schedule(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_compliance_due_date    ON public.compliance_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_en_users_fleet_role    ON public.enprotec_users(fleet_role);

-- ─── Storage buckets (run separately in Supabase dashboard if needed) ─────────
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos',  'vehicle-photos',  true)  ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('license-docs',    'license-docs',    false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('cost-receipts',   'cost-receipts',   false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-sigs', 'inspection-sigs', false) ON CONFLICT DO NOTHING;

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT 'vehicles' AS table_name, COUNT(*) FROM public.vehicles
UNION ALL SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL SELECT 'inspection_templates', COUNT(*) FROM public.inspection_templates;
