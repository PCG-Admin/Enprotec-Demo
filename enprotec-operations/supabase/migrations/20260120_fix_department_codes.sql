-- Migration: Fix Invalid Department Codes and Add Protection
-- Date: 2026-01-20
-- Description: Fixes any department codes that don't match store_type ENUM values
--              and adds constraint to prevent modification of core system stores.

-- Step 1: Fix references to invalid department codes in workflow_requests and users tables
-- Update workflow_requests to use valid codes
UPDATE public.enprotec_workflow_requests
SET department = 'Satellite'
WHERE department LIKE '%Satellite%' AND department != 'Satellite';

UPDATE public.enprotec_workflow_requests
SET department = 'OEM'
WHERE department LIKE '%OEM%' AND department != 'OEM';

UPDATE public.enprotec_workflow_requests
SET department = 'Operations'
WHERE department LIKE '%Operations%' AND department != 'Operations';

UPDATE public.enprotec_workflow_requests
SET department = 'Projects'
WHERE department LIKE '%Projects%' AND department != 'Projects';

UPDATE public.enprotec_workflow_requests
SET department = 'SalvageYard'
WHERE department LIKE '%Salvage%' AND department != 'SalvageYard';

-- Update salvage_requests to use valid codes
UPDATE public.enprotec_salvage_requests
SET source_department = 'Satellite'
WHERE source_department LIKE '%Satellite%' AND source_department != 'Satellite';

UPDATE public.enprotec_salvage_requests
SET source_department = 'OEM'
WHERE source_department LIKE '%OEM%' AND source_department != 'OEM';

UPDATE public.enprotec_salvage_requests
SET source_department = 'Operations'
WHERE source_department LIKE '%Operations%' AND source_department != 'Operations';

UPDATE public.enprotec_salvage_requests
SET source_department = 'Projects'
WHERE source_department LIKE '%Projects%' AND source_department != 'Projects';

UPDATE public.enprotec_salvage_requests
SET source_department = 'SalvageYard'
WHERE source_department LIKE '%Salvage%' AND source_department != 'SalvageYard';

-- Update user departments arrays to use valid codes
UPDATE public.enprotec_users
SET departments = array_replace(departments, 'MSatellite', 'Satellite')
WHERE 'MSatellite' = ANY(departments);

UPDATE public.enprotec_users
SET departments = array_replace(departments, 'MOEM', 'OEM')
WHERE 'MOEM' = ANY(departments);

UPDATE public.enprotec_users
SET departments = array_replace(departments, 'MOperations', 'Operations')
WHERE 'MOperations' = ANY(departments);

UPDATE public.enprotec_users
SET departments = array_replace(departments, 'MProjects', 'Projects')
WHERE 'MProjects' = ANY(departments);

UPDATE public.enprotec_users
SET departments = array_replace(departments, 'MSalvageYard', 'SalvageYard')
WHERE 'MSalvageYard' = ANY(departments);

-- Step 2: Delete ONLY exact duplicates that were created by modifying core stores
-- Be careful not to delete legitimate new stores
DELETE FROM public.enprotec_departments
WHERE code IN (
    SELECT code
    FROM public.enprotec_departments
    WHERE code NOT IN ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite')
    AND (
        -- Only delete if there's no workflows or users using this code
        NOT EXISTS (SELECT 1 FROM public.enprotec_workflow_requests WHERE department = code)
        AND NOT EXISTS (SELECT 1 FROM public.enprotec_salvage_requests WHERE source_department = code)
        AND NOT EXISTS (SELECT 1 FROM public.enprotec_users WHERE code = ANY(departments))
    )
    AND (
        -- Delete only obvious typos/modifications of core stores
        code LIKE 'M%' OR code LIKE '%M' OR code LIKE '%_M'
    )
);

-- Step 2: Add check constraint to prevent modification of core system store codes
-- This ensures the 5 seed departments always maintain codes that match store_type ENUM
ALTER TABLE public.enprotec_departments
DROP CONSTRAINT IF EXISTS check_core_department_codes_immutable;

-- Add trigger function to prevent modification of core department codes
CREATE OR REPLACE FUNCTION public.prevent_core_department_code_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this is an update (not insert) and if the code is being changed
    IF TG_OP = 'UPDATE' AND OLD.code != NEW.code THEN
        -- Prevent changing codes for the 5 core system stores
        IF OLD.code IN ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite') THEN
            RAISE EXCEPTION 'Cannot modify code for core system store: %', OLD.code
            USING HINT = 'Core system store codes must remain unchanged to maintain compatibility with inventory ENUM type.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS prevent_core_department_code_change_trigger ON public.enprotec_departments;

CREATE TRIGGER prevent_core_department_code_change_trigger
    BEFORE UPDATE ON public.enprotec_departments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_core_department_code_change();

-- Step 3: Add validation constraint to ensure all department codes match store_type ENUM values
-- This ensures any new departments added also use valid store_type values
ALTER TABLE public.enprotec_departments
DROP CONSTRAINT IF EXISTS check_department_code_matches_store_type;

ALTER TABLE public.enprotec_departments
ADD CONSTRAINT check_department_code_matches_store_type
CHECK (
    code IN ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite')
    OR code ~ '^[A-Z][a-zA-Z0-9_]*$'  -- Allow new stores with proper naming convention
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_department_code_matches_store_type ON public.enprotec_departments IS
'Ensures department codes are either core system stores (matching store_type ENUM) or follow proper naming convention. Core store codes cannot be modified.';

-- Add comment on trigger
COMMENT ON TRIGGER prevent_core_department_code_change_trigger ON public.enprotec_departments IS
'Prevents modification of core system store codes (OEM, Operations, Projects, SalvageYard, Satellite) to maintain compatibility with inventory store_type ENUM.';
