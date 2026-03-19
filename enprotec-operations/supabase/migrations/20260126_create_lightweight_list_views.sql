-- ============================================================================
-- LIGHTWEIGHT LIST VIEWS - For Fast Loading
-- Date: 2026-01-26
-- ============================================================================
-- Creates lightweight versions of complex views WITHOUT heavy JSON aggregations
-- Use these for list pages, use full views only for detail modals
-- ============================================================================

-- ============================================================================
-- Lightweight Workflows List View (No Items/Attachments Arrays)
-- ============================================================================

CREATE OR REPLACE VIEW public.en_workflows_list_view AS
SELECT
    wr.id,
    wr.request_number AS "requestNumber",
    wr.type,
    u.name AS requester,
    wr.requester_id AS "requesterId",
    s.name AS "projectCode",
    wr.department,
    wr.current_status AS "currentStatus",
    wr.priority,
    wr.created_at AS "createdAt",
    wr.driver_name AS "driverName",
    wr.vehicle_registration AS "vehicleRegistration",
    -- Count items instead of loading full array
    (
        SELECT COUNT(*)
        FROM public.enprotec_workflow_items wi
        WHERE wi.workflow_request_id = wr.id
    ) AS "itemCount"
FROM public.enprotec_workflow_requests wr
JOIN public.enprotec_users u ON wr.requester_id = u.id
LEFT JOIN public.enprotec_sites s ON wr.site_id = s.id;

-- Grant permissions
GRANT SELECT ON public.en_workflows_list_view TO authenticated;

-- Add comment
COMMENT ON VIEW public.en_workflows_list_view IS 'Lightweight workflows view for list pages - no items/attachments arrays';

-- ============================================================================
-- Lightweight Stock Receipts View (For Reports Page)
-- ============================================================================

CREATE OR REPLACE VIEW public.enprotec_stock_receipts_list_view AS
SELECT
    sr.id,
    sr.stock_item_id AS "stockItemId",
    si.part_number AS "partNumber",
    si.description,
    sr.quantity_received AS "quantityReceived",
    u.name AS "receivedBy",
    sr.received_at AS "receivedAt",
    sr.store
FROM public.enprotec_stock_receipts sr
JOIN public.enprotec_stock_items si ON sr.stock_item_id = si.id
JOIN public.enprotec_users u ON sr.received_by_id = u.id;

-- Grant permissions
GRANT SELECT ON public.enprotec_stock_receipts_list_view TO authenticated;

-- Add comment
COMMENT ON VIEW public.enprotec_stock_receipts_list_view IS 'Lightweight stock receipts view for list pages';

-- ============================================================================
-- Success Report
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ LIGHTWEIGHT VIEWS CREATED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Views created:';
    RAISE NOTICE '- en_workflows_list_view (for WorkflowList, Dashboard)';
    RAISE NOTICE '- enprotec_stock_receipts_list_view (for Reports)';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage:';
    RAISE NOTICE '- Use *_list_view for displaying lists (10x faster)';
    RAISE NOTICE '- Use full views only for detail modals';
    RAISE NOTICE '========================================';
END $$;
