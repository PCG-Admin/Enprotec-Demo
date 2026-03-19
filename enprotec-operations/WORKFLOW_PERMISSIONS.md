# Workflow Permissions & Steps

## Complete Workflow Flow

### Step 1: REQUEST SUBMITTED
**Status:** `Request Submitted`
**Who Can Act:** Operations Manager, Admin
**Action:** Approve or Decline request
**Next Status:** `Awaiting Stock Controller` (if approved)
**Implementation:** [Requests.tsx:170-177](components/Requests.tsx#L170-L177)

---

### Step 2: AWAITING STOCK CONTROLLER
**Status:** `Awaiting Stock Controller`
**Who Can Act:** Stock Controller, Admin
**Action:** Approve or Decline request
**Next Status:** `Awaiting Equip. Manager` (if approved)
**Implementation:** [Requests.tsx:179-187](components/Requests.tsx#L179-L187)

---

### Step 3: AWAITING EQUIP. MANAGER
**Status:** `Awaiting Equip. Manager`
**Who Can Act:** Equipment Manager, Admin
**Action:** Approve or Decline request
**Next Status:** `Awaiting Picking` (if approved)
**Implementation:** [EquipmentManager.tsx:111](components/EquipmentManager.tsx#L111)

---

### Step 4: AWAITING PICKING
**Status:** `Awaiting Picking`
**Who Can Act:** Storeman, Admin
**Action:** Mark items as picked and loaded
**Next Status:** `Picked & Loaded`
**Implementation:** Picking.tsx

---

### Step 5: PICKED & LOADED
**Status:** `Picked & Loaded`
**Who Can Act:** Security, Driver, Admin
**Action:** Complete gate release form (dual signature)
**Next Status:** `Dispatched`
**Implementation:** GateReleaseForm.tsx

---

### Step 6: DISPATCHED
**Status:** `Dispatched`
**Who Can Act:** Driver, Site Manager
**Action:** Confirm delivery with EPOD (photo + signature)
**Next Status:** `EPOD Confirmed`
**Implementation:** EPODForm.tsx
**Notification:** All participants notified (Admin, Ops Manager, Driver, Site Manager)

---

### Step 7: EPOD CONFIRMED
**Status:** `EPOD Confirmed`
**Who Can Act:** Original Requester only
**Action:** Accept or Reject delivery
**Next Status:** `Completed` (if accepted) or `Rejected at Delivery` (if rejected)
**Implementation:** MyDeliveries.tsx

---

### Step 8: COMPLETED
**Status:** `Completed`
**Who Can Act:** N/A (final status)
**Action:** None - workflow complete

---

## Alternative Paths

### REJECTED AT DELIVERY
**Status:** `Rejected at Delivery`
**Who Can Act:** Stock Controller, Admin
**Action:** Book to Store or Book to Salvage
**Implementation:** Returns.tsx

### REQUEST DECLINED
**Status:** `Request Declined`
**Triggered By:** Any approver (Ops Manager, Stock Controller, Equipment Manager)
**Action:** None - workflow terminated

---

## Database Implementation

### Steps Array (en_workflows_view)
```sql
ARRAY[
    'Request Submitted',
    'Awaiting Stock Controller',
    'Awaiting Equip. Manager',
    'Awaiting Picking',
    'Picked & Loaded',
    'Dispatched',
    'EPOD Confirmed',
    'Completed'
]::text[]
```

### Next Step Mapping (workflowSteps.ts)
```typescript
REQUEST_SUBMITTED → 'Operations Manager Approval'
STOCK_CONTROLLER_APPROVAL → 'Equipment Manager Approval'
AWAITING_EQUIP_MANAGER → 'Picking & Loading' (by Storeman)
AWAITING_PICKING → 'Gate Release & Dispatch' (by Security/Driver)
PICKED_AND_LOADED → 'Gate Release & Dispatch' (by Security/Driver)
DISPATCHED → 'Delivery Confirmation (EPOD)' (by Driver/Site Manager)
EPOD_CONFIRMED → 'Requester Acceptance' (by Requester)
COMPLETED → N/A
```

---

## Role-Based Access Control

| Role | Can Approve Requests | Can Pick Items | Can Gate Release | Can EPOD | Can Accept/Reject Delivery |
|------|---------------------|----------------|------------------|----------|---------------------------|
| Admin | ✅ All steps | ✅ | ✅ | ✅ | ✅ |
| Operations Manager | ✅ Step 1 only | ❌ | ❌ | ❌ | ❌ |
| Stock Controller | ✅ Step 2 only | ❌ | ❌ | ❌ | ❌ |
| Equipment Manager | ✅ Step 3 only | ❌ | ❌ | ❌ | ❌ |
| Storeman | ❌ | ✅ | ❌ | ❌ | ❌ |
| Security | ❌ | ❌ | ✅ | ❌ | ❌ |
| Driver | ❌ | ❌ | ✅ | ✅ | ❌ |
| Site Manager | ❌ | ❌ | ❌ | ✅ | ❌ |
| Project Manager | ❌ | ❌ | ❌ | ❌ | ✅ (own requests) |
| Requester | ❌ | ❌ | ❌ | ❌ | ✅ (own deliveries) |

---

## Email Notifications

Configured in [services/webhookService.ts](services/webhookService.ts)

- **Step 1 → 2:** Operations Manager approves → Stock Controller notified
- **Step 2 → 3:** Stock Controller approves → Equipment Manager notified
- **Step 3 → 4:** Equipment Manager approves → Storeman notified
- **Step 4 → 5:** Items picked → Security/Driver notified
- **Step 5 → 6:** Gate released → All participants notified
- **Step 6 → 7:** Dispatched → Driver/Site Manager for EPOD
- **Step 7 → 8:** EPOD confirmed → Requester for acceptance

---

**Last Updated:** 2026-01-22
**Database Migration:** `20260122_FINAL_FIX_ALL.sql`
