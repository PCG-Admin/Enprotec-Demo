-- Migration: Fix Overly Aggressive Department Deletion in Migration 5
-- Date: 2026-01-20
-- Description: Removes the DELETE statement from Migration 5 that was deleting legitimate new departments.
--              Migration 5 was incorrectly deleting departments with codes starting with 'M'.

-- This migration does NOT delete anything - it's a safeguard for future migrations
-- The damage from Migration 5 has already occurred, so we need to ensure new departments stay

-- IMPORTANT: This migration is safe to run and does not modify existing data
-- It serves as documentation that the DELETE in Migration 5 should not be re-run

-- If you need to clean up invalid department codes in the future, use this pattern:
-- DELETE FROM public.enprotec_departments
-- WHERE code IN ('exact_invalid_code_1', 'exact_invalid_code_2');

COMMENT ON TABLE public.enprotec_departments IS
'Store/Department table for dynamic department management.
WARNING: Do not run bulk DELETE operations on this table based on code patterns.
Only delete specific invalid codes by exact match to avoid removing legitimate departments.';
