-- ============================================================================
-- FIX ALL DATABASE ISSUES - Run This Once
-- ============================================================================
-- This fixes RLS policies and ensures all operations work
-- ============================================================================

-- 1. Fix RLS on en_workflow_requests to allow updates
DROP POLICY IF EXISTS "Allow authenticated users to update workflow requests" ON public.en_workflow_requests;
CREATE POLICY "Allow authenticated users to update workflow requests"
ON public.en_workflow_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Fix RLS on en_workflow_requests to allow inserts
DROP POLICY IF EXISTS "Allow authenticated users to insert workflow requests" ON public.en_workflow_requests;
CREATE POLICY "Allow authenticated users to insert workflow requests"
ON public.en_workflow_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Fix RLS on en_workflow_items
DROP POLICY IF EXISTS "Allow authenticated users to manage workflow items" ON public.en_workflow_items;
CREATE POLICY "Allow authenticated users to manage workflow items"
ON public.en_workflow_items
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Fix RLS on en_workflow_comments
DROP POLICY IF EXISTS "Allow authenticated users to manage comments" ON public.en_workflow_comments;
CREATE POLICY "Allow authenticated users to manage comments"
ON public.en_workflow_comments
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Ensure stock receipts view has proper SELECT access
GRANT SELECT ON public.en_stock_receipts_view TO authenticated;

-- 6. Ensure workflows view has proper SELECT access
GRANT SELECT ON public.en_workflows_view TO authenticated;

-- 7. Fix stock_receipts table RLS
DROP POLICY IF EXISTS "Allow authenticated users to view stock receipts" ON public.en_stock_receipts;
CREATE POLICY "Allow authenticated users to view stock receipts"
ON public.en_stock_receipts
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to insert stock receipts" ON public.en_stock_receipts;
CREATE POLICY "Allow authenticated users to insert stock receipts"
ON public.en_stock_receipts
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Fix inventory table RLS
DROP POLICY IF EXISTS "Allow authenticated users to view inventory" ON public.en_inventory;
CREATE POLICY "Allow authenticated users to view inventory"
ON public.en_inventory
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated users to update inventory" ON public.en_inventory;
CREATE POLICY "Allow authenticated users to update inventory"
ON public.en_inventory
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 9. Verify all tables have RLS enabled
ALTER TABLE public.en_workflow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.en_workflow_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.en_workflow_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.en_stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.en_inventory ENABLE ROW LEVEL SECURITY;

SELECT '✅ All RLS policies fixed - system should work now' as status;
