# 🧪 SYSTEM TESTING CHECKLIST

**FIRST:** Run [FIX_ALL_DATABASE_ISSUES.sql](FIX_ALL_DATABASE_ISSUES.sql) in Supabase SQL Editor, then hard refresh browser (Ctrl+Shift+R)

---

## TEST 1: COMPLETE WORKFLOW (Critical Path)
**Time:** 15-20 minutes | **Priority:** 🔴 HIGH

### 1A. Create Request
- [ ] Login as Site Manager/Requester
- [ ] Go to Forms → Stock Request
- [ ] Add 2 items, set priority Normal
- [ ] Submit request
- [ ] ✅ Confirm: Request appears in "My Requests" with status "Request Submitted"

### 1B. Ops Manager Approves
- [ ] Login as Operations Manager
- [ ] Go to "Requests"
- [ ] Find your request
- [ ] Click "Approve"
- [ ] ✅ Confirm: Status changes to "Awaiting Equipment Manager Approval"
- [ ] ✅ Confirm: NO errors in console (F12)

### 1C. Equipment Manager Approves
- [ ] Login as Equipment Manager
- [ ] Go to "Equipment Manager Approvals"
- [ ] Click "Approve"
- [ ] ✅ Confirm: Status changes to "Awaiting Stock Controller Approval"

### 1D. Stock Controller Approves
- [ ] Login as Stock Controller
- [ ] Go to "Requests"
- [ ] Click "Approve"
- [ ] ✅ Confirm: Status changes to "Awaiting Picking"

### 1E. Storeman Picks
- [ ] Login as Storeman
- [ ] Go to "Deliveries"
- [ ] Click "Mark as Picked"
- [ ] ✅ Confirm: Status changes to "Picked and Loaded"

### 1F. Gate Release
- [ ] Login as Security or Driver
- [ ] Go to "Deliveries" → "Ready for Dispatch"
- [ ] Fill in driver name and vehicle registration
- [ ] Sign both signatures (driver + security)
- [ ] Submit
- [ ] ✅ Confirm: Status changes to "Dispatched"

### 1G. EPOD (Proof of Delivery)
- [ ] Login as Driver or Recipient
- [ ] Go to "My Deliveries"
- [ ] Click "Complete Delivery (EPOD)"
- [ ] Enter recipient name
- [ ] Upload photo
- [ ] Sign
- [ ] Submit
- [ ] ✅ Confirm: Status changes to "EPOD Confirmed"
- [ ] ✅ Confirm: WORKFLOW COMPLETE!

---

## TEST 2: REJECTIONS
**Time:** 10 minutes | **Priority:** 🟡 MEDIUM

### 2A. Ops Manager Rejects
- [ ] Create new request
- [ ] Login as Ops Manager
- [ ] Click "Deny", enter reason
- [ ] ✅ Confirm: Status = "Denied by Ops Manager"

### 2B. Requester Rejects Delivery
- [ ] Get request to "Dispatched" status
- [ ] Login as original requester
- [ ] Go to "My Deliveries"
- [ ] Click "Reject Delivery", enter reason
- [ ] ✅ Confirm: Status = "Rejected at Delivery"
- [ ] ✅ Confirm: Appears in "Returns" page

---

## TEST 3: RETURNS & SALVAGE
**Time:** 10 minutes | **Priority:** 🟡 MEDIUM

### 3A. Return to Store
- [ ] Go to "Returns" page
- [ ] Find rejected delivery
- [ ] Click "Book to Store"
- [ ] Fill in stock intake form
- [ ] ✅ Confirm: Inventory quantity increases

### 3B. Salvage Workflow
- [ ] Click "Book to Salvage" instead
- [ ] Fill form, upload photo
- [ ] ✅ Confirm: Appears in "Salvage" page
- [ ] Login as Equipment Manager
- [ ] Click "Mark for Scrap" or "Mark for Repair"
- [ ] Click "Confirm"
- [ ] ✅ Confirm: Salvage complete

---

## TEST 4: STOCK INTAKE
**Time:** 5 minutes | **Priority:** 🟡 MEDIUM

- [ ] Login as Storeman/Stock Controller
- [ ] Go to Forms → Stock Intake
- [ ] Select item, enter quantity
- [ ] Select store, enter location
- [ ] Enter delivery note/PO
- [ ] Submit
- [ ] ✅ Confirm: Inventory increases
- [ ] ✅ Confirm: Receipt appears in "Stock Receipts"

---

## TEST 5: USER MANAGEMENT
**Time:** 5 minutes | **Priority:** 🟢 LOW

- [ ] Login as Admin
- [ ] Go to "User Management"
- [ ] Create new user with limited site access
- [ ] ✅ Confirm: User can only see assigned sites
- [ ] ✅ Confirm: User gets error when accessing other sites

---

## TEST 6: EMAIL NOTIFICATIONS
**Time:** During above tests | **Priority:** 🟡 MEDIUM

Check that emails are sent when:
- [ ] Request submitted → Ops Manager gets email
- [ ] Ops Manager approves → Equipment Manager gets email
- [ ] Equipment Manager approves → Stock Controller gets email
- [ ] Stock Controller approves → Storeman gets email
- [ ] Picked & loaded → Driver/Security get email
- [ ] Dispatched → Requester gets email
- [ ] Request denied → Requester gets email with reason

---

## TEST 7: EDGE CASES
**Time:** 5 minutes | **Priority:** 🟢 LOW

- [ ] Try creating request with 0 items → Should show error
- [ ] Try creating request with invalid site → Should show error
- [ ] Try approving request for site you don't have access to → Should show error
- [ ] Set user status to "Frozen" → User cannot login

---

## 🎯 MINIMUM FOR HANDOVER

System is ready if:
- [ ] ✅ TEST 1 (Complete Workflow) passes
- [ ] ✅ TEST 2 (Rejections) passes
- [ ] ✅ TEST 4 (Stock Intake) passes
- [ ] ✅ NO console errors during testing
- [ ] ✅ NO database errors shown to users

**Other tests (3, 5, 6, 7) are nice-to-have but not critical.**

---

## 📝 ISSUE TRACKING

As you test, record any issues here:

| Test # | Issue | Status |
|--------|-------|--------|
| 1B | Ops Manager approval errors | ⏳ Fixing |
|  |  |  |
|  |  |  |

---

## ✅ SIGN-OFF

- [ ] All critical tests pass
- [ ] System stable for 24 hours
- [ ] User training completed
- [ ] Documentation handover complete

**System Ready for Production:** YES / NO

**Date:** __________
**Tested By:** __________
**Approved By:** __________
