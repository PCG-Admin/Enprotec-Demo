-- =============================================================
--  Rename fleet tables to add enprotec_ prefix
--  Run once in Supabase SQL Editor
-- =============================================================

ALTER TABLE IF EXISTS public.vehicles             RENAME TO enprotec_vehicles;
ALTER TABLE IF EXISTS public.inspection_templates RENAME TO enprotec_inspection_templates;
ALTER TABLE IF EXISTS public.inspections          RENAME TO enprotec_inspections;
ALTER TABLE IF EXISTS public.licenses             RENAME TO enprotec_licenses;
ALTER TABLE IF EXISTS public.costs                RENAME TO enprotec_costs;
ALTER TABLE IF EXISTS public.compliance_schedule  RENAME TO enprotec_compliance_schedule;
ALTER TABLE IF EXISTS public.audit_log            RENAME TO enprotec_audit_log;
