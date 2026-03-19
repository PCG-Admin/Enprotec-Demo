-- Migration: Add Site Access Validation to Stock Request Creation
-- Created: 2026-01-19
-- Description: Validates that users can only create stock requests for sites they have been assigned

-- Update the process_stock_request function to validate site access
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
    v_user_sites text[];
    v_site_name text;
    v_user_role text;
BEGIN
    -- 0. Validate Site Access (Admin users bypass this check)
    -- Get the user's role and assigned sites from enprotec_users table
    SELECT role, sites INTO v_user_role, v_user_sites
    FROM public.enprotec_users
    WHERE id = p_requester_id;

    -- Admin users have access to all sites, skip validation
    IF v_user_role != 'Admin' THEN
        -- Get the site name for the requested site
        SELECT name INTO v_site_name
        FROM public.enprotec_sites
        WHERE id = p_site_id;

        -- Check if user has access to this site
        -- If sites is NULL or empty, user has no site access
        IF v_user_sites IS NULL OR array_length(v_user_sites, 1) IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'You do not have access to any sites. Please contact an administrator.'
            );
        END IF;

        -- Check if the requested site is in the user's assigned sites
        IF NOT (v_site_name = ANY(v_user_sites)) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'You do not have access to request from site: ' || v_site_name || '. Please contact an administrator.'
            );
        END IF;
    END IF;

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
