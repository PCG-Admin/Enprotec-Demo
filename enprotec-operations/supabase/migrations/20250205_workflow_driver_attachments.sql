-- Add driver metadata to workflow requests
ALTER TABLE public.enprotec_workflow_requests
    ADD COLUMN IF NOT EXISTS driver_name text,
    ADD COLUMN IF NOT EXISTS vehicle_registration text;

-- Create attachments table for workflows
CREATE TABLE IF NOT EXISTS public.enprotec_workflow_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_request_id uuid NOT NULL REFERENCES public.enprotec_workflow_requests(id) ON DELETE CASCADE,
    file_name text,
    attachment_url text NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enprotec_workflow_attachments_request_idx
    ON public.enprotec_workflow_attachments (workflow_request_id);

-- Refresh view so new fields and attachment data are exposed
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
                AND inv.store = (
                    CASE wr.department
                        WHEN 'OEM' THEN 'OEM'::public.store_type
                        WHEN 'Operations' THEN 'Operations'::public.store_type
                        WHEN 'Projects' THEN 'Projects'::public.store_type
                        WHEN 'SalvageYard' THEN 'SalvageYard'::public.store_type
                        WHEN 'Satellite' THEN 'Satellite'::public.store_type
                    END
                )
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
FROM
    public.enprotec_workflow_requests wr
JOIN
    public.enprotec_users u ON wr.requester_id = u.id
LEFT JOIN
    public.enprotec_sites s ON wr.site_id = s.id;
