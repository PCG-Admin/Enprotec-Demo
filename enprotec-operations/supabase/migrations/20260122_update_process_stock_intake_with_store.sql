-- ============================================================================
-- Update process_stock_intake to save store in stock receipts
-- ============================================================================
-- This ensures stock receipts record which department/store received the stock
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.process_stock_intake CASCADE;

-- Recreate with store column in INSERT
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
    IF NOT EXISTS (SELECT 1 FROM public.enprotec_stock_items WHERE id = p_stock_item_id) THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Stock item not found'
        );
    END IF;

    -- Find or create inventory record
    SELECT id INTO v_inventory_id
    FROM public.enprotec_inventory
    WHERE stock_item_id = p_stock_item_id AND store = p_store;

    IF v_inventory_id IS NULL THEN
        -- Create new inventory record
        INSERT INTO public.enprotec_inventory (
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
        UPDATE public.enprotec_inventory
        SET
            quantity_on_hand = quantity_on_hand + p_quantity,
            location = COALESCE(NULLIF(p_location, ''), location)
        WHERE id = v_inventory_id;
    END IF;

    -- Create stock receipt record (NOW INCLUDING STORE)
    INSERT INTO public.enprotec_stock_receipts (
        stock_item_id,
        quantity_received,
        received_by_id,
        -- OPTIMIZED: removed received_at (has DEFAULT)
        delivery_note_po,
        comments,
        attachment_url,
        store  -- Added store column
    ) VALUES (
        p_stock_item_id,
        p_quantity,
        p_received_by_id,
        -- OPTIMIZED: removed NOW()
        p_delivery_note,
        p_comments,
        p_attachment_url,
        p_store  -- Save the store parameter
    )
    RETURNING id INTO v_receipt_id;

    -- Handle returns
    IF p_is_return AND p_return_workflow_id IS NOT NULL THEN
        UPDATE public.enprotec_workflow_requests
        SET current_status = 'Completed'
        WHERE id = p_return_workflow_id;
    END IF;

    -- Return success with details
    RETURN json_build_object(
        'success', TRUE,
        'inventory_id', v_inventory_id,
        'receipt_id', v_receipt_id,
        'new_quantity', (SELECT quantity_on_hand FROM public.enprotec_inventory WHERE id = v_inventory_id)
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

-- Add comment
COMMENT ON FUNCTION public.process_stock_intake IS 'Atomically processes stock intake/receipt without triggering stock movements. Includes store in receipt record. OPTIMIZED: removed unnecessary received_at (has DEFAULT).';
