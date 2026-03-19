-- ============================================================================
-- FIX: Stock Receipts Not Showing in Reports
-- ============================================================================
-- Run this in Supabase SQL Editor to fix stock receipts display
-- ============================================================================

-- STEP 1: Add store column to en_stock_receipts table
ALTER TABLE public.en_stock_receipts
ADD COLUMN IF NOT EXISTS store TEXT;

-- STEP 2: Backfill store data for existing receipts
-- Match receipt to inventory by stock_item_id
UPDATE public.en_stock_receipts sr
SET store = (
    SELECT inv.store
    FROM public.en_inventory inv
    WHERE inv.stock_item_id = sr.stock_item_id
    ORDER BY inv.updated_at DESC
    LIMIT 1
)
WHERE sr.store IS NULL;

-- STEP 3: Add index for better performance
CREATE INDEX IF NOT EXISTS idx_en_stock_receipts_store ON public.en_stock_receipts(store);

-- STEP 4: Update the view to include store column
CREATE OR REPLACE VIEW public.en_stock_receipts_view AS
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
FROM public.en_stock_receipts sr
JOIN public.en_stock_items si ON sr.stock_item_id = si.id
JOIN public.en_users u ON sr.received_by_id = u.id;

-- STEP 5: Update process_stock_intake function to save store
DROP FUNCTION IF EXISTS public.process_stock_intake CASCADE;

CREATE OR REPLACE FUNCTION public.process_stock_intake(
    p_stock_item_id UUID,
    p_quantity INTEGER,
    p_store TEXT,
    p_location TEXT,
    p_received_by_id UUID,
    p_delivery_note TEXT,
    p_comments TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_is_return BOOLEAN DEFAULT FALSE,
    p_return_workflow_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inventory_id UUID;
    v_receipt_id UUID;
BEGIN
    -- Validate stock item exists
    IF NOT EXISTS (SELECT 1 FROM public.en_stock_items WHERE id = p_stock_item_id) THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Stock item not found'
        );
    END IF;

    -- Find or create inventory record
    SELECT id INTO v_inventory_id
    FROM public.en_inventory
    WHERE stock_item_id = p_stock_item_id AND store = p_store;

    IF v_inventory_id IS NULL THEN
        -- Create new inventory record
        INSERT INTO public.en_inventory (
            stock_item_id,
            store,
            location,
            quantity_on_hand
        ) VALUES (
            p_stock_item_id,
            p_store,
            COALESCE(NULLIF(p_location, ''), 'General'),
            p_quantity
        )
        RETURNING id INTO v_inventory_id;
    ELSE
        -- Update existing inventory
        UPDATE public.en_inventory
        SET
            quantity_on_hand = quantity_on_hand + p_quantity,
            location = COALESCE(NULLIF(p_location, ''), location)
        WHERE id = v_inventory_id;
    END IF;

    -- Create stock receipt record WITH STORE
    INSERT INTO public.en_stock_receipts (
        stock_item_id,
        quantity_received,
        received_by_id,
        received_at,
        delivery_note_po,
        comments,
        attachment_url,
        store
    ) VALUES (
        p_stock_item_id,
        p_quantity,
        p_received_by_id,
        NOW(),
        p_delivery_note,
        p_comments,
        p_attachment_url,
        p_store
    )
    RETURNING id INTO v_receipt_id;

    -- Handle returns
    IF p_is_return AND p_return_workflow_id IS NOT NULL THEN
        UPDATE public.en_workflow_requests
        SET current_status = 'Completed'
        WHERE id = p_return_workflow_id;
    END IF;

    -- Return success with details
    RETURN json_build_object(
        'success', TRUE,
        'inventory_id', v_inventory_id,
        'receipt_id', v_receipt_id,
        'new_quantity', (SELECT quantity_on_hand FROM public.en_inventory WHERE id = v_inventory_id)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_stock_intake TO authenticated;

-- Verify the fix
SELECT 'Stock receipts display fix completed successfully!' as status;
SELECT 'Total receipts in database: ' || COUNT(*)::text as receipt_count FROM public.en_stock_receipts;
SELECT 'Receipts with store assigned: ' || COUNT(*)::text as receipts_with_store FROM public.en_stock_receipts WHERE store IS NOT NULL;
