-- Debug script for Paul Dlhamini's site visibility issue
-- Run this in Supabase SQL Editor

-- 1. Check Paul's user profile
SELECT
    id,
    name,
    email,
    role,
    sites,
    departments,
    status
FROM public.en_users
WHERE name ILIKE '%paul%' OR email ILIKE '%paul%' OR name ILIKE '%dlhamini%'
ORDER BY name;

-- 2. Check all workflows and their projectCode values
SELECT
    "requestNumber",
    "currentStatus",
    department,
    "projectCode",
    requester,
    "createdAt"
FROM public.en_workflows_view
ORDER BY "createdAt" DESC
LIMIT 30;

-- 3. Check unique projectCode values (case-sensitive)
SELECT DISTINCT "projectCode"
FROM public.en_workflows_view
ORDER BY "projectCode";

-- 4. Check if there are NULL or empty projectCode values
SELECT
    COUNT(*) as total_count,
    COUNT("projectCode") as non_null_count,
    COUNT(*) - COUNT("projectCode") as null_count
FROM public.en_workflows_view;

-- 5. Show workflows with NULL or empty projectCode
SELECT
    "requestNumber",
    "currentStatus",
    department,
    "projectCode",
    requester
FROM public.en_workflows_view
WHERE "projectCode" IS NULL OR "projectCode" = ''
LIMIT 20;
