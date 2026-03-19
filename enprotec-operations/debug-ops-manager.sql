-- Debug script to check Operations Manager user and workflows
-- Run this in Supabase SQL Editor

-- 1. Check the Operations Manager user details
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

-- 2. Check what workflows exist and their sites
SELECT
    id,
    request_number,
    current_status,
    department,
    en_sites.name as site_name
FROM public.en_workflow_requests
JOIN public.en_sites ON en_workflow_requests.site_id = en_sites.id
WHERE current_status IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if site names match (case-sensitive check)
SELECT DISTINCT en_sites.name as site_name
FROM public.en_workflow_requests
JOIN public.en_sites ON en_workflow_requests.site_id = en_sites.id
WHERE current_status IN ('Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery')
ORDER BY site_name;

-- 4. Check what the en_workflows_view returns
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
