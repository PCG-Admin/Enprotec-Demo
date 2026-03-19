-- ============================================================================
-- FIX WORKFLOWS VIEW - Remove store_type enum references
-- ============================================================================
-- The view is casting to store_type enum which doesn't exist
-- Since department and store are now TEXT fields, we don't need the cast
-- ============================================================================

-- Drop the existing view first
DROP VIEW IF EXISTS public.enprotec_workflows_view CASCADE;

-- Recreate the view without store_type casts
CREATE VIEW public.enprotec_workflows_view AS
SELECT
    wr.id,
    wr.request_number AS "requestNumber",
    wr.type,
    u.name AS requester,
    wr.requester_id,
    s.name AS "projectCode",
    wr.department,
    wr.current_status AS "currentStatus",
    wr.priority,
    wr.created_at AS "createdAt",
    wr.attachment_url AS "attachmentUrl",
    wr.rejection_comment AS "rejectionComment",
    wr.driver_name AS "driverName",
    wr.vehicle_registration AS "vehicleRegistration",
    (
        SELECT COALESCE(jsonb_agg(items_data.item_object), '[]'::jsonb)
        FROM (
            SELECT
                jsonb_build_object(
                    'partNumber', si.part_number,
                    'description', si.description,
                    'quantityRequested', wi.quantity_requested,
                    'quantityOnHand', COALESCE(inv.quantity_on_hand, 0)
                ) AS item_object
            FROM
                public.enprotec_workflow_items wi
            JOIN
                public.enprotec_stock_items si ON wi.stock_item_id = si.id
            LEFT JOIN
                public.enprotec_inventory inv ON wi.stock_item_id = inv.stock_item_id
                AND inv.store = wr.department  -- FIXED: Removed store_type cast, direct TEXT comparison
                AND (inv.site_id = wr.site_id OR inv.site_id IS NULL)
            WHERE
                wi.workflow_request_id = wr.id
            ORDER BY
                si.part_number
        ) AS items_data
    ) AS items,
    ARRAY[
        'Request Submitted',
        'Awaiting Stock Controller',
        'Awaiting Equip. Manager',
        'Awaiting Picking',
        'Picked & Loaded',
        'Dispatched',
        'EPOD Confirmed',
        'Completed'
    ]::text[] AS steps,
    (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', a.id,
                'url', a.attachment_url,
                'fileName', a.file_name,
                'uploadedAt', a.uploaded_at
            )
        ), '[]'::jsonb)
        FROM public.enprotec_workflow_attachments a
        WHERE a.workflow_request_id = wr.id
    ) AS attachments
FROM
    public.enprotec_workflow_requests wr
JOIN
    public.enprotec_users u ON wr.requester_id = u.id
LEFT JOIN
    public.enprotec_sites s ON wr.site_id = s.id;

-- Grant SELECT permission
GRANT SELECT ON public.enprotec_workflows_view TO authenticated;

-- Success message
SELECT '✅ Workflows view fixed - store_type cast removed' as status;
