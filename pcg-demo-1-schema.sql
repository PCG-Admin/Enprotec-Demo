-- ============================================
-- PCG DEMO: PART 1 of 2 - Base Schema
-- Run FIRST in the SQL editor, then run Part 2
-- ============================================

-- Drop existing objects if they exist to ensure a clean slate.
DROP VIEW IF EXISTS public.enprotec_salvage_requests_view;
DROP VIEW IF EXISTS public.enprotec_stock_receipts_view;
DROP VIEW IF EXISTS public.enprotec_workflows_view;
DROP VIEW IF EXISTS public.enprotec_stock_view;
DROP FUNCTION IF EXISTS public.on_dispatch_deduct_stock() CASCADE;
DROP TABLE IF EXISTS public.enprotec_salvage_requests CASCADE;
DROP TABLE IF EXISTS public.enprotec_workflow_comments CASCADE;
DROP TABLE IF EXISTS public.enprotec_stock_receipts CASCADE;
DROP TABLE IF EXISTS public.enprotec_workflow_items CASCADE;
DROP TABLE IF EXISTS public.enprotec_workflow_attachments CASCADE;
DROP TABLE IF EXISTS public.enprotec_workflow_requests CASCADE;
DROP TABLE IF EXISTS public.enprotec_inventory CASCADE;
DROP TABLE IF EXISTS public.enprotec_stock_items CASCADE;
DROP TABLE IF EXISTS public.enprotec_departments CASCADE;
DROP TABLE IF EXISTS public.enprotec_sites CASCADE;
DROP TABLE IF EXISTS public.enprotec_users CASCADE;
DROP TABLE IF EXISTS public.en_audit_logs CASCADE;
DROP TYPE IF EXISTS public.department CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.workflow_status CASCADE;
DROP TYPE IF EXISTS public.priority_level CASCADE;
DROP TYPE IF EXISTS public.store_type CASCADE;
DROP TYPE IF EXISTS public.site_status CASCADE;

-- Custom Types
CREATE TYPE public.department AS ENUM ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite');
CREATE TYPE public.user_role AS ENUM ('Admin', 'Operations Manager', 'Equipment Manager', 'Stock Controller', 'Storeman', 'Site Manager', 'Project Manager', 'Driver', 'Security');
CREATE TYPE public.user_status AS ENUM ('Active', 'Inactive');
CREATE TYPE public.workflow_status AS ENUM (
    'Request Submitted',
    'Request Declined',
    'Awaiting Equip. Manager',
    'Awaiting Picking',
    'Picked & Loaded',
    'Dispatched',
    'EPOD Confirmed',
    'Completed',
    'Rejected at Delivery',
    -- Salvage Flow
    'Salvage - Awaiting Decision',
    'Salvage - To Be Repaired',
    'Salvage - Repair Confirmed',
    'Salvage - To Be Scrapped',
    'Salvage - Scrap Confirmed',
    'Salvage - Complete',
    -- Legacy statuses for compatibility
    'Awaiting Stock Controller',
    'Gate Release Pending',
    -- External Flow
    'PR Submitted',
    'Manager Approval',
    'PO Generated',
    'Supplier Delivery',
    'Stock Controller Intake',
    'Awaiting Ops Manager'
);
CREATE TYPE public.priority_level AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE public.store_type AS ENUM ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite');
CREATE TYPE public.site_status AS ENUM ('Active', 'Frozen');

-- Sites Table
CREATE TABLE public.enprotec_sites (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name character varying NOT NULL UNIQUE,
    status public.site_status NOT NULL DEFAULT 'Active'::public.site_status
);
COMMENT ON TABLE public.enprotec_sites IS 'Stores destination sites for workflows.';

-- Users Table
CREATE TABLE public.enprotec_users (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name character varying NOT NULL,
    email character varying NOT NULL UNIQUE,
    password text NOT NULL,
    role public.user_role NOT NULL,
    sites text[],
    status public.user_status NOT NULL DEFAULT 'Active'::public.user_status,
    departments public.department[]
);
COMMENT ON TABLE public.enprotec_users IS 'Stores all user profile and login information.';

-- Stock Items Table
CREATE TABLE public.enprotec_stock_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    part_number character varying NOT NULL UNIQUE,
    description text,
    category character varying,
    min_stock_level integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.enprotec_stock_items IS 'Master list of all unique stock parts and their properties.';

-- Inventory Table
CREATE TABLE public.enprotec_inventory (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_item_id uuid NOT NULL REFERENCES public.enprotec_stock_items(id) ON DELETE RESTRICT,
    store public.store_type NOT NULL,
    quantity_on_hand integer NOT NULL DEFAULT 0,
    location character varying,
    site_id uuid REFERENCES public.enprotec_sites(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.enprotec_inventory IS 'Tracks the quantity and location of each stock item in different stores.';

-- Workflow Requests Table
CREATE TABLE public.enprotec_workflow_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    request_number character varying NOT NULL UNIQUE,
    type character varying NOT NULL,
    requester_id uuid NOT NULL REFERENCES public.enprotec_users(id),
    site_id uuid REFERENCES public.enprotec_sites(id),
    department public.department NOT NULL DEFAULT 'Operations'::public.department,
    current_status public.workflow_status NOT NULL,
    priority public.priority_level NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    attachment_url text,
    rejection_comment text,
    driver_name text,
    vehicle_registration text
);
COMMENT ON TABLE public.enprotec_workflow_requests IS 'Main table for all workflow requests.';

-- Workflow Items Table
CREATE TABLE public.enprotec_workflow_items (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_request_id uuid NOT NULL REFERENCES public.enprotec_workflow_requests(id) ON DELETE CASCADE,
    stock_item_id uuid NOT NULL REFERENCES public.enprotec_stock_items(id) ON DELETE RESTRICT,
    quantity_requested integer NOT NULL
);
COMMENT ON TABLE public.enprotec_workflow_items IS 'Stores the line items associated with a workflow request.';

-- Stock Receipts Table
CREATE TABLE public.enprotec_stock_receipts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_item_id uuid NOT NULL REFERENCES public.enprotec_stock_items(id) ON DELETE RESTRICT,
    quantity_received integer NOT NULL,
    received_by_id uuid NOT NULL REFERENCES public.enprotec_users(id),
    store public.store_type NOT NULL,
    delivery_note_po text,
    comments text,
    attachment_url text,
    received_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.enprotec_stock_receipts IS 'Audit log for all incoming stock.';

-- Workflow Comments Table
CREATE TABLE public.enprotec_workflow_comments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_request_id uuid NOT NULL REFERENCES public.enprotec_workflow_requests(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.enprotec_users(id),
    comment_text text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.enprotec_workflow_comments IS 'Stores user comments for each workflow request.';

-- Workflow Attachments Table
CREATE TABLE public.enprotec_workflow_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_request_id uuid NOT NULL REFERENCES public.enprotec_workflow_requests(id) ON DELETE CASCADE,
    file_name text,
    attachment_url text NOT NULL,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enprotec_workflow_attachments_request_idx ON public.enprotec_workflow_attachments (workflow_request_id);
COMMENT ON TABLE public.enprotec_workflow_attachments IS 'Stores one or many supporting attachments linked to a workflow request.';

-- Salvage Requests Table
CREATE TABLE public.enprotec_salvage_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_item_id uuid NOT NULL REFERENCES public.enprotec_stock_items(id) ON DELETE RESTRICT,
    quantity integer NOT NULL,
    status public.workflow_status NOT NULL,
    notes text,
    source_department public.department,
    created_by_id uuid NOT NULL REFERENCES public.enprotec_users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    decision_by_id uuid REFERENCES public.enprotec_users(id),
    decision_at timestamp with time zone,
    photo_url text
);
COMMENT ON TABLE public.enprotec_salvage_requests IS 'Tracks items going through the salvage/repair/scrap process.';

-- VIEWS
CREATE OR REPLACE VIEW public.enprotec_stock_receipts_view AS
SELECT
    r.id,
    si.part_number AS "partNumber",
    si.description,
    r.quantity_received AS "quantityReceived",
    u.name AS "receivedBy",
    r.received_at AS "receivedAt",
    r.store,
    r.delivery_note_po AS "deliveryNotePO",
    r.attachment_url AS "attachmentUrl",
    r.comments
FROM public.enprotec_stock_receipts r
JOIN public.enprotec_stock_items si ON r.stock_item_id = si.id
JOIN public.enprotec_users u ON r.received_by_id = u.id;

CREATE OR REPLACE VIEW public.enprotec_stock_view AS
SELECT
    i.id,
    si.part_number AS "partNumber",
    si.description,
    si.category,
    i.quantity_on_hand AS "quantityOnHand",
    si.min_stock_level AS "minStockLevel",
    i.store,
    i.location,
    i.site_id
FROM public.enprotec_inventory i
JOIN public.enprotec_stock_items si ON i.stock_item_id = si.id;

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

-- FUNCTIONS AND TRIGGERS FOR AUTOMATION
CREATE OR REPLACE FUNCTION public.on_dispatch_deduct_stock()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
    target_store public.store_type;
BEGIN
    IF NEW.current_status = 'Dispatched' AND OLD.current_status != 'Dispatched' THEN
        -- Determine the source store based on the workflow's department
        CASE NEW.department
            WHEN 'OEM' THEN target_store := 'OEM'::public.store_type;
            WHEN 'Operations' THEN target_store := 'Operations'::public.store_type;
            WHEN 'Projects' THEN target_store := 'Projects'::public.store_type;
            WHEN 'SalvageYard' THEN target_store := 'SalvageYard'::public.store_type;
            WHEN 'Satellite' THEN target_store := 'Satellite'::public.store_type;
        END CASE;

        IF target_store IS NOT NULL THEN
            FOR item_record IN
                SELECT stock_item_id, quantity_requested
                FROM public.enprotec_workflow_items
                WHERE workflow_request_id = NEW.id
            LOOP
                UPDATE public.enprotec_inventory
                SET quantity_on_hand = quantity_on_hand - item_record.quantity_requested
                WHERE stock_item_id = item_record.stock_item_id AND store = target_store;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER on_dispatch_trigger
AFTER UPDATE ON public.enprotec_workflow_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_dispatch_deduct_stock();

COMMENT ON TRIGGER on_dispatch_trigger ON public.enprotec_workflow_requests IS 'When a workflow is marked as Dispatched, automatically deduct the requested stock quantities from the appropriate store based on the workflow department.';

-- Departments table (needed before migrations add FK constraints to it)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.enprotec_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Frozen')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_en_departments_code ON public.enprotec_departments(code);
CREATE INDEX IF NOT EXISTS idx_en_departments_status ON public.enprotec_departments(status);

INSERT INTO public.enprotec_departments (code, name, description) VALUES
    ('OEM', 'OEM', 'OEM Parts and Components'),
    ('Operations', 'Operations', 'Operations Department'),
    ('Projects', 'Projects', 'Project-specific Materials'),
    ('SalvageYard', 'Salvage Yard', 'Salvage and Recovery'),
    ('Satellite', 'Satellite', 'Satellite Location Storage')
ON CONFLICT (code) DO NOTHING;

CREATE TRIGGER set_updated_at_en_departments
    BEFORE UPDATE ON public.enprotec_departments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Disable RLS
ALTER TABLE public.enprotec_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_workflow_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_workflow_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_sites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_stock_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_workflow_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.enprotec_salvage_requests DISABLE ROW LEVEL SECURITY;
