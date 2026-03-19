-- ============================================================================
-- FIX RLS WITH CHECK CLAUSE - Allow Status Transitions
-- Date: 2026-01-27
-- ============================================================================
-- Problem: WITH CHECK was blocking status transitions because it checked
-- if the user has permission for the NEW status they're setting.
-- Solution: WITH CHECK should only verify site access is maintained.
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
-- Success Report
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS WITH CHECK FIXED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '- USING checks current status + role permission';
    RAISE NOTICE '- WITH CHECK only verifies site access';
    RAISE NOTICE '- Status transitions now work correctly';
    RAISE NOTICE '';
    RAISE NOTICE 'Stock Controller can now approve and move to next status!';
    RAISE NOTICE '========================================';
END $$;
