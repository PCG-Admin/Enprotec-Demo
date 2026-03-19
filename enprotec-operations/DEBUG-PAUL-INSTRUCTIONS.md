# Debug Instructions - Paul Dlhamini Site Visibility Issue

## Problem
Paul Dlhamini has sites assigned but cannot see workflows on Dashboard or any other pages, even though workflows exist for those sites.

## Quick Debug Steps

### Option 1: Browser Console (Fastest - 2 minutes)

1. **Login as Paul Dlhamini**
2. **Open browser DevTools** (Press F12)
3. **Go to Console tab**
4. **Copy and paste** the entire contents of `debug-paul-browser.js`
5. **Press Enter**
6. **Review the output** - it will tell you exactly what's wrong:
   - ✅ If sites are assigned
   - ✅ If workflows exist
   - ✅ If there's a case mismatch (e.g., "Site A" vs "site a")
   - ✅ What the solution is

### Option 2: Database Query (More thorough - 5 minutes)

1. **Open Supabase SQL Editor**
2. **Run the queries** in `debug-paul-sites.sql`
3. **Compare**:
   - Query 1: Paul's `sites` array
   - Query 3: Available `projectCode` values on workflows
4. **Check if they match EXACTLY** (case-sensitive)

## Common Issues & Solutions

### Issue 1: Empty Sites Array
**Symptom:** User sees nothing on any page

**Check:**
```sql
SELECT sites FROM en_users WHERE name = 'Paul Dlhamini';
-- Returns: [] or NULL or {}
```

**Solution:**
1. Go to Users management page in the app
2. Edit Paul Dlhamini
3. Add sites to his profile (e.g., ["Site A", "Site B"])
4. Save
5. Have Paul logout and login again

---

### Issue 2: Case Mismatch
**Symptom:** Workflows exist but user can't see them

**Example:**
- User has: `["site a", "site b"]`
- Workflows have: `projectCode: "Site A"`, `projectCode: "Site B"`
- **Result:** NO MATCH (PostgreSQL `IN` is case-sensitive)

**Solution A - Update User Sites:**
```sql
UPDATE en_users
SET sites = '["Site A", "Site B"]'::jsonb
WHERE name = 'Paul Dlhamini';
```

**Solution B - Update Workflow ProjectCodes:**
```sql
UPDATE en_workflow_requests
SET project_code = 'site a'
WHERE project_code = 'Site A';
```

---

### Issue 3: Different Site Names
**Symptom:** Workflows exist but for different sites

**Example:**
- User has: `["Johannesburg Office", "Pretoria Warehouse"]`
- Workflows have: `projectCode: "JHB Office"`, `projectCode: "PTA Warehouse"`
- **Result:** NO MATCH (names don't match)

**Solution:**
Either update user profile OR update workflow projectCodes to match

---

## What the Browser Debug Script Shows

The `debug-paul-browser.js` script will output:

```
==================================================
PAUL DLHAMINI - SITE VISIBILITY DEBUG
==================================================

👤 USER PROFILE:
  Name: Paul Dlhamini
  Email: paul.dlhamini@example.com
  Role: Operations Manager
  Sites: ["Site A","Site B"]
  Departments: ["Operations"]

✅ User has 2 site(s) assigned

🔍 TESTING QUERIES...

1️⃣  Query ALL workflows (no filters):
   ✅ Total workflows in database: 50

2️⃣  Query with DEPARTMENT filter only:
   ✅ Workflows matching departments: 30
   ProjectCodes in results: ["Site A","Site B","Site C"]

3️⃣  Query with DEPARTMENT + SITE filters:
   ⚠️  NO WORKFLOWS MATCHED!

==================================================
ANALYSIS:
==================================================
⚠️  ISSUE: Workflows exist for user's departments but NOT for user's sites

   User's sites: ["Site A","Site B"]
   Available projectCodes: ["site a","site b","Site C"]

   🔍 FOUND CASE MISMATCH!
   User has: "Site A" | Workflow has: "site a"

   ✅ SOLUTION: Update user.sites to match exact case
==================================================
```

## After Fixing

1. User should logout and login again
2. Navigate to Dashboard
3. Should now see workflows for assigned sites
4. All pages (Requests, Workflow List, etc.) should show same workflows

## Still Having Issues?

If after running the debug scripts the problem persists:
1. Share the output from the browser console script
2. Or share the SQL query results
3. This will help identify the exact mismatch
