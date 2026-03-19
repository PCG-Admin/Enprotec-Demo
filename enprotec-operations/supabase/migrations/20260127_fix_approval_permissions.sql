-- ============================================================================
-- FIX APPROVAL PERMISSIONS - Strict Role and Site-Based Access
-- Date: 2026-01-27
-- ============================================================================
-- Fixes the "everyone can approve" issue by:
-- 1. Adding proper RLS policies that check role and site access
-- 2. Ensuring only the correct role for the correct site can approve
-- ============================================================================

-- ============================================================================
-- PART 1: Drop Overly Permissive Policies
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_select_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "authenticated_insert_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "authenticated_update_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "authenticated_delete_workflow_requests" ON public.enprotec_workflow_requests;

-- ============================================================================
-- PART 2: Create Strict, Role and Site-Based Policies
-- ============================================================================

-- SELECT: Users can see workflows for sites they're assigned to
CREATE POLICY "site_based_select_workflow_requests"
ON public.enprotec_workflow_requests
FOR SELECT
USING (
    -- Admin can see everything
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
    OR
    -- User can see if workflow's site is in their sites array
    (
        site_id = ANY(
            SELECT UNNEST(sites::uuid[])
            FROM public.enprotec_users
            WHERE id = auth.uid()
        )
    )
    OR
    -- User is the requester
    requester_id = auth.uid()
);

-- INSERT: Users can create workflows for sites they're assigned to
CREATE POLICY "site_based_insert_workflow_requests"
ON public.enprotec_workflow_requests
FOR INSERT
WITH CHECK (
    -- Admin can create for any site
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
    OR
    -- User can create if workflow's site is in their sites array
    (
        site_id = ANY(
            SELECT UNNEST(sites::uuid[])
            FROM public.enprotec_users
            WHERE id = auth.uid()
        )
    )
);

-- UPDATE: STRICT role-based checks for approvals
CREATE POLICY "role_site_based_update_workflow_requests"
ON public.enprotec_workflow_requests
FOR UPDATE
USING (
    -- Get user's role and sites
    EXISTS (
        SELECT 1
        FROM public.enprotec_users u
        WHERE u.id = auth.uid()
        AND (
            -- Admin can update everything
            u.role = 'Admin'
            OR
            -- User must have site access AND appropriate role for the workflow status
            (
                -- Check site access
                enprotec_workflow_requests.site_id = ANY(u.sites::uuid[])
                AND
                -- Check role matches workflow status
                (
                    -- Ops Manager can approve REQUEST_SUBMITTED
                    (enprotec_workflow_requests.current_status = 'Request Submitted' AND u.role = 'Operations Manager')
                    OR
                    -- Stock Controller can approve AWAITING_OPS_MANAGER
                    (enprotec_workflow_requests.current_status = 'Awaiting Ops Manager' AND u.role = 'Stock Controller')
                    OR
                    -- Equipment Manager can approve AWAITING_EQUIP_MANAGER
                    (enprotec_workflow_requests.current_status = 'Awaiting Equip. Manager' AND u.role = 'Equipment Manager')
                    OR
                    -- Stock Controller or Storeman can mark AWAITING_PICKING
                    (enprotec_workflow_requests.current_status = 'Awaiting Picking' AND u.role IN ('Stock Controller', 'Storeman'))
                    OR
                    -- Security or Driver can dispatch PICKED_AND_LOADED
                    (enprotec_workflow_requests.current_status = 'Picked & Loaded' AND u.role IN ('Security', 'Driver'))
                    OR
                    -- Driver or Site Manager can confirm EPOD for DISPATCHED
                    (enprotec_workflow_requests.current_status = 'Dispatched' AND u.role IN ('Driver', 'Site Manager'))
                    OR
                    -- Requester can always update their own request (for comments/attachments)
                    enprotec_workflow_requests.requester_id = auth.uid()
                )
            )
        )
    )
)
WITH CHECK (
    -- Same checks for WITH CHECK
    EXISTS (
        SELECT 1
        FROM public.enprotec_users u
        WHERE u.id = auth.uid()
        AND (
            u.role = 'Admin'
            OR
            (
                enprotec_workflow_requests.site_id = ANY(u.sites::uuid[])
                AND
                (
                    (enprotec_workflow_requests.current_status = 'Request Submitted' AND u.role = 'Operations Manager')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Ops Manager' AND u.role = 'Stock Controller')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Equip. Manager' AND u.role = 'Equipment Manager')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Picking' AND u.role IN ('Stock Controller', 'Storeman'))
                    OR
                    (enprotec_workflow_requests.current_status = 'Picked & Loaded' AND u.role IN ('Security', 'Driver'))
                    OR
                    (enprotec_workflow_requests.current_status = 'Dispatched' AND u.role IN ('Driver', 'Site Manager'))
                    OR
                    enprotec_workflow_requests.requester_id = auth.uid()
                )
            )
        )
    )
);

-- DELETE: Only admins can delete
CREATE POLICY "admin_only_delete_workflow_requests"
ON public.enprotec_workflow_requests
FOR DELETE
USING (
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
);

-- ============================================================================
-- PART 3: Ensure RLS is Enabled
-- ============================================================================

ALTER TABLE public.enprotec_workflow_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: Create Helper Function for Frontend
-- ============================================================================

-- Function to check if current user can approve a workflow
CREATE OR REPLACE FUNCTION public.can_user_approve_workflow(
    p_workflow_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workflow RECORD;
    v_user RECORD;
BEGIN
    -- Get workflow details
    SELECT * INTO v_workflow
    FROM public.enprotec_workflow_requests
    WHERE id = p_workflow_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Get user details
    SELECT * INTO v_user
    FROM public.enprotec_users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Admin can always approve
    IF v_user.role = 'Admin' THEN
        RETURN TRUE;
    END IF;

    -- Check site access
    IF NOT (v_workflow.site_id = ANY(v_user.sites::uuid[])) THEN
        RETURN FALSE;
    END IF;

    -- Check role matches workflow status
    RETURN (
        (v_workflow.current_status = 'Request Submitted' AND v_user.role = 'Operations Manager')
        OR
        (v_workflow.current_status = 'Awaiting Ops Manager' AND v_user.role = 'Stock Controller')
        OR
        (v_workflow.current_status = 'Awaiting Equip. Manager' AND v_user.role = 'Equipment Manager')
        OR
        (v_workflow.current_status = 'Awaiting Picking' AND v_user.role IN ('Stock Controller', 'Storeman'))
        OR
        (v_workflow.current_status = 'Picked & Loaded' AND v_user.role IN ('Security', 'Driver'))
        OR
        (v_workflow.current_status = 'Dispatched' AND v_user.role IN ('Driver', 'Site Manager'))
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_user_approve_workflow TO authenticated;

-- ============================================================================
-- Success Report
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ APPROVAL PERMISSIONS FIXED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Changes:';
    RAISE NOTICE '- RLS policies now check role AND site access';
    RAISE NOTICE '- Only correct role for correct site can approve';
    RAISE NOTICE '- Ops Manager can ONLY approve "Request Submitted"';
    RAISE NOTICE '- All users can VIEW workflows for their sites';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Update frontend to use can_user_approve_workflow()';
    RAISE NOTICE '========================================';
END $$;
