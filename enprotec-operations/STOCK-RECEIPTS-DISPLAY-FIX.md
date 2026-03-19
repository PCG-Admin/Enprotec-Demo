# Stock Receipts Display Fix

## Issue
Stock intake was working correctly, but newly created stock receipts were not appearing in the Stock Receipts view (Reports page).

## Root Cause
The `en_stock_receipts_view` was missing the `store` column, but the `StockReceipts` component was attempting to filter results by store/department. This caused the query to fail silently, resulting in no receipts being displayed.

**Technical Details:**
- `StockReceipts.tsx` queries from `en_stock_receipts_view`
- Component filters by store for non-admin users: `query.in('store', visibleStores)`
- View definition did not include a `store` column
- Result: Query failed silently, no receipts displayed

## Solution
1. **Add `store` column to `en_stock_receipts` table** - Stock receipts should record which department/store received the stock
2. **Backfill existing data** - Update existing receipts with store information from inventory records
3. **Update view** - Include `store` column in `en_stock_receipts_view`
4. **Update RPC function** - Modify `process_stock_intake` to save the store parameter

## Files Modified

### Database Migrations
- `supabase/migrations/20260122_update_stock_receipts_view_with_store.sql` - Adds store column and updates view
- `supabase/migrations/20260122_update_process_stock_intake_with_store.sql` - Updates RPC function

### Emergency Fix Script
- `FIX_STOCK_RECEIPTS_DISPLAY.sql` - Comprehensive fix script to run in Supabase SQL Editor
- `EMERGENCY_FIX_STOCK_INTAKE.sql` - Updated to include store column

## Deployment Steps

### Option 1: Run Emergency Fix (Recommended for Immediate Fix)
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste contents of `FIX_STOCK_RECEIPTS_DISPLAY.sql`
4. Run the script
5. Verify output shows success messages
6. Refresh the Stock Receipts page in your app

### Option 2: Run Individual Migrations
1. Run migrations in order:
   ```bash
   # Apply migrations via Supabase CLI
   supabase db push
   ```

## Verification

After running the fix:

1. **Check database:**
   ```sql
   -- Verify store column exists
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'en_stock_receipts' AND column_name = 'store';

   -- Verify receipts have store assigned
   SELECT COUNT(*) as total_receipts,
          COUNT(store) as receipts_with_store
   FROM public.en_stock_receipts;
   ```

2. **Test in UI:**
   - Navigate to Stock Receipts page
   - Verify previously created receipts are now visible
   - Create a new stock intake
   - Confirm new receipt appears immediately in the list

3. **Test filtering:**
   - Log in as non-admin user with specific departments
   - Verify only receipts for their departments are shown
   - Log in as admin
   - Verify all receipts are visible

## Expected Behavior After Fix

### For Admin Users:
- See ALL stock receipts regardless of store/department
- Can create new receipts for any department
- Receipts appear immediately after creation

### For Non-Admin Users:
- See only receipts for stores/departments they have access to
- Can create receipts for their assigned departments
- Receipts appear immediately after creation

## Database Schema Changes

### en_stock_receipts table
**Added column:**
- `store` (TEXT) - Records which department/store received the stock

**Added index:**
- `idx_en_stock_receipts_store` - Improves query performance when filtering by store

### en_stock_receipts_view
**Updated columns:**
```sql
- id
- stockItemId
- partNumber
- description
- quantityReceived
- receivedBy
- receivedAt
- deliveryNotePO
- comments
- attachmentUrl
- store (NEW)
```

### process_stock_intake function
**Updated INSERT statement:**
Now includes `store` parameter when creating stock receipt records.

## Rollback Plan

If issues occur after deployment:

1. **Remove store filter from UI (temporary workaround):**
   - Comment out lines 33-38 in `components/StockReceipts.tsx`
   - This will show all receipts to all users (no filtering)

2. **Revert database changes:**
   ```sql
   -- Remove store column (will lose store tracking)
   ALTER TABLE public.en_stock_receipts DROP COLUMN IF EXISTS store;

   -- Revert view to original
   CREATE OR REPLACE VIEW public.en_stock_receipts_view AS
   SELECT
       sr.id,
       sr.stock_item_id AS "stockItemId",
       si.part_number AS "partNumber",
       si.description,
       sr.quantity_received AS "quantityReceived",
       u.name AS "receivedBy",
       sr.received_at AS "receivedAt",
       sr.delivery_note_po AS "deliveryNotePO",
       sr.comments,
       sr.attachment_url AS "attachmentUrl"
   FROM public.en_stock_receipts sr
   JOIN public.en_stock_items si ON sr.stock_item_id = si.id
   JOIN public.en_users u ON sr.received_by_id = u.id;
   ```

## Related Files
- `components/StockReceipts.tsx` - UI component that displays stock receipts
- `components/forms/StockIntakeForm.tsx` - Form for creating stock receipts
- `services/stockService.ts` - Service layer for RPC calls
- `types.ts` - TypeScript type definitions

## Testing Results

✅ Stock intake creates receipt with store information
✅ Receipt appears immediately in Stock Receipts view
✅ Admin users see all receipts
✅ Non-admin users see only their department's receipts
✅ Existing receipts backfilled with store data
✅ Query performance improved with index

## Notes
- Existing receipts were backfilled by matching stock_item_id with inventory records
- If a stock item exists in multiple stores, the most recently updated inventory record was used for backfill
- Future receipts will have the correct store assigned automatically
- The store column is nullable to handle edge cases where store information might be unavailable
