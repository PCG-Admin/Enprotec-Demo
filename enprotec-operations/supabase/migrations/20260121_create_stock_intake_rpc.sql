-- ============================================================================
-- Create RPC function for atomic stock intake processing
-- ============================================================================
-- This function handles stock receipts atomically to prevent race conditions
-- when updating inventory quantities.
-- ============================================================================

-- Drop old version if exists
DROP FUNCTION IF EXISTS public.process_stock_intake(UUID, INTEGER, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID);

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
    v_part_number TEXT;
    v_description TEXT;
    v_current_quantity INTEGER;
BEGIN
    -- Get stock item details
    SELECT part_number, description
    INTO v_part_number, v_description
    FROM public.enprotec_stock_items
    WHERE id = p_stock_item_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Stock item not found'
        );
    END IF;

    -- Find or create inventory record for this stock item + store combination
    SELECT id, quantity_on_hand
    INTO v_inventory_id, v_current_quantity
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
            p_location,
            p_quantity
        )
        RETURNING id INTO v_inventory_id;
    ELSE
        -- Update existing inventory record
        UPDATE public.enprotec_inventory
        SET
            quantity_on_hand = quantity_on_hand + p_quantity,
            location = COALESCE(NULLIF(p_location, ''), location), -- Update location only if provided
            updated_at = NOW()
        WHERE id = v_inventory_id;
    END IF;

    -- Create stock receipt record
    INSERT INTO public.enprotec_stock_receipts (
        stock_item_id,
        quantity_received,
        received_by_id,
        received_at,
        delivery_note_po,
        comments,
        attachment_url
    ) VALUES (
        p_stock_item_id,
        p_quantity,
        p_received_by_id,
        NOW(),
        p_delivery_note,
        p_comments,
        p_attachment_url
    )
    RETURNING id INTO v_receipt_id;

    -- If this is a return from a rejected delivery, update the workflow status
    IF p_is_return AND p_return_workflow_id IS NOT NULL THEN
        UPDATE public.enprotec_workflow_requests
        SET current_status = 'Completed'
        WHERE id = p_return_workflow_id;
    END IF;

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.process_stock_intake TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.process_stock_intake IS 'Atomically processes stock intake/receipt, updating inventory and creating receipt record';
