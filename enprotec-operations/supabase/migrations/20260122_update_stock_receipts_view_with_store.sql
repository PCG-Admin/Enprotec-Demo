-- ============================================================================
-- Add store column to enprotec_stock_receipts and update view
-- ============================================================================
-- Stock receipts should record which store/department received the stock
-- This allows proper filtering by department in the UI
-- ============================================================================

-- Step 1: Add store column to enprotec_stock_receipts table
ALTER TABLE public.enprotec_stock_receipts
ADD COLUMN IF NOT EXISTS store TEXT;

-- Step 2: Backfill store data from enprotec_inventory for existing receipts
-- Match receipt to inventory by stock_item_id and use the most recent inventory record
UPDATE public.enprotec_stock_receipts sr
SET store = (
    SELECT inv.store
    FROM public.enprotec_inventory inv
    WHERE inv.stock_item_id = sr.stock_item_id
    ORDER BY inv.updated_at DESC
    LIMIT 1
)
WHERE sr.store IS NULL;

-- Step 3: Update the view to include the store column
CREATE OR REPLACE VIEW public.enprotec_stock_receipts_view AS
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
    sr.store  -- Now using the stored value instead of joining
FROM public.enprotec_stock_receipts sr
JOIN public.enprotec_stock_items si ON sr.stock_item_id = si.id
JOIN public.enprotec_users u ON sr.received_by_id = u.id;

-- Update comment
COMMENT ON VIEW public.enprotec_stock_receipts_view IS 'View for stock receipts with joined user, stock item, and store data';

-- Add index for better query performance when filtering by store
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_store ON public.enprotec_stock_receipts(store);
