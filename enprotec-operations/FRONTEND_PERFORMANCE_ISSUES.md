# Frontend Performance Issues Found

## Critical Problems

### 1. Loading ALL Data Without Limits ❌

**Dashboard.tsx (lines 56, 69)**:
```typescript
// Loads EVERY workflow in database
let workflowsQuery = supabase.from('en_workflows_view').select('*');

// Loads EVERY stock item in database
let stockQuery = supabase.from('en_stock_view').select('*');
```

**WorkflowList.tsx (line 31)**:
```typescript
// Loads EVERY workflow in database
let query = supabase.from('en_workflows_view').select('*');
```

**Impact**:
- If you have 1,000 workflows, it loads ALL 1,000
- Each workflow has nested JSON (items array, attachments array)
- Can easily be 5-10MB of data transfer
- Takes 400-550ms just to query, then more time to transfer

### 2. Using `select('*')` on Complex Views ❌

The `en_workflows_view` contains:
- All workflow fields
- JSONB array of all items (with stock info)
- JSONB array of all attachments
- Text array of steps
- Site names, user names, etc.

Loading this for 100+ workflows = MASSIVE data transfer

### 3. No Pagination ❌

- Dashboard shows first 5 workflows but loads ALL
- WorkflowList shows ALL workflows (no pages)
- StockManagement has pagination ✅ (good!)

## Solutions

### Option 1: Add Limits (Quick Fix)
```typescript
// Dashboard - only need 5 for display
supabase.from('en_workflows_view')
  .select('*')
  .order('createdAt', { ascending: false })
  .limit(5)  // Only load 5, not all!

// WorkflowList - add pagination
supabase.from('en_workflows_view')
  .select('*')
  .order('createdAt', { ascending: false })
  .range(from, to)  // e.g., 0-49 for first page
```

### Option 2: Select Only Needed Columns (Better)
```typescript
// WorkflowList - don't need items/attachments arrays for list view
supabase.from('en_workflows_view')
  .select('id, requestNumber, requester, department, currentStatus, priority, createdAt, projectCode')
  .order('createdAt', { ascending: false })
  .limit(50)

// Only load full details when opening modal
```

### Option 3: Create Lightweight Views (Best)
Create a new view without the heavy JSON aggregations:
```sql
CREATE VIEW en_workflows_list_view AS
SELECT
    id,
    request_number,
    requester,
    department,
    current_status,
    priority,
    created_at,
    project_code,
    type
FROM en_workflow_requests wr
JOIN en_users u ON wr.requester_id = u.id
LEFT JOIN en_sites s ON wr.site_id = s.id;
```

Use `en_workflows_list_view` for lists, `en_workflows_view` only for detail modal.

## Recommended Fix Priority

### HIGH PRIORITY (Do First):

**1. Dashboard.tsx - Add Limits**
```typescript
// Line 56
let workflowsQuery = supabase
  .from('en_workflows_view')
  .select('*')
  .order('createdAt', { ascending: false })
  .limit(10);  // Only need 5 for display, get 10 for safety

// Line 69
let stockQuery = supabase
  .from('en_stock_view')
  .select('*')
  .limit(100);  // Only load critical/recent items
```

**Impact**: Dashboard loads in <1 second instead of 3-5 seconds

**2. WorkflowList.tsx - Add Pagination**
```typescript
const [page, setPage] = useState(1);
const pageSize = 50;

// In query:
.range((page - 1) * pageSize, page * pageSize - 1)
```

**Impact**: WorkflowList loads 50 items instead of ALL

### MEDIUM PRIORITY (Do Next):

**3. Create Lightweight List View**
```sql
-- New migration file
CREATE VIEW en_workflows_list_view AS
SELECT
    wr.id,
    wr.request_number AS "requestNumber",
    u.name AS requester,
    wr.department,
    wr.current_status AS "currentStatus",
    wr.priority,
    wr.created_at AS "createdAt",
    s.name AS "projectCode",
    wr.type
FROM en_workflow_requests wr
JOIN en_users u ON wr.requester_id = u.id
LEFT JOIN en_sites s ON wr.site_id = s.id;
```

Then use it in lists:
```typescript
// WorkflowList and Dashboard use lightweight view
supabase.from('en_workflows_list_view').select('*')

// DetailModal uses full view
supabase.from('en_workflows_view').select('*').eq('id', workflowId)
```

**Impact**: 10x less data transferred, much faster

### LOW PRIORITY (Nice to Have):

**4. Add Loading States for Each Section**
- Show skeleton loaders
- Load critical data first, then secondary data
- Makes app feel faster even if it isn't

**5. Add Data Caching**
- Cache workflows for 30 seconds
- Don't re-fetch if data is recent

## Expected Performance Gains

| Fix | Before | After | Improvement |
|-----|--------|-------|-------------|
| Dashboard Limits | 3-5s | <1s | **5x faster** |
| WorkflowList Pagination | 2-4s | <1s | **4x faster** |
| Lightweight Views | 1-2s | <500ms | **4x faster** |
| Combined (All Fixes) | 3-5s | <500ms | **10x faster** |

## Files That Need Changes

### Quick Fix (Limits Only):
1. `components/Dashboard.tsx` - Add .limit(10) to workflows, .limit(100) to stock
2. `components/WorkflowList.tsx` - Add pagination with .range()

### Full Fix (Views + Limits):
1. Create new migration: `supabase/migrations/20260126_create_list_views.sql`
2. Update `components/Dashboard.tsx`
3. Update `components/WorkflowList.tsx`
4. Update `supabase/database.types.ts` (add new view type)
