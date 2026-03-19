-- ============================================================================
-- FIX RLS POLICIES - Use Correct Status Names from Frontend Enum
-- Date: 2026-01-27
-- ============================================================================
-- The frontend uses different status names than the previous migration
-- This migration updates the policies to match the actual enum values
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "site_based_select_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "site_based_insert_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "role_site_based_update_workflow_requests" ON public.enprotec_workflow_requests;
DROP POLICY IF EXISTS "admin_only_delete_workflow_requests" ON public.enprotec_workflow_requests;

-- ============================================================================
-- SELECT: Users can see workflows for sites they're assigned to
-- ============================================================================
CREATE POLICY "site_based_select_workflow_requests"
ON public.enprotec_workflow_requests
FOR SELECT
USING (
    -- Admin can see everything
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
    OR
    -- User can see if workflow's site name is in their sites array
    (
        EXISTS (
            SELECT 1
            FROM public.enprotec_users u
            JOIN public.enprotec_sites s ON s.id = enprotec_workflow_requests.site_id
            WHERE u.id = auth.uid()
            AND s.name = ANY(u.sites)
        )
    )
    OR
    -- User is the requester
    requester_id = auth.uid()
);

-- ============================================================================
-- INSERT: Users can create workflows for sites they're assigned to
-- ============================================================================
CREATE POLICY "site_based_insert_workflow_requests"
ON public.enprotec_workflow_requests
FOR INSERT
WITH CHECK (
    -- Admin can create for any site
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
    OR
    -- User can create if workflow's site name is in their sites array
    (
        EXISTS (
            SELECT 1
            FROM public.enprotec_users u
            JOIN public.enprotec_sites s ON s.id = enprotec_workflow_requests.site_id
            WHERE u.id = auth.uid()
            AND s.name = ANY(u.sites)
        )
    )
);

-- ============================================================================
-- UPDATE: STRICT role-based checks for approvals
-- IMPORTANT: Using correct status names from frontend enum
-- ============================================================================
CREATE POLICY "role_site_based_update_workflow_requests"
ON public.enprotec_workflow_requests
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.enprotec_users u
        LEFT JOIN public.enprotec_sites s ON s.id = enprotec_workflow_requests.site_id
        WHERE u.id = auth.uid()
        AND (
            -- Admin can update everything
            u.role = 'Admin'
            OR
            -- User must have site access AND appropriate role
            (
                -- Check site access (site name in user's sites array)
                s.name = ANY(u.sites)
                AND
                -- Check role matches workflow status
                (
                    (enprotec_workflow_requests.current_status = 'Request Submitted' AND u.role = 'Operations Manager')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Stock Controller' AND u.role = 'Stock Controller')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Equip. Manager' AND u.role = 'Equipment Manager')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Picking' AND u.role IN ('Stock Controller', 'Storeman'))
                    OR
                    (enprotec_workflow_requests.current_status = 'Picked & Loaded' AND u.role IN ('Security', 'Driver'))
                    OR
                    (enprotec_workflow_requests.current_status = 'Dispatched' AND u.role IN ('Driver', 'Site Manager'))
                    OR
                    -- Requester can always update their own request
                    enprotec_workflow_requests.requester_id = auth.uid()
                )
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.enprotec_users u
        LEFT JOIN public.enprotec_sites s ON s.id = enprotec_workflow_requests.site_id
        WHERE u.id = auth.uid()
        AND (
            u.role = 'Admin'
            OR
            (
                s.name = ANY(u.sites)
                AND
                (
                    (enprotec_workflow_requests.current_status = 'Request Submitted' AND u.role = 'Operations Manager')
                    OR
                    (enprotec_workflow_requests.current_status = 'Awaiting Stock Controller' AND u.role = 'Stock Controller')
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

-- ============================================================================
-- DELETE: Only admins can delete
-- ============================================================================
CREATE POLICY "admin_only_delete_workflow_requests"
ON public.enprotec_workflow_requests
FOR DELETE
USING (
    (SELECT role FROM public.enprotec_users WHERE id = auth.uid()) = 'Admin'
);

-- ============================================================================
-- Update Helper Function
-- ============================================================================
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
    v_site_name TEXT;
BEGIN
    -- Get workflow details
    SELECT wr.*, s.name AS site_name
    INTO v_workflow
    FROM public.enprotec_workflow_requests wr
    LEFT JOIN public.enprotec_sites s ON wr.site_id = s.id
    WHERE wr.id = p_workflow_id;

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

    -- Check site access (site name in user's sites array)
    IF NOT (v_workflow.site_name = ANY(v_user.sites)) THEN
        RETURN FALSE;
    END IF;

    -- Check role matches workflow status (using correct status names)
    RETURN (
        (v_workflow.current_status = 'Request Submitted' AND v_user.role = 'Operations Manager')
        OR
        (v_workflow.current_status = 'Awaiting Stock Controller' AND v_user.role = 'Stock Controller')
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

-- ============================================================================
-- Success Report
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS POLICIES UPDATED WITH CORRECT STATUS NAMES';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '- Changed "Awaiting Ops Manager" to "Awaiting Stock Controller"';
    RAISE NOTICE '- Status names now match frontend enum values';
    RAISE NOTICE '- Stock Controller approvals will now work correctly';
    RAISE NOTICE '';
    RAISE NOTICE 'Status → Role mapping:';
    RAISE NOTICE '- "Request Submitted" → Operations Manager';
    RAISE NOTICE '- "Awaiting Stock Controller" → Stock Controller';
    RAISE NOTICE '- "Awaiting Equip. Manager" → Equipment Manager';
    RAISE NOTICE '- "Awaiting Picking" → Stock Controller/Storeman';
    RAISE NOTICE '- "Picked & Loaded" → Security/Driver';
    RAISE NOTICE '- "Dispatched" → Driver/Site Manager';
    RAISE NOTICE '========================================';
END $$;
