-- ============================================================================
-- Create RPC function for atomic stock request processing
-- ============================================================================
-- This function handles stock request creation atomically to prevent race
-- conditions when creating workflow requests and request items.
-- Items are stored in the enprotec_workflow_items table (NOT as JSONB in main table)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_stock_request(
    p_requester_id UUID,
    p_request_number TEXT,
    p_site_id UUID,
    p_department TEXT,
    p_priority TEXT,
    p_items JSONB,
    p_attachment_url TEXT DEFAULT NULL,
    p_comment TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workflow_id UUID;
    v_item JSONB;
    v_stock_item_id UUID;
    v_quantity INTEGER;
BEGIN
    -- Validate requester exists
    IF NOT EXISTS (SELECT 1 FROM public.enprotec_users WHERE id = p_requester_id AND status = 'Active') THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Invalid or inactive user'
        );
    END IF;

    -- Validate items array is not empty
    IF jsonb_array_length(p_items) = 0 THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Request must contain at least one item'
        );
    END IF;

    -- Create workflow request (items stored in separate table)
    INSERT INTO public.enprotec_workflow_requests (
        requester_id,
        request_number,
        type,
        site_id,
        department,
        current_status,
        priority,
        attachment_url
    ) VALUES (
        p_requester_id,
        p_request_number,
        'Internal',
        p_site_id,
        p_department,
        'Request Submitted',
        p_priority::priority_level,
        p_attachment_url
    )
    RETURNING id INTO v_workflow_id;

    -- Insert each item into enprotec_workflow_items table
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_stock_item_id := (v_item->>'stock_item_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        -- Validate stock item exists
        IF NOT EXISTS (SELECT 1 FROM public.enprotec_stock_items WHERE id = v_stock_item_id) THEN
            -- Rollback by deleting the workflow request we just created
            DELETE FROM public.enprotec_workflow_requests WHERE id = v_workflow_id;

            RETURN json_build_object(
                'success', FALSE,
                'error', 'One or more stock items not found'
            );
        END IF;

        -- Insert the item
        INSERT INTO public.enprotec_workflow_items (
            workflow_request_id,
            stock_item_id,
            quantity_requested
        ) VALUES (
            v_workflow_id,
            v_stock_item_id,
            v_quantity
        );
    END LOOP;

    -- Add initial comment if provided
    IF p_comment IS NOT NULL AND p_comment != '' THEN
        INSERT INTO public.enprotec_workflow_comments (
            workflow_request_id,
            user_id,
            comment_text
        ) VALUES (
            v_workflow_id,
            p_requester_id,
            p_comment
        );
    END IF;

    RETURN json_build_object(
        'success', TRUE,
        'workflow_id', v_workflow_id,
        'request_number', p_request_number
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Unable to create request. Please try again.'
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.process_stock_request TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.process_stock_request IS 'Atomically processes stock request creation with items stored in enprotec_workflow_items table';
