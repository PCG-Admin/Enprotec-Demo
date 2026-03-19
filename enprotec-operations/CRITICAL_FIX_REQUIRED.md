# CRITICAL: Department Code Fix Required

## Issue Detected

The system is showing this error:
```
invalid input value for enum store_type: "MSatellite"
```

## Root Cause

Someone modified a department code in the **Stores Management** page (likely changed "Satellite" to "MSatellite"). This breaks inventory queries because:

- The `en_inventory.store` column uses a PostgreSQL ENUM type with fixed values: `OEM`, `Operations`, `Projects`, `SalvageYard`, `Satellite`
- The `en_departments.code` column is TEXT and was editable
- When department codes don't match ENUM values, inventory queries fail

## Immediate Fix Required

### Step 1: Run Migration 5

Run the 5th migration to fix invalid codes and prevent future modifications:

```bash
# Run this in your Supabase SQL Editor or via CLI
```

**Migration File:** `supabase/migrations/20260120_fix_department_codes.sql`

**What It Does:**
- ✅ Fixes any invalid department codes back to valid values (e.g., "MSatellite" → "Satellite")
- ✅ Adds database trigger to prevent modification of core 5 department codes
- ✅ Adds validation constraint for new department codes
- ✅ Protects system integrity going forward

### Step 2: Frontend Changes Applied

The Departments component has been updated to:
- ✅ Disable code editing for the 5 core system stores (OEM, Operations, Projects, SalvageYard, Satellite)
- ✅ Show warning message: "⚠️ Code locked - core system store"
- ✅ Display tooltip explaining why code cannot be modified

## Why This Matters

### The 5 Core Department Codes Are System-Critical:

1. **OEM** - Must match `store_type` ENUM for inventory queries
2. **Operations** - Must match `store_type` ENUM for inventory queries
3. **Projects** - Must match `store_type` ENUM for inventory queries
4. **SalvageYard** - Must match `store_type` ENUM for inventory queries
5. **Satellite** - Must match `store_type` ENUM for inventory queries

### Impact of Invalid Codes:

- ❌ **Stock Management page fails** - Cannot query inventory
- ❌ **Stock Intake forms fail** - Cannot save stock to store
- ❌ **Workflow requests fail** - Cannot filter by department
- ❌ **Reports fail** - Cannot aggregate by store
- ❌ **User department assignments fail** - Cannot validate assignments

## What's Safe to Edit

After Migration 5, here's what you CAN and CANNOT edit:

### ✅ CAN Edit (Safe):
- Department **names** (e.g., "OEM" → "OEM Parts Store") - name changes are safe
- Department **descriptions** - fully editable
- Department **status** (Active/Frozen) - safe to toggle
- **New departments** - can add with any code (but must follow naming convention)

### ❌ CANNOT Edit (Protected):
- Code for **OEM** - locked
- Code for **Operations** - locked
- Code for **Projects** - locked
- Code for **SalvageYard** - locked
- Code for **Satellite** - locked

These 5 codes are now **immutable** at the database level. Any attempt to modify them will be rejected with:
```
Cannot modify code for core system store: [code]
HINT: Core system store codes must remain unchanged to maintain compatibility with inventory ENUM type.
```

## Testing After Fix

After running Migration 5:

1. **Verify Stock Management Loads:**
   - Navigate to Stock Management
   - Should see no "400 Bad Request" errors
   - All store tabs should work (OEM, Operations, Projects, etc.)

2. **Verify Store Editing:**
   - Go to Stores Management (Admin only)
   - Try to edit a core store (e.g., "OEM")
   - Code field should be **disabled** with gray background
   - Should show: "⚠️ Code locked - core system store"

3. **Verify You Can Still Edit Names:**
   - Edit "OEM" store
   - Change **name** from "OEM" to "OEM Parts Department"
   - Should save successfully
   - Code remains "OEM" (unchanged)

4. **Verify New Stores Work:**
   - Create a new store: "Dubai Warehouse" with code "DubaiWarehouse"
   - Should save successfully
   - **Note:** New stores won't have inventory until you create them in the `store_type` ENUM (future enhancement)

## Future Enhancement (Optional)

To fully support dynamic stores for inventory, we would need to:

1. Convert `en_inventory.store` from ENUM to TEXT
2. Add foreign key: `en_inventory.store` → `en_departments.code`
3. Update all inventory queries to use TEXT instead of ENUM
4. This is a larger change and not included in current scope

For now, the 5 core stores cover the existing business needs, and new stores can be added for workflow requests (just not inventory tracking yet).

## Migration Status

- ✅ Migration 1: Create departments table - **COMPLETED**
- ✅ Migration 2: Convert ENUM to TEXT - **COMPLETED**
- ✅ Migration 3: Recreate user departments - **COMPLETED**
- ✅ Migration 4: Recreate views - **COMPLETED**
- ⏳ **Migration 5: Fix department codes** - **READY TO RUN** ← YOU ARE HERE

## Summary

**Before Migration 5:**
- Department codes could be edited freely
- Editing core codes broke inventory queries
- System showed 400 errors on Stock Management

**After Migration 5:**
- Core 5 codes are **immutable** (database-enforced)
- Frontend prevents editing (visual indicator)
- Inventory queries work correctly
- New stores can be added safely

**Action Required:** Run Migration 5 now to fix the system!
