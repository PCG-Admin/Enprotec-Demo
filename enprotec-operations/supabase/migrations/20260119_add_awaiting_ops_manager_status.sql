-- Migration: Add AWAITING_OPS_MANAGER status to workflow
-- Created: 2026-01-19
-- Description: Adds Operations Manager approval step between REQUEST_SUBMITTED and Stock Controller approval

-- Add the new status to the workflow_status enum (if it exists as an enum type)
-- This migration is safe to re-run
DO $$
BEGIN
    -- Check if the workflow_status type exists and add the new value
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status') THEN
        -- Add the new enum value if it doesn't already exist
        -- Note: In PostgreSQL, we can't easily insert in the middle of an enum
        -- The new value will be added at the end, but the application logic handles the order
        ALTER TYPE public.workflow_status ADD VALUE IF NOT EXISTS 'Awaiting Ops Manager';
    END IF;
END $$;

-- Note: The actual workflow order is managed by the application logic in the frontend
-- This migration just ensures the database accepts the new status value
