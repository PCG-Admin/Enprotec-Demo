-- ============================================================================
-- FIX WORKFLOW RLS POLICIES - Critical Fix for Approval Updates
-- ============================================================================
-- This script completely removes all RLS policies and recreates them
-- to ensure authenticated users can update workflow status
-- ============================================================================

-- Step 1: Drop ALL existing policies on enprotec_workflow_requests
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'enprotec_workflow_requests' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.enprotec_workflow_requests';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 2: Create fresh, permissive RLS policies for authenticated users
-- Allow SELECT
CREATE POLICY "authenticated_select_workflow_requests"
ON public.enprotec_workflow_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow INSERT
CREATE POLICY "authenticated_insert_workflow_requests"
ON public.enprotec_workflow_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow UPDATE (CRITICAL FOR APPROVALS)
CREATE POLICY "authenticated_update_workflow_requests"
ON public.enprotec_workflow_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow DELETE
CREATE POLICY "authenticated_delete_workflow_requests"
ON public.enprotec_workflow_requests
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Step 3: Ensure RLS is enabled on the table
ALTER TABLE public.enprotec_workflow_requests ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'enprotec_workflow_requests'
AND schemaname = 'public'
ORDER BY policyname;

-- Success message
SELECT '✅ Workflow RLS policies fixed - approvals should work now' as status;
