-- Migration: Recreate enprotec_users.departments as TEXT[] for Dynamic Stores
-- Date: 2026-01-20
-- Description: Recreates the departments column as TEXT[] (was dropped by CASCADE in migration 2)
--              This allows assignment of dynamic department values from enprotec_departments table.

-- The departments column was dropped by CASCADE when we dropped the department ENUM type in migration 2
-- Recreate it as TEXT[] array
ALTER TABLE public.enprotec_users
ADD COLUMN departments TEXT[];

-- Add check constraint to ensure departments reference valid codes
ALTER TABLE public.enprotec_users
ADD CONSTRAINT check_departments_not_empty
CHECK (departments IS NULL OR array_length(departments, 1) > 0);

-- Add index for better query performance when filtering by department
CREATE INDEX IF NOT EXISTS idx_en_users_departments
ON public.enprotec_users USING GIN (departments);

-- Add comment explaining the change
COMMENT ON COLUMN public.enprotec_users.departments IS 'Array of store/department codes from enprotec_departments table. Changed from department[] ENUM to TEXT[] to support dynamic department management.';
