# Operations Manager Visibility Issue - Root Cause Analysis

## Problem Statement

Operations Manager user can see workflows on the **Dashboard** page but NOT on the **Requests** page.

## Root Cause

The two pages use **different filtering logic**:

### Dashboard.tsx (Line 56-58)
```typescript
let workflowsQuery = supabase.from('en_workflows_view').select('*');
if (!isAdmin && userStores.length > 0) {
    workflowsQuery = workflowsQuery.in('department', userStores);
}
```
**Filters by:** `departments` ONLY (NO site filtering)

### Requests.tsx (Line 85-94)
```typescript
// Filter by department unless the user is an Admin
if (user.role !== UserRole.Admin && user.departments && user.departments.length > 0) {
    requestsQuery = requestsQuery.in('department', user.departments);
}

// Filter by sites unless the user is an Admin
if (user.role !== UserRole.Admin && user.sites && user.sites.length > 0) {
    requestsQuery = requestsQuery.in('projectCode', user.sites);
}

// If non-admin user has no sites assigned, they cannot see any requests
if (user.role !== UserRole.Admin && (!user.sites || user.sites.length === 0)) {
    setRequests([]);
    setLoading(false);
    return;
}
```
**Filters by:** `departments` AND `sites` (BOTH required)

## Why This Happens

The Operations Manager user likely has:
- ✅ **Departments assigned** → Can see workflows on Dashboard
- ❌ **NO sites assigned** OR **Wrong sites assigned** → Cannot see workflows on Requests page

## Diagnosis Steps

### Option 1: Browser Console Debug (Easiest)

1. Login as the Operations Manager user
2. Open browser DevTools (F12)
3. Go to Console tab
4. Copy and paste the contents of `debug-ops-manager-browser.js`
5. Press Enter
6. Review the output to see:
   - What sites and departments are assigned to the user
   - How many workflows match each query
   - Which workflows match department but NOT site

### Option 2: Database Query Debug

1. Open Supabase SQL Editor
2. Run the queries in `debug-ops-manager-detailed.sql`
3. Check **PART 1** to see what sites are assigned to the Operations Manager user
4. Check **PART 3** to see what `projectCode` values exist on workflows
5. Compare the two lists to see if they match (case-sensitive)

## Solution

### If User Has NO Sites Assigned:

1. Go to Users management page in the application
2. Find and edit the Operations Manager user
3. Assign the appropriate sites (must match the `projectCode` values on workflows)
4. Save
5. Have the user logout and login again
6. Refresh the Requests page

### If User Has Sites but Still Can't See Workflows:

Check for **case mismatch** or **name mismatch**:

**Example Problem:**
- User has sites: `["site a", "site b"]`
- Workflows have projectCode: `["Site A", "Site B"]`
- **Result**: NO MATCH (case-sensitive comparison)

**Solution:**
1. Run the SQL debug script to see exact site names
2. Update the user's sites to match EXACTLY (including case)
3. OR update the workflow projectCode values to match the user's sites

## Why Dashboard Shows Workflows

Dashboard only filters by `departments`, so if the user has departments assigned (e.g., `["Operations"]`), they will see ALL workflows for those departments regardless of site.

This is actually correct behavior for the Dashboard - it's meant to show a high-level overview.

The Requests page is where users ACT on workflows, so it correctly enforces BOTH department AND site filtering for security.

## Design Decision Confirmation

✅ **Correct Behavior:**
- Admin sees ALL workflows on all pages
- Non-admin users (including Operations Managers) must have BOTH departments AND sites assigned to see and act on workflows
- Site filtering is a security feature - users should only act on workflows for sites they're assigned to

❌ **Incorrect Behavior (What we tried):**
- Removing site filtering for Operations Managers
- This would let them see and act on workflows from ALL sites, which is a security issue

## Next Steps

1. Run one of the debug scripts above to diagnose the exact issue
2. Update the Operations Manager user profile with correct sites
3. Verify the user can now see workflows on Requests page
4. Confirm site names match exactly (case-sensitive) between:
   - User profile `sites` array
   - Workflow `projectCode` values in database

## Files Reference

- **Requests.tsx** (lines 85-94): Requests page filtering logic
- **Dashboard.tsx** (lines 56-58): Dashboard filtering logic
- **debug-ops-manager-detailed.sql**: SQL queries to diagnose the issue
- **debug-ops-manager-browser.js**: Browser console debug script
