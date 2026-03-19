# Workflow Approval Permissions Fix

## Problems Fixed

### Problem 1: "Everyone Can Approve" ❌
**Root Cause**: RLS policies allowed ANY authenticated user to update workflows
- Database policy: `USING (auth.uid() IS NOT NULL)` - no role or site checks
- Result: Users could bypass frontend and directly call API to approve

### Problem 2: Ops Manager Could Approve Everything ❌
**Root Cause**: Frontend approval logic had `|| isOpsManager` on every step
- Equipment Manager approval: `if (role === EquipmentManager || isAdmin || isOpsManager)`
- Picking: `if (role === StockController || isAdmin || isOpsManager)`
- Dispatch: `if (role === Security || Driver || isAdmin || isOpsManager)`
- EPOD: `if (role === Driver || SiteManager || isAdmin || isOpsManager)`
- Result: Ops Manager could approve ALL steps in ANY workflow

### Problem 3: No Site-Specific Role Verification ❌
**Root Cause**: Only checked if user had access to site, not if they had correct role FOR that site
- Result: ANY Ops Manager could approve requests for ANY site they had access to

## The Fix

### Part 1: Database RLS Policies (CRITICAL)

**File**: `supabase/migrations/20260127_fix_approval_permissions.sql`

#### SELECT Policy - Site-Based Viewing
```sql
-- Users can ONLY see workflows for sites they're assigned to
site_id = ANY(user.sites)
OR requester_id = auth.uid()
OR user.role = 'Admin'
```

#### UPDATE Policy - Strict Role + Site Checks
```sql
-- User must have:
-- 1. Site access (workflow.site_id in user.sites)
-- 2. Correct role for current workflow status

Examples:
- "Request Submitted" → ONLY Operations Manager (for that site)
- "Awaiting Ops Manager" → ONLY Stock Controller (for that site)
- "Awaiting Equip. Manager" → ONLY Equipment Manager (for that site)
- etc.
```

**Enforcement**: Database will reject updates if user doesn't match role AND site requirements.

### Part 2: Frontend Code

**File**: `components/WorkflowDetailModal.tsx`

**Changes**:
- Removed `|| isOpsManager` from all approval checks except "Request Submitted"
- Each step now ONLY allows the specific role required:
  - Line 93-96: Request Submitted → Ops Manager ONLY
  - Line 97-100: Awaiting Ops Manager → Stock Controller ONLY
  - Line 102-105: Awaiting Equip. Manager → Equipment Manager ONLY
  - Line 107-110: Awaiting Picking → Stock Controller or Storeman ONLY
  - Line 112-115: Picked & Loaded → Security or Driver ONLY
  - Line 117-120: Dispatched → Driver or Site Manager ONLY

**Site Access**: Already enforced via `hasSiteAccess` check at line 63-67.

### Part 3: Helper Function (Optional)

**Function**: `can_user_approve_workflow(workflow_id, user_id)`

Returns `true/false` if user can approve a specific workflow.

Can be used in frontend for additional validation:
```typescript
const { data } = await supabase.rpc('can_user_approve_workflow', {
    p_workflow_id: workflow.id,
    p_user_id: user.id
});

if (!data) {
    // Hide approve button
}
```

## Approval Flow - Correct Roles

| Status | Who Can Approve | What They See |
|--------|-----------------|---------------|
| Request Submitted | Operations Manager (for that site) | "Approve (Ops Manager)" button |
| Awaiting Ops Manager | Stock Controller (for that site) | "Approve (Stock Controller)" button |
| Awaiting Equip. Manager | Equipment Manager (for that site) | "Approve (Equip. Manager)" button |
| Awaiting Picking | Stock Controller or Storeman (for that site) | "Mark as Picked & Loaded" button |
| Picked & Loaded | Security or Driver (for that site) | "Confirm Gate Release & Dispatch" button |
| Dispatched | Driver or Site Manager (for that site) | "Confirm Delivery (EPOD)" button |

**Admin Exception**: Admin can approve ANY step for ANY site.

## Site Filtering

### Workflows Page
- ALL users can access the page
- Each user ONLY sees workflows for sites they're assigned to
- Database enforces this via RLS SELECT policy

### Workflow Detail Modal
- User can view if workflow site is in their `sites` array
- User can approve ONLY if:
  1. Workflow site is in their `sites` array (site access)
  2. Their role matches the required role for current status (role check)

## How to Apply

### Step 1: Run Database Migration (REQUIRED)

1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/eplxpejktfgnivbwtpes/sql/new

2. Copy and run: `supabase/migrations/20260127_fix_approval_permissions.sql`

3. Wait for success message

### Step 2: Frontend Changes (ALREADY DONE)

✅ `components/WorkflowDetailModal.tsx` has been updated with strict role checks

Just reload your app!

### Step 3: Test

See testing checklist below.

## Testing Checklist

### Test 1: Site-Based Viewing
1. Login as Ops Manager assigned to Site A only
2. Go to Workflows page
3. ✅ Should see ONLY workflows for Site A
4. ❌ Should NOT see workflows for Site B or Site C

### Test 2: Ops Manager Approval Scope
1. Login as Ops Manager
2. Open a workflow at "Request Submitted" status
3. ✅ Should see "Approve (Ops Manager)" button
4. Click approve
5. Workflow moves to "Awaiting Ops Manager"
6. ❌ Should NO LONGER see approve button (different role required now)

### Test 3: Equipment Manager Can't Approve Wrong Steps
1. Login as Equipment Manager
2. Open a workflow at "Request Submitted" status
3. ❌ Should NOT see approve button (requires Ops Manager)
4. Open a workflow at "Awaiting Equip. Manager"
5. ✅ Should see "Approve (Equip. Manager)" button

### Test 4: Site Access Required
1. Login as Ops Manager assigned to Site A
2. Try to open/approve a workflow for Site B
3. ❌ Should NOT see workflow in list
4. ❌ If accessed via direct link, should get "You are not allowed to action requests for this site" error

### Test 5: Stock Controller Role
1. Login as Stock Controller
2. Open workflow at "Awaiting Ops Manager"
3. ✅ Should see "Approve (Stock Controller)" button
4. Open workflow at "Request Submitted"
5. ❌ Should NOT see approve button

### Test 6: Admin Override
1. Login as Admin
2. ✅ Should see ALL workflows for ALL sites
3. ✅ Should be able to approve ANY step

## Expected Behavior After Fix

✅ **Workflows Page**: All users can view, filtered by their sites
✅ **Ops Manager**: Can ONLY approve "Request Submitted" step
✅ **Equipment Manager**: Can ONLY approve "Awaiting Equip. Manager" step
✅ **Stock Controller**: Can ONLY approve "Awaiting Ops Manager" and "Awaiting Picking" steps
✅ **Site Access**: Enforced at database level - can't bypass via API
✅ **Role Enforcement**: Database rejects updates if role doesn't match

❌ **No More**: Ops Manager approving every step
❌ **No More**: Users seeing workflows for sites they're not assigned to
❌ **No More**: Bypassing frontend checks via direct API calls

## Rollback (if needed)

If issues occur, you can rollback the RLS policies:

```sql
-- Remove strict policies
DROP POLICY IF EXISTS "site_based_select_workflow_requests" ON public.en_workflow_requests;
DROP POLICY IF EXISTS "role_site_based_update_workflow_requests" ON public.en_workflow_requests;

-- Restore permissive policy (NOT RECOMMENDED)
CREATE POLICY "authenticated_update_workflow_requests"
ON public.en_workflow_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);
```

But this will bring back the "everyone can approve" problem!

## Summary

- **Security Level**: High - Database enforces permissions
- **Scope**: Site-based + Role-based access control
- **Impact**: Fixes reported issue where "everyone can approve"
- **Risk**: Low - policies are additive, can be rolled back
- **Testing**: Critical - test each role thoroughly

**This is a critical security fix!** Run it ASAP to prevent unauthorized approvals.
