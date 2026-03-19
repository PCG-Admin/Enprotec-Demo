# Comprehensive System Testing Guide

## Overview
This guide provides step-by-step testing procedures to verify all critical workflows are functioning correctly after the schema error fixes.

---

## Pre-Testing Checklist

### 1. Deploy Fixes
- [ ] Run `FIX_SCHEMA_ERRORS.sql` in Supabase SQL Editor
- [ ] Verify success message appears
- [ ] Deploy updated frontend code (stockService.ts)
- [ ] Restart dev server (if running locally)

### 2. Verify Database State
```sql
-- Run these queries in Supabase SQL Editor

-- 1. Verify process_stock_request function exists
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'process_stock_request';

-- 2. Verify process_stock_intake function exists
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'process_stock_intake';

-- 3. Check no orphaned triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('en_workflow_requests', 'en_stock_receipts', 'en_inventory');
```

---

## Test Suite 1: Stock Request Workflow (CRITICAL)

### Test 1.1: Create New Stock Request
**User Role:** Any user with departments assigned

**Steps:**
1. Navigate to "Stock Requests" or "Requests" page
2. Click "New Request" button
3. Fill in form:
   - Select site/project
   - Select department/store
   - Select priority
   - Add at least 2 stock items
   - Add quantities
   - Optionally add comment
4. Click "Submit Request"

**Expected Result:**
- ✅ Request submits successfully
- ✅ Success message appears (NOT a database error)
- ✅ Request appears in "My Requests" view
- ✅ Request number generated (e.g., IR-2026-XXXXXX)
- ✅ Status shows "Request Submitted"

**Failure Signs:**
- ❌ Error message mentioning "request_type" or "column does not exist"
- ❌ Any database table/column names visible in error
- ❌ Request not appearing in list

---

### Test 1.2: Approval Workflow
**User Roles:** Operations Manager, Stock Controller, Equipment Manager

**Steps:**
1. **Operations Manager:**
   - Navigate to "Requests" page
   - Find a "Request Submitted" item
   - Click "Approve"
   - Verify status changes to "Awaiting Operations Manager"

2. **Stock Controller:**
   - Navigate to "Requests" page
   - Find an "Awaiting Operations Manager" item
   - Click "Approve"
   - Verify status changes to "Awaiting Equipment Manager"

3. **Equipment Manager:**
   - Navigate to "Equipment Manager" page
   - Find an "Awaiting Equipment Manager" item
   - Click "Approve"
   - Verify status changes to "Awaiting Picking"

**Expected Result:**
- ✅ Each approval processes without errors
- ✅ Status progresses correctly through workflow
- ✅ Email notifications sent (check email/webhook logs)
- ✅ User-friendly messages on any errors

---

## Test Suite 2: Stock Intake Workflow

### Test 2.1: Stock Intake (Existing Part)
**User Role:** Admin, Stock Controller, Equipment Manager

**Steps:**
1. Navigate to "Stock Receipts" page
2. Click "New Receipt" or "Stock Intake"
3. Select "Existing Part"
4. Choose a part from dropdown
5. Fill in:
   - Quantity received
   - Store/Department
   - Location (optional)
   - Delivery note/PO
   - Comments
6. Optionally upload attachment
7. Click "Submit"

**Expected Result:**
- ✅ Intake processes successfully
- ✅ Success message appears
- ✅ Inventory quantity updated
- ✅ Receipt appears in "Stock Receipts" view
- ✅ Receipt shows correct store/department

**Failure Signs:**
- ❌ Error mentioning columns, tables, or "relation"
- ❌ Receipt not appearing in list
- ❌ Quantity not updated in inventory

---

### Test 2.2: Stock Intake (New Part)
**Steps:**
1. Navigate to "Stock Receipts" page
2. Click "New Receipt"
3. Select "New Part"
4. Fill in:
   - Part number (unique)
   - Description
   - Category
   - Min stock level
   - Quantity received
   - Store/Department
   - Location
   - Delivery note/PO
5. Click "Submit"

**Expected Result:**
- ✅ New stock item created
- ✅ Inventory record created
- ✅ Receipt record created
- ✅ Success message shown

---

## Test Suite 3: Delivery & EPOD Workflow

### Test 3.1: Picking Process
**User Role:** Storeman, Stock Controller

**Steps:**
1. Navigate to "Picking" page
2. Find an "Awaiting Picking" request
3. Click "Mark as Picked"
4. Confirm action

**Expected Result:**
- ✅ Status changes to "Picked & Loaded"
- ✅ Request moves to "Deliveries" view
- ✅ Email notification sent

---

### Test 3.2: Gate Release
**User Role:** Driver, Security

**Steps:**
1. Navigate to "Deliveries" page
2. Find a "Picked & Loaded" request
3. Click to open Gate Release Form
4. Fill in:
   - Driver name
   - Vehicle registration
   - Optionally upload document
   - Sign as Driver (signature pad)
   - Sign as Gate/Security (signature pad)
5. Click "Dispatch"

**Expected Result:**
- ✅ Both signatures captured
- ✅ Status changes to "Dispatched"
- ✅ Signatures stored in Supabase
- ✅ Email notification sent

---

### Test 3.3: EPOD Confirmation
**User Role:** Driver, Site Manager

**Steps:**
1. Navigate to "My Deliveries" (as original requester) or "Deliveries"
2. Find a "Dispatched" request
3. Click to open EPOD Form
4. Fill in:
   - Recipient name
   - Upload delivery photo
   - Sign as recipient
   - Select condition (All Good / Damaged)
5. Click "Confirm Delivery"

**Expected Result:**
- ✅ Status changes to "EPOD Confirmed"
- ✅ Photo and signature stored
- ✅ Email notification sent
- ✅ Request moves to requester for final acceptance

---

## Test Suite 4: Error Handling

### Test 4.1: Duplicate Stock Item
**Steps:**
1. Try to create stock intake with existing part number using "New Part" option
2. Submit form

**Expected Result:**
- ✅ User-friendly error: "This item already exists. Please check your input."
- ❌ Should NOT show: "duplicate key violates unique constraint"
- ❌ Should NOT show table names

---

### Test 4.2: Invalid User Reference
**Steps:**
1. (Admin only) Manually trigger API call with invalid user ID
2. Or delete a user and try to assign them

**Expected Result:**
- ✅ User-friendly error: "Invalid reference. Please refresh and try again."
- ❌ Should NOT show: "foreign key constraint violated"

---

### Test 4.3: Permission Error
**Steps:**
1. Log in as user with limited permissions (e.g., Driver)
2. Try to access admin-only pages (Users, Sites)
3. Try to approve requests (if not authorized)

**Expected Result:**
- ✅ Blocked from accessing page OR
- ✅ User-friendly error: "You do not have permission to perform this action."
- ❌ Should NOT show raw permission errors

---

## Test Suite 5: Salvage Workflow

### Test 5.1: Create Salvage Request
**User Role:** Any user

**Steps:**
1. Navigate to "Salvage" page
2. Click "New Salvage Request"
3. Fill in:
   - Stock item
   - Quantity
   - Notes/reason
   - Upload photo
4. Submit

**Expected Result:**
- ✅ Salvage request created
- ✅ Status shows "Awaiting Decision"
- ✅ Appears in salvage list

---

### Test 5.2: Salvage Decision
**User Role:** Equipment Manager, Operations Manager

**Steps:**
1. Navigate to "Salvage" page
2. Find an "Awaiting Decision" item
3. Click "Mark for Scrap" OR "Mark for Repair"
4. Confirm

**Expected Result:**
- ✅ Status changes to "To Be Scrapped" or "To Be Repaired"
- ✅ Decision recorded with timestamp
- ✅ Email notification sent

---

## Test Suite 6: Returns Workflow

### Test 6.1: Reject Delivery
**User Role:** Original requester

**Steps:**
1. Navigate to "My Deliveries"
2. Find an "EPOD Confirmed" delivery
3. Click "Reject Delivery"
4. Provide reason
5. Confirm rejection

**Expected Result:**
- ✅ Status changes to "Rejected at Delivery"
- ✅ Rejection reason recorded
- ✅ Item appears in "Returns" view

---

### Test 6.2: Book Return to Stock
**User Role:** Stock Controller

**Steps:**
1. Navigate to "Returns" page
2. Find a rejected delivery
3. Click "Book to Store" OR "Book to Salvage"
4. Select store and confirm

**Expected Result:**
- ✅ Stock returned to inventory
- ✅ Workflow status updated
- ✅ Stock quantities adjusted

---

## Test Suite 7: Multi-Store Operations

### Test 7.1: Stock Visibility by Department
**User Role:** User with specific department assignments

**Steps:**
1. Log in as user assigned to only "OEM" department
2. Navigate to "Stock Management"
3. Verify only OEM stock is visible

**Expected Result:**
- ✅ User sees only their assigned department's stock
- ✅ Cannot see other departments' inventory
- ✅ Admin sees all departments

---

### Test 7.2: Cross-Store Request
**Steps:**
1. User assigned to "OEM" department
2. Create stock request selecting "Operations" department
3. Submit

**Expected Result:**
- ✅ Request should either:
  - Be blocked (if department not assigned), OR
  - Be allowed (if cross-department requests permitted)

---

## Browser Console Checks

### What You Should See:
✅ **Console logs** showing full technical errors (for debugging)
```javascript
[stock request] Database error: { message: "column request_type...", details: "..." }
```

### What You Should NOT See in UI:
❌ Error messages with database table names
❌ Column names in error messages
❌ SQL error codes or technical jargon
❌ Stacktraces visible to users

---

## Performance Checks

### Page Load Times
- Dashboard: < 2 seconds
- Stock Management: < 3 seconds
- Workflows: < 2 seconds
- Forms: Instant

### Operation Response Times
- Stock request creation: < 1 second
- Approval: < 1 second
- Stock intake: < 2 seconds
- EPOD submission: < 2 seconds

---

## Known Issues to Watch For

### Issue 1: Stock Receipts Not Showing
**Symptom:** Stock intake succeeds but receipt doesn't appear in list
**Fix:** Run `FIX_STOCK_RECEIPTS_DISPLAY.sql` to add `store` column

### Issue 2: Approval Hierarchy
**Symptom:** Equipment Manager approves after Stock Controller
**Status:** Documented in gap analysis, not breaking functionality

### Issue 3: Quantity Verification
**Symptom:** Cannot record actual received quantities vs requested
**Status:** Documented as missing feature, not an error

---

## Reporting Issues

If you encounter errors during testing:

1. **Capture Information:**
   - Screenshot of error message shown to user
   - Browser console logs (F12 → Console tab)
   - Steps to reproduce
   - User role and permissions

2. **Check Supabase Logs:**
   - Navigate to Supabase Dashboard
   - Logs → Database
   - Find error timestamp
   - Copy full error details

3. **Document:**
   - What was expected to happen
   - What actually happened
   - Whether error was user-friendly or technical

---

## Success Criteria

System is production-ready when:
- [ ] All Test Suite 1 tests pass (Stock Requests)
- [ ] All Test Suite 2 tests pass (Stock Intake)
- [ ] All Test Suite 3 tests pass (Delivery & EPOD)
- [ ] All Test Suite 4 tests pass (Error Handling)
- [ ] No database table/column names visible in UI errors
- [ ] All operations complete in acceptable time
- [ ] Email notifications working
- [ ] Multi-user workflows function correctly

---

**Last Updated:** 2026-01-22
**Version:** 1.0
