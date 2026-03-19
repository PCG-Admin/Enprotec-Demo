-- ============================================================================
-- FIX EPOD STEP - Only Original Requester Can Confirm
-- Date: 2026-01-27
-- ============================================================================
-- Problem: Drivers were able to confirm EPOD (final delivery confirmation)
-- Solution: Only the original requester should be able to confirm/decline EPOD
-- ============================================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "role_site_based_update_workflow_requests" ON public.enprotec_workflow_requests;

-- ============================================================================
-- UPDATE: STRICT role-based checks for approvals
-- USING: Check if user can EDIT based on current status
-- WITH CHECK: Only verify site access is maintained (not new status)
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
            -- User must have site access AND appropriate role for CURRENT status
            (
                -- Check site access (site name in user's sites array)
                s.name = ANY(u.sites)
                AND
                -- Check role matches CURRENT workflow status
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
                    -- CRITICAL FIX: Only requester can confirm EPOD at Dispatched status
                    (enprotec_workflow_requests.current_status = 'Dispatched' AND enprotec_workflow_requests.requester_id = auth.uid())
                )
            )
            OR
            -- Requester can always update their own request (comments, attachments, etc.)
            enprotec_workflow_requests.requester_id = auth.uid()
        )
    )
)
WITH CHECK (
    -- Only verify site access is maintained in the update
    -- Don't check the new status - that's already validated by USING clause
    EXISTS (
        SELECT 1
        FROM public.enprotec_users u
        LEFT JOIN public.enprotec_sites s ON s.id = enprotec_workflow_requests.site_id
        WHERE u.id = auth.uid()
        AND (
            u.role = 'Admin'
            OR
            s.name = ANY(u.sites)
            OR
            enprotec_workflow_requests.requester_id = auth.uid()
        )
    )
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
        -- CRITICAL: Only requester can confirm EPOD
        (v_workflow.current_status = 'Dispatched' AND v_workflow.requester_id = p_user_id)
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
    RAISE NOTICE '✅ EPOD STEP FIXED - REQUESTER ONLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '- "Dispatched" status can only be approved by original requester';
    RAISE NOTICE '- Drivers can no longer confirm EPOD';
    RAISE NOTICE '- Only requester can accept/decline final delivery';
    RAISE NOTICE '';
    RAISE NOTICE 'Updated approval flow:';
    RAISE NOTICE '- Picked & Loaded → Security/Driver dispatch';
    RAISE NOTICE '- Dispatched → REQUESTER ONLY confirms EPOD';
    RAISE NOTICE '========================================';
END $$;
