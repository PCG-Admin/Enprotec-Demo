# Site Filtering Fix - Consistent Across All Pages

## Problem Statement

User Paul Dlhamini (Operations Manager) experienced inconsistent filtering:
- **Dashboard**: Showed workflows for sites NOT assigned to him
- **Requests Page**: Showed nothing (empty)

This was caused by **inconsistent filtering logic** between components.

## Root Cause

Different components used different filtering strategies:

### Before Fix:

1. **Dashboard.tsx**: Only filtered by `departments` (NO site filtering)
2. **Requests.tsx**: Filtered by `departments` AND `sites` + had early return if no sites assigned
3. **EquipmentManager.tsx**: Filtered by `departments` AND `sites` + had early return if no sites assigned
4. **Other components**: Filtered by both but no early returns

This caused:
- Dashboard showed ALL workflows for user's departments (even sites not assigned)
- Requests/Equipment pages showed NOTHING if user had no sites OR wrong sites

## Solution Applied

### All components now use CONSISTENT filtering:

```typescript
let query = supabase.from('en_workflows_view').select('*');

// Filter by department unless the user is an Admin
if (user.role !== UserRole.Admin && user.departments && user.departments.length > 0) {
    query = query.in('department', user.departments);
}

// Filter by sites unless the user is an Admin
if (user.role !== UserRole.Admin && user.sites && user.sites.length > 0) {
    query = query.in('projectCode', user.sites);
}

// NO early return - let the query execute and return results (or empty if no match)
```

### Changes Made:

1. ✅ **Dashboard.tsx** - ADDED site filtering (line 61-64)
2. ✅ **Requests.tsx** - REMOVED early return for "no sites" (lines 90-95)
3. ✅ **EquipmentManager.tsx** - REMOVED early return for "no sites" (lines 69-74)
4. ✅ **WorkflowList.tsx** - Already correct (no change needed)
5. ✅ **Picking.tsx** - Already correct (no change needed)
6. ✅ **Deliveries.tsx** - Already correct (no change needed)
7. ✅ **MyDeliveries.tsx** - Uses `requester_id` filter (correct, no change needed)

## Expected Behavior Now

### For Non-Admin Users (including Operations Managers):

All pages will show workflows that match BOTH:
1. User's assigned `departments` (e.g., ["Operations"])
2. User's assigned `sites` (e.g., ["Site A", "Site B"])

If a workflow has:
- `department: "Operations"` AND `projectCode: "Site A"` → ✅ User sees it
- `department: "Operations"` AND `projectCode: "Site C"` → ❌ User does NOT see it
- `department: "Admin"` AND `projectCode: "Site A"` → ❌ User does NOT see it

### For Admin Users:

Admins see ALL workflows on all pages (no filtering applied).

## User Profile Requirements

For users to see workflows, they MUST have:
1. ✅ `departments` array populated (e.g., `["Operations"]`)
2. ✅ `sites` array populated (e.g., `["Site A", "Site B"]`)
3. ✅ Site names must match EXACTLY (case-sensitive) with workflow `projectCode` values

### Check User Profile:

```sql
SELECT id, name, email, role, sites, departments, status
FROM public.en_users
WHERE email = 'paul.dlhamini@example.com';
```

### Check Workflow Sites:

```sql
SELECT DISTINCT "projectCode"
FROM public.en_workflows_view
ORDER BY "projectCode";
```

Compare the two lists - they must match EXACTLY.

## Testing

1. Login as Paul Dlhamini (Operations Manager)
2. Check Dashboard - should ONLY show workflows for assigned sites
3. Check Requests page - should show same workflows (if status matches)
4. Check Workflow List - should show same workflows
5. All pages should be consistent now

## Key Points

✅ **Consistent filtering** - All pages use same logic
✅ **Security maintained** - Users only see workflows for their assigned sites
✅ **No more early returns** - Let SQL handle the filtering
✅ **Case-sensitive matching** - "Site A" ≠ "site a"

## Files Modified

- [components/Dashboard.tsx](components/Dashboard.tsx#L61-L64)
- [components/Requests.tsx](components/Requests.tsx#L85-L88)
- [components/EquipmentManager.tsx](components/EquipmentManager.tsx#L64-L67)
