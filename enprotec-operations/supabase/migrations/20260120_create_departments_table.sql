-- Migration: Create Departments Table for Dynamic Store/Department Management
-- Date: 2026-01-20
-- Description: Creates enprotec_departments table to replace hardcoded Store enum values
--              with database-driven department management while maintaining full
--              backward compatibility with existing workflows and stock levels.

-- Create or replace the set_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create departments table with UUID primary key
CREATE TABLE IF NOT EXISTS public.enprotec_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE, -- Short code matching enum values (OEM, Operations, etc.)
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Frozen')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on code for fast lookups (use IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_en_departments_code ON public.enprotec_departments(code);
CREATE INDEX IF NOT EXISTS idx_en_departments_status ON public.enprotec_departments(status);
CREATE INDEX IF NOT EXISTS idx_en_departments_name ON public.enprotec_departments(name);

-- Enable Row Level Security
ALTER TABLE public.enprotec_departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Anyone can view departments" ON public.enprotec_departments;
DROP POLICY IF EXISTS "Admins can insert departments" ON public.enprotec_departments;
DROP POLICY IF EXISTS "Admins can update departments" ON public.enprotec_departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON public.enprotec_departments;

-- RLS Policy: Anyone can view departments
CREATE POLICY "Anyone can view departments" ON public.enprotec_departments
    FOR SELECT USING (true);

-- RLS Policy: Only admins can insert departments
CREATE POLICY "Admins can insert departments" ON public.enprotec_departments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.enprotec_users
            WHERE id = auth.uid() AND role = 'Admin' AND status = 'Active'
        )
    );

-- RLS Policy: Only admins can update departments
CREATE POLICY "Admins can update departments" ON public.enprotec_departments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.enprotec_users
            WHERE id = auth.uid() AND role = 'Admin' AND status = 'Active'
        )
    );

-- RLS Policy: Only admins can delete departments
CREATE POLICY "Admins can delete departments" ON public.enprotec_departments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.enprotec_users
            WHERE id = auth.uid() AND role = 'Admin' AND status = 'Active'
        )
    );

-- Seed with current department values (matching existing Store enum)
-- Using ON CONFLICT to make migration idempotent
INSERT INTO public.enprotec_departments (code, name, description) VALUES
    ('OEM', 'OEM', 'OEM Parts and Components'),
    ('Operations', 'Operations', 'Operations Department'),
    ('Projects', 'Projects', 'Project-specific Materials'),
    ('SalvageYard', 'Salvage Yard', 'Salvage and Recovery'),
    ('Satellite', 'Satellite', 'Satellite Location Storage')
ON CONFLICT (code) DO NOTHING;

-- Add updated_at trigger (drop first if exists to avoid conflicts)
DROP TRIGGER IF EXISTS set_updated_at_en_departments ON public.enprotec_departments;
CREATE TRIGGER set_updated_at_en_departments
    BEFORE UPDATE ON public.enprotec_departments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Add comment explaining table purpose
COMMENT ON TABLE public.enprotec_departments IS 'Stores/Departments table for dynamic management. Replaces hardcoded Store enum while maintaining backward compatibility via code field.';
COMMENT ON COLUMN public.enprotec_departments.code IS 'Short code matching Store enum values (e.g., OEM, Operations). Used for backward compatibility with existing workflow_requests.department values.';
COMMENT ON COLUMN public.enprotec_departments.status IS 'Active departments appear in dropdowns. Frozen departments are hidden but existing references remain valid.';
