# Workflow Rejection & Decline Flows

## Overview

The system handles two types of rejections:
1. **Request Declined** - During approval stages (before delivery)
2. **Rejected at Delivery** - After EPOD, when requester rejects delivered items

---

## 1. REQUEST DECLINED (During Approval)

### When It Happens
Any approver (Ops Manager, Stock Controller, or Equipment Manager) can decline a request during their approval stage.

### Who Can Decline
- **Operations Manager** - At Step 1 (Request Submitted)
- **Stock Controller** - At Step 2 (Awaiting Stock Controller)
- **Equipment Manager** - At Step 3 (Awaiting Equip. Manager)
- **Admin** - At any approval stage

### What Happens

#### 1. User Clicks "Decline" Button
- A comment field appears requiring a reason
- User must provide reason before confirming decline

#### 2. Database Update
```sql
UPDATE en_workflow_requests
SET current_status = 'Request Declined',
    rejection_comment = '<user provided reason>'
WHERE id = <request_id>
```

#### 3. Webhooks Sent
Two webhooks are triggered:
- **DECLINE webhook** - Notifies all workflow participants of decline
- **DENIAL webhook** - Special notification to original requester

**Implementation:**
```typescript
await sendApprovalWebhook('DECLINE', requestToUpdate, newStatus, user, rejectionComment);
await sendDenialWebhook(requestToUpdate, rejectionComment);
```

**Files:**
- [Requests.tsx:208-250](components/Requests.tsx#L208-L250) (Ops Manager & Stock Controller)
- [EquipmentManager.tsx:131-171](components/EquipmentManager.tsx#L131-L171) (Equipment Manager)

#### 4. Workflow Terminated
- Status set to `Request Declined`
- Request removed from active workflows
- **No stock is deducted**
- **No further actions possible on this request**
- Request becomes historical record only

---

## 2. REJECTED AT DELIVERY (After EPOD)

### When It Happens
After driver confirms delivery (EPOD), the **original requester** reviews the delivery and can either accept or reject it.

### Who Can Reject
- **Original Requester only** - The person who initially submitted the request
- **Admin** - Can act on behalf of requester

### Reasons for Rejection
- Incorrect part delivered
- Item is damaged
- Wrong quantity
- Quality issues
- Not meeting specifications

### What Happens

#### Step 1: Requester Views Delivery
- Delivery appears in **"My Deliveries"** page after EPOD
- Status: `EPOD Confirmed`
- Requester sees items delivered, EPOD photo, signatures

#### Step 2: Requester Clicks "Reject"
- Comment field appears requiring rejection reason
- User must provide specific reason (e.g., "Wrong part delivered - P/N ABC123 instead of DEF456")

#### Step 3: Database Update
```sql
UPDATE en_workflow_requests
SET current_status = 'Rejected at Delivery',
    rejection_comment = '<rejection reason>'
WHERE id = <request_id>
```

#### Step 4: Webhook Sent
```typescript
await sendApprovalWebhook('REJECTION', requestToUpdate, newStatus, user, rejectionComment);
```

**File:** [MyDeliveries.tsx:83-120](components/MyDeliveries.tsx#L83-L120)

#### Step 5: Items Appear in Returns Queue
- Status: `Rejected at Delivery`
- Request appears in **"Rejected Returns"** page
- Visible to: Admin, Stock Controller, Equipment Manager

**File:** [Returns.tsx:22-49](components/Returns.tsx#L22-L49)

#### Step 6: Stock Controller Processes Return

**Two Options Available:**

##### Option A: Book to Store (Good Condition)
- Items are in good condition but rejected for other reasons
- Stock Controller clicks "Book to Store"
- Opens **Return Intake Form**
- Items added back to normal inventory
- Quantities restored to appropriate store/department
- **Stock quantity increases** by returned amount

**Implementation:**
```typescript
openForm('ReturnIntake', req)
```

##### Option B: Book to Salvage (Damaged/Faulty)
- Items are damaged, faulty, or not reusable
- Stock Controller clicks "Book to Salvage"
- Opens **Salvage Booking Form**
- Items moved to salvage yard
- Enters salvage workflow for scrap/repair decision

**Implementation:**
```typescript
openForm('SalvageBooking', stockItem)
```

**File:** [Returns.tsx:51-75](components/Returns.tsx#L51-L75)

---

## Stock Impact Comparison

| Scenario | Stock Deducted? | Stock Restored? | Notes |
|----------|-----------------|-----------------|-------|
| **Request Declined** (before picking) | ❌ No | N/A | Stock never left warehouse |
| **Request Declined** (after picking) | ❌ No | N/A | Stock may need to be returned to shelf manually |
| **Rejected at Delivery → Book to Store** | ✅ Yes (at dispatch) | ✅ Yes (when booked back) | Full cycle completed |
| **Rejected at Delivery → Book to Salvage** | ✅ Yes (at dispatch) | ⚠️ To salvage only | Not returned to active inventory |

---

## Automatic Stock Deduction

Stock is **only deducted** when status changes to `Dispatched` (Step 6).

**Trigger Function:**
```sql
CREATE TRIGGER on_dispatch_trigger
AFTER UPDATE ON en_workflow_requests
FOR EACH ROW
EXECUTE FUNCTION on_dispatch_deduct_stock();
```

**What It Does:**
```sql
IF NEW.current_status = 'Dispatched' AND OLD.current_status != 'Dispatched' THEN
    UPDATE en_inventory
    SET quantity_on_hand = quantity_on_hand - item.quantity_requested
    WHERE stock_item_id = item.stock_item_id
    AND store = workflow.department
```

**File:** [20260122_FINAL_FIX_ALL.sql:147-173](supabase/migrations/20260122_FINAL_FIX_ALL.sql#L147-L173)

---

## Workflow Status States

### Terminal States (No Further Action)
- ✅ `Completed` - Delivery accepted
- ❌ `Request Declined` - Request denied during approval

### Action Required States
- ⚠️ `Rejected at Delivery` - Requires stock controller to book to store or salvage

---

## Email Notifications

### Request Declined
**Recipients:**
- Original requester (DENIAL webhook)
- All previous approvers
- Admin

**Content:**
- Who declined the request
- Reason for decline
- Request details

### Rejected at Delivery
**Recipients:**
- Stock Controller (to process return)
- Equipment Manager
- Operations Manager
- Admin

**Content:**
- Who rejected the delivery
- Reason for rejection
- Items to be returned
- EPOD details

---

## User Interface

### Requests Page (Ops Manager, Stock Controller)
- Shows requests at approval stages
- "Approve" and "Decline" buttons
- Decline requires comment

### Equipment Manager Page
- Shows requests awaiting equipment manager approval
- "Approve" and "Decline" buttons
- Decline requires comment

### My Deliveries Page (Requester)
- Shows EPOD-confirmed deliveries
- "Accept Delivery" and "Reject" buttons
- Reject requires comment

### Rejected Returns Page (Stock Controller, Admin)
- Shows all rejected deliveries
- Per-item actions: "Book to Store" and "Book to Salvage"
- Displays rejection reason

---

## Important Notes

1. **Rejection Comments Are Mandatory**
   - System enforces comment requirement
   - Comments stored in `rejection_comment` field
   - Visible to all relevant parties

2. **Stock Already Dispatched**
   - If delivery is rejected, stock was already deducted at dispatch
   - Stock controller must actively book items back to restore inventory
   - This creates audit trail of returns

3. **No Automatic Reversal**
   - Rejected deliveries do NOT automatically restore stock
   - Requires manual processing by stock controller
   - Ensures quality check before returning to inventory

4. **Permissions**
   - Only authorized roles can process returns
   - Admin, Stock Controller, Equipment Manager can "Book to Store/Salvage"
   - Others can view but not action rejected returns

---

## Related Files

**Frontend Components:**
- `components/Requests.tsx` - Ops Manager & Stock Controller decline
- `components/EquipmentManager.tsx` - Equipment Manager decline
- `components/MyDeliveries.tsx` - Requester reject delivery
- `components/Returns.tsx` - Process rejected deliveries
- `components/forms/ReturnIntakeForm.tsx` - Book back to store
- `components/forms/SalvageBookingForm.tsx` - Book to salvage

**Backend/Services:**
- `services/webhookService.ts` - Email notifications
- `supabase/migrations/20260122_FINAL_FIX_ALL.sql` - Dispatch trigger

**Type Definitions:**
- `types.ts` - WorkflowStatus enum

---

**Last Updated:** 2026-01-22
