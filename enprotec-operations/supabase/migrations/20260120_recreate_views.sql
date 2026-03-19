-- Migration: Recreate Database Views After ENUM to TEXT Conversion
-- Date: 2026-01-20
-- Description: Recreates enprotec_workflows_view and enprotec_salvage_requests_view after converting
--              department columns from ENUM to TEXT. These views were dropped by CASCADE
--              when the department ENUM type was removed in migration 2.

-- Recreate photo_url column if it was dropped by CASCADE
ALTER TABLE public.enprotec_salvage_requests
ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE OR REPLACE VIEW public.enprotec_workflows_view AS
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
                AND inv.store = wr.department::text::public.store_type
            WHERE
                wi.workflow_request_id = wr.id
            ORDER BY
                si.part_number
        ) AS items_data
    ) AS items,
    ARRAY[
        'Request Submitted',
        'Awaiting Equip. Manager',
        'Awaiting Picking',
        'Picked & Loaded',
        'Dispatched',
        'EPOD Confirmed',
        'Completed'
    ]::public.workflow_status[] as steps,
    wr.driver_name AS "driverName",
    wr.vehicle_registration AS "vehicleRegistration",
    (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', wa.id,
                    'url', wa.attachment_url,
                    'fileName', wa.file_name,
                    'uploadedAt', wa.uploaded_at
                )
            ),
            '[]'::jsonb
        )
        FROM public.enprotec_workflow_attachments wa
        WHERE wa.workflow_request_id = wr.id
    ) AS attachments
FROM public.enprotec_workflow_requests wr
JOIN public.enprotec_users u ON wr.requester_id = u.id
LEFT JOIN public.enprotec_sites s ON wr.site_id = s.id;

CREATE OR REPLACE VIEW public.enprotec_salvage_requests_view AS
SELECT
    sr.id,
    sr.stock_item_id,
    si.part_number AS "partNumber",
    si.description,
    sr.quantity,
    sr.status,
    sr.notes,
    sr.source_department AS "sourceStore",
    sr.photo_url AS "photoUrl",
    creator.name AS "createdBy",
    sr.created_at AS "createdAt",
    decider.name AS "decisionBy",
    sr.decision_at AS "decisionAt"
FROM public.enprotec_salvage_requests sr
JOIN public.enprotec_stock_items si ON sr.stock_item_id = si.id
JOIN public.enprotec_users creator ON sr.created_by_id = creator.id
LEFT JOIN public.enprotec_users decider ON sr.decision_by_id = decider.id;
