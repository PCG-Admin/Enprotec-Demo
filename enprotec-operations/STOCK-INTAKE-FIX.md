# Stock Intake Fix - Database Migration Required

## Problem Fixed
The stock intake feature was showing "an unexpected error occurred" because two required database functions were missing:
- `process_stock_intake` - Handles stock receipts atomically
- `process_stock_request` - Handles stock requests atomically

Console errors showed:
```
Failed to load resource: the server responded with a status of 404
eplxpejktfgnivbwtpes.supabase.co/rest/v1/rpc/process_stock_intake
```

## Solution Applied
Created two SQL migration files with the required RPC functions:
1. `supabase/migrations/20260121_create_stock_intake_rpc.sql`
2. `supabase/migrations/20260121_create_stock_request_rpc.sql`

Also improved error handling to show user-friendly messages instead of generic errors.

---

## How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref eplxpejktfgnivbwtpes
   ```

4. **Run the migrations**:
   ```bash
   supabase db push
   ```

This will apply all pending migrations to your production database.

---

### Option 2: Manual SQL Execution via Supabase Dashboard

If the CLI doesn't work, run these SQL scripts manually:

1. **Go to Supabase Dashboard** → SQL Editor

2. **Run the first migration** - Copy and paste the entire content from:
   `supabase/migrations/20260121_create_stock_intake_rpc.sql`

   Then click "Run"

3. **Run the second migration** - Copy and paste the entire content from:
   `supabase/migrations/20260121_create_stock_request_rpc.sql`

   Then click "Run"

---

## Verification

After running the migrations, test the stock intake feature:

1. Login to the system
2. Navigate to Stock Management
3. Click "Stock Receipt" (or similar button to open stock intake form)
4. Fill in the form and submit
5. You should see a success message instead of an error

---

## What the Migrations Do

### `process_stock_intake` Function
- Creates or updates inventory records atomically
- Prevents race conditions when multiple users submit stock receipts
- Creates stock receipt records
- Handles returns from rejected deliveries
- Updates workflow status if it's a return

### `process_stock_request` Function
- Creates workflow requests atomically
- Builds item details with current stock levels
- Handles initial comments
- Prevents duplicate request numbers
- Validates requester is active

Both functions return JSON with `{ success: boolean, error?: string }` format for proper error handling.

---

## Error Message Improvements

The StockIntakeForm now shows specific messages:
- ❌ Generic: "An unexpected error occurred"
- ✅ Specific: "Stock intake system is currently unavailable. Please contact your administrator."
- ✅ Specific: "Part number 'ABC123' already exists in the system. Use the 'Existing Part' option instead."
- ✅ Specific: "File upload failed. Please check your file and try again."
- ✅ Specific: "The selected item could not be found. Please refresh and try again."

---

## Files Changed

1. **New Migrations:**
   - `supabase/migrations/20260121_create_stock_intake_rpc.sql`
   - `supabase/migrations/20260121_create_stock_request_rpc.sql`

2. **Updated Components:**
   - `components/forms/StockIntakeForm.tsx` - Improved error handling

---

## Need Help?

If you encounter any issues:
1. Check the Supabase logs in Dashboard → Logs
2. Verify the functions were created: Dashboard → Database → Functions
3. Check that the migrations table shows both new entries: `SELECT * FROM supabase_migrations.schema_migrations;`

---

**Created:** 2026-01-21
**Status:** Ready to deploy
**Priority:** HIGH - Blocks stock intake functionality
