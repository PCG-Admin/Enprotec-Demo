-- ============================================================================
-- FIX STORE_TYPE ENUM - Create missing enum type
-- ============================================================================
-- The database is referencing store_type enum but it doesn't exist
-- This creates the missing enum type
-- ============================================================================

-- Create the store_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.store_type AS ENUM ('OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite');
    RAISE NOTICE 'Created store_type enum';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'store_type enum already exists, skipping';
END $$;

-- Verify the enum was created
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'store_type'
ORDER BY enumlabel;

SELECT '✅ store_type enum fixed' as status;
