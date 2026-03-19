-- Enhanced debug script to diagnose Operations Manager visibility issue
-- Run this in Supabase SQL Editor

-- ============================================================
-- PART 1: Check the Operations Manager user profile
-- ============================================================
SELECT
    id,
    name,
    email,
    role,
    sites,
    departments,
    status
FROM public.en_users
WHERE role = 'Operations Manager'
ORDER BY name;

-- ============================================================
-- PART 2: Check all workflows with pending statuses
-- ============================================================
SELECT
    id,
    request_number,
    current_status,
    department,
    site_id,
    en_sites.name as site_name
FROM public.en_workflow_requests
LEFT JOIN public.en_sites ON en_workflow_requests.site_id = en_sites.id
WHERE current_status IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- PART 3: Check what the en_workflows_view returns
-- (This is what Dashboard and Requests page actually query)
-- ============================================================
SELECT
    id,
    "requestNumber",
    "currentStatus",
    department,
    "projectCode"
FROM public.en_workflows_view
WHERE "currentStatus" IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY "createdAt" DESC
LIMIT 20;

-- ============================================================
-- PART 4: Check ALL unique site names (projectCode) in workflows
-- ============================================================
SELECT DISTINCT "projectCode"
FROM public.en_workflows_view
WHERE "currentStatus" IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY "projectCode";

-- ============================================================
-- PART 5: Check ALL unique departments in workflows
-- ============================================================
SELECT DISTINCT department
FROM public.en_workflows_view
WHERE "currentStatus" IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY department;

-- ============================================================
-- PART 6: Find workflows that MATCH the departments but NOT the sites
-- Replace 'user_sites_array' and 'user_departments_array' with actual values from PART 1
-- ============================================================
-- Example: If Operations Manager has:
--   sites = ["Site A", "Site B"]
--   departments = ["Operations"]
-- Then run:
--
-- SELECT
--     id,
--     "requestNumber",
--     "currentStatus",
--     department,
--     "projectCode",
--     CASE
--         WHEN "projectCode" = ANY(ARRAY['Site A', 'Site B']) THEN 'SITE MATCH'
--         ELSE 'SITE MISMATCH'
--     END as site_check,
--     CASE
--         WHEN department = ANY(ARRAY['Operations']) THEN 'DEPT MATCH'
--         ELSE 'DEPT MISMATCH'
--     END as dept_check
-- FROM public.en_workflows_view
-- WHERE "currentStatus" IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
-- ORDER BY "createdAt" DESC;

-- ============================================================
-- PART 7: Check if there are any NULL or empty projectCode values
-- ============================================================
SELECT
    id,
    "requestNumber",
    "currentStatus",
    department,
    "projectCode",
    CASE
        WHEN "projectCode" IS NULL THEN 'NULL'
        WHEN "projectCode" = '' THEN 'EMPTY STRING'
        ELSE 'HAS VALUE'
    END as projectCode_status
FROM public.en_workflows_view
WHERE "currentStatus" IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY "createdAt" DESC;
