-- Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.en_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.enprotec_users(id),
    action character varying NOT NULL,
    entity_type character varying NOT NULL, -- e.g., 'Stock', 'Workflow', 'User'
    entity_id uuid, -- ID of the affected record
    details jsonb, -- Flexible JSON for storing before/after values or other context
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.en_audit_logs IS 'Immutable log of critical system actions for accountability.';

-- Enable RLS on Audit Logs (read-only for admins, insert-only for system functions)
ALTER TABLE public.en_audit_logs ENABLE ROW LEVEL SECURITY;

-- RPC: Process Stock Intake (Atomic)
CREATE OR REPLACE FUNCTION public.process_stock_intake(
    p_stock_item_id uuid,
    p_quantity integer,
    p_store public.store_type,
    p_location text,
    p_received_by_id uuid,
    p_delivery_note text,
    p_comments text,
    p_attachment_url text,
    p_is_return boolean DEFAULT false,
    p_return_workflow_id uuid DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (to bypass RLS if needed for inventory updates)
AS $$
DECLARE
    v_inventory_id uuid;
    v_receipt_id uuid;
    v_current_qty integer;
    v_new_qty integer;
BEGIN
    -- 1. Insert Stock Receipt
    INSERT INTO public.enprotec_stock_receipts (
        stock_item_id,
        quantity_received,
        received_by_id,
        store,
        delivery_note_po,
        comments,
        attachment_url
    ) VALUES (
        p_stock_item_id,
        p_quantity,
        p_received_by_id,
        p_store,
        p_delivery_note,
        p_comments,
        p_attachment_url
    ) RETURNING id INTO v_receipt_id;

    -- 2. Upsert Inventory (Atomic Increment)
    -- Check if inventory record exists
    SELECT id, quantity_on_hand INTO v_inventory_id, v_current_qty
    FROM public.enprotec_inventory
    WHERE stock_item_id = p_stock_item_id AND store = p_store
    FOR UPDATE; -- Lock the row

    IF v_inventory_id IS NOT NULL THEN
        -- Update existing
        UPDATE public.enprotec_inventory
        SET 
            quantity_on_hand = quantity_on_hand + p_quantity,
            location = COALESCE(p_location, location) -- Update location if provided
        WHERE id = v_inventory_id
        RETURNING quantity_on_hand INTO v_new_qty;
    ELSE
        -- Insert new
        INSERT INTO public.enprotec_inventory (
            stock_item_id,
            store,
            quantity_on_hand,
            location
        ) VALUES (
            p_stock_item_id,
            p_store,
            p_quantity,
            p_location
        ) RETURNING quantity_on_hand INTO v_new_qty;
        v_current_qty := 0;
    END IF;

    -- 3. Handle Return Workflow (if applicable)
    IF p_is_return AND p_return_workflow_id IS NOT NULL THEN
        UPDATE public.enprotec_workflow_requests
        SET 
            current_status = 'Completed',
            rejection_comment = NULL
        WHERE id = p_return_workflow_id;
    END IF;

    -- 4. Create Audit Log
    INSERT INTO public.en_audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_received_by_id,
        CASE WHEN p_is_return THEN 'STOCK_RETURN' ELSE 'STOCK_INTAKE' END,
        'Inventory',
        p_stock_item_id,
        jsonb_build_object(
            'store', p_store,
            'quantity_added', p_quantity,
            'previous_quantity', v_current_qty,
            'new_quantity', v_new_qty,
            'receipt_id', v_receipt_id,
            'return_workflow_id', p_return_workflow_id
        )
    );

    RETURN jsonb_build_object('success', true, 'receipt_id', v_receipt_id, 'new_quantity', v_new_qty);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- RPC: Process Stock Request (Atomic Creation)
CREATE OR REPLACE FUNCTION public.process_stock_request(
    p_requester_id uuid,
    p_request_number text,
    p_site_id uuid,
    p_department public.department,
    p_priority public.priority_level,
    p_attachment_url text,
    p_items jsonb, -- Array of objects: [{stock_item_id, quantity}]
    p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id uuid;
    v_item jsonb;
BEGIN
    -- 1. Create Request
    INSERT INTO public.enprotec_workflow_requests (
        request_number,
        type,
        requester_id,
        site_id,
        department,
        current_status,
        priority,
        attachment_url
    ) VALUES (
        p_request_number,
        'Internal',
        p_requester_id,
        p_site_id,
        p_department,
        'Request Submitted',
        p_priority,
        p_attachment_url
    ) RETURNING id INTO v_request_id;

    -- 2. Create Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.enprotec_workflow_items (
            workflow_request_id,
            stock_item_id,
            quantity_requested
        ) VALUES (
            v_request_id,
            (v_item->>'stock_item_id')::uuid,
            (v_item->>'quantity')::int
        );
    END LOOP;

    -- 3. Add Comment (if exists)
    IF p_comment IS NOT NULL AND length(p_comment) > 0 THEN
        INSERT INTO public.enprotec_workflow_comments (
            workflow_request_id,
            user_id,
            comment_text
        ) VALUES (
            v_request_id,
            p_requester_id,
            p_comment
        );
    END IF;

    -- 4. Audit Log
    INSERT INTO public.en_audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        details
    ) VALUES (
        p_requester_id,
        'CREATE_REQUEST',
        'WorkflowRequest',
        v_request_id,
        jsonb_build_object(
            'request_number', p_request_number,
            'item_count', jsonb_array_length(p_items)
        )
    );

    RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
