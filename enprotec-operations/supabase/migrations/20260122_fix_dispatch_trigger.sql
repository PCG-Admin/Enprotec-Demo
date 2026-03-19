-- ============================================================================
-- FIX DISPATCH TRIGGER - Remove store_type enum references
-- ============================================================================
-- The trigger function is using store_type enum which doesn't exist
-- Since store is now a TEXT field, we don't need the enum type
-- ============================================================================

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_dispatch_trigger ON public.enprotec_workflow_requests;

-- Recreate the function without store_type enum
CREATE OR REPLACE FUNCTION public.on_dispatch_deduct_stock()
RETURNS TRIGGER AS $$
DECLARE
    item_record RECORD;
    target_store TEXT;  -- Changed from public.store_type to TEXT
BEGIN
    IF NEW.current_status = 'Dispatched' AND OLD.current_status != 'Dispatched' THEN
        -- Store department value directly as TEXT (no casting needed)
        target_store := NEW.department;

        IF target_store IS NOT NULL THEN
            FOR item_record IN
                SELECT stock_item_id, quantity_requested
                FROM public.enprotec_workflow_items
                WHERE workflow_request_id = NEW.id
            LOOP
                -- Update inventory: direct TEXT comparison, no enum cast
                UPDATE public.enprotec_inventory
                SET quantity_on_hand = quantity_on_hand - item_record.quantity_requested
                WHERE stock_item_id = item_record.stock_item_id
                AND store = target_store
                AND (site_id = NEW.site_id OR site_id IS NULL);
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER on_dispatch_trigger
AFTER UPDATE ON public.enprotec_workflow_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_dispatch_deduct_stock();

-- Success message
SELECT '✅ Dispatch trigger fixed - store_type enum removed' as status;
