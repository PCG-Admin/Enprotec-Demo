-- Migration: Convert Inventory Store Column from ENUM to TEXT
-- Date: 2026-01-20
-- Description: Converts enprotec_inventory.store from store_type ENUM to TEXT to support dynamic stores.
--              This allows inventory to be tracked for any store defined in enprotec_departments table.

-- Step 1: Convert enprotec_inventory.store from ENUM to TEXT
ALTER TABLE public.enprotec_inventory ADD COLUMN store_temp TEXT;

-- Copy existing values as text
UPDATE public.enprotec_inventory SET store_temp = store::text;

-- Drop the old ENUM column (this will cascade to views if any reference it)
ALTER TABLE public.enprotec_inventory DROP COLUMN store CASCADE;

-- Rename temp column to store
ALTER TABLE public.enprotec_inventory RENAME COLUMN store_temp TO store;

-- Make it NOT NULL
ALTER TABLE public.enprotec_inventory ALTER COLUMN store SET NOT NULL;

-- Add foreign key constraint to enprotec_departments
ALTER TABLE public.enprotec_inventory
ADD CONSTRAINT fk_inventory_store
FOREIGN KEY (store) REFERENCES public.enprotec_departments(code)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_en_inventory_store ON public.enprotec_inventory(store);

-- Step 2: Update enprotec_stock_view to work with TEXT store column
-- Recreate the view to handle the new TEXT type
CREATE OR REPLACE VIEW public.enprotec_stock_view AS
SELECT
    si.id,
    si.part_number AS "partNumber",
    si.description,
    si.category,
    COALESCE(inv.quantity_on_hand, 0) AS "quantityOnHand",
    si.min_stock_level AS "minStockLevel",
    inv.store,
    COALESCE(inv.location, 'N/A') AS location,
    inv.site_id
FROM public.enprotec_stock_items si
LEFT JOIN public.enprotec_inventory inv ON si.id = inv.stock_item_id;

-- Step 3: Drop the store_type ENUM (no longer needed)
DROP TYPE IF EXISTS public.store_type CASCADE;

-- Add comment explaining the change
COMMENT ON COLUMN public.enprotec_inventory.store IS 'Store code from enprotec_departments table. Changed from store_type ENUM to TEXT to support dynamic store management.';
