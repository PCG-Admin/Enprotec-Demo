-- ============================================================================
-- FINAL FIX ALL - Consolidated Database Fixes
-- ============================================================================
-- This script fixes all remaining database issues:
-- 1. Adds store column to stock_receipts table and view
-- 2. Updates workflows view with correct steps array
-- 3. Re-applies the dispatch trigger fix
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Stock Receipts View - Add Store Column
-- ============================================================================

-- Add store column to enprotec_stock_receipts table
ALTER TABLE public.enprotec_stock_receipts
ADD COLUMN IF NOT EXISTS store TEXT;

-- Backfill store data from enprotec_inventory for existing receipts
UPDATE public.enprotec_stock_receipts sr
SET store = (
    SELECT inv.store
    FROM public.enprotec_inventory inv
    WHERE inv.stock_item_id = sr.stock_item_id
    ORDER BY inv.id DESC
    LIMIT 1
)
WHERE sr.store IS NULL;

-- Drop and recreate the stock receipts view
DROP VIEW IF EXISTS public.enprotec_stock_receipts_view CASCADE;

CREATE VIEW public.enprotec_stock_receipts_view AS
SELECT
    sr.id,
    sr.stock_item_id AS "stockItemId",
    si.part_number AS "partNumber",
    si.description,
    sr.quantity_received AS "quantityReceived",
    u.name AS "receivedBy",
    sr.received_at AS "receivedAt",
    sr.delivery_note_po AS "deliveryNotePO",
    sr.comments,
    sr.attachment_url AS "attachmentUrl",
    sr.store
FROM public.enprotec_stock_receipts sr
JOIN public.enprotec_stock_items si ON sr.stock_item_id = si.id
JOIN public.enprotec_users u ON sr.received_by_id = u.id;

GRANT SELECT ON public.enprotec_stock_receipts_view TO authenticated;

-- Add index for better query performance when filtering by store
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_store ON public.enprotec_stock_receipts(store);

-- ============================================================================
-- PART 2: Fix Workflows View - Update Steps Array
-- ============================================================================

-- Drop and recreate workflows view with correct steps
DROP VIEW IF EXISTS public.enprotec_workflows_view CASCADE;

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
                AND inv.store = wr.department
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

GRANT SELECT ON public.enprotec_workflows_view TO authenticated;

-- ============================================================================
-- PART 3: Verify Dispatch Trigger is Fixed
-- ============================================================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS on_dispatch_trigger ON public.enprotec_workflow_requests;

-- Recreate the function without store_type enum
CREATE OR REPLACE FUNCTION public.on_dispatch_deduct_stock()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
    target_store TEXT;
BEGIN
    IF NEW.current_status = 'Dispatched' AND OLD.current_status != 'Dispatched' THEN
        target_store := NEW.department;

        IF target_store IS NOT NULL THEN
            FOR item_record IN
                SELECT stock_item_id, quantity_requested
                FROM public.enprotec_workflow_items
                WHERE workflow_request_id = NEW.id
            LOOP
                UPDATE public.enprotec_inventory
                SET quantity_on_hand = quantity_on_hand - item_record.quantity_requested
                WHERE stock_item_id = item_record.stock_item_id
                AND store = target_store
                AND (site_id = NEW.site_id OR site_id IS NULL);
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_dispatch_trigger
AFTER UPDATE ON public.enprotec_workflow_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_dispatch_deduct_stock();

-- ============================================================================
-- Success Messages
-- ============================================================================
SELECT '✅ ALL FIXES APPLIED SUCCESSFULLY' as status;
SELECT '1. Stock receipts view now has store column' as fix_1;
SELECT '2. Workflows view has correct steps array' as fix_2;
SELECT '3. Dispatch trigger uses TEXT instead of store_type enum' as fix_3;
