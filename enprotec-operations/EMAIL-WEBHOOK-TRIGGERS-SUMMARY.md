# Email Webhook Triggers - Complete Summary

## Overview

The system sends webhook notifications to Make.com, which then sends emails to relevant users. There are **3 webhook endpoints** configured:

1. **General Workflow Webhook**: `https://hook.eu2.make.com/auxwo8ivmlye45wqwguiwthp78mwpiyc`
2. **Denial Webhook**: `https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj`
3. **Dispatch Webhook**: `https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913`

---

## Webhook Functions

### 1. `sendApprovalWebhook()`
- **URL**: General Workflow Webhook
- **Purpose**: Notifies next approvers/actors when workflow status changes
- **Payload Includes**:
  - `actionType`: 'APPROVAL' | 'DECLINE' | 'REJECTION' | 'ACCEPTANCE' | 'SALVAGE_DECISION'
  - `requestNumber`: Request ID
  - `previousStatus`: Status before change
  - `newStatus`: Status after change
  - `actor`: {name, email, role} of person who performed the action
  - `comment`: Optional comment
  - `timestamp`: When action occurred
  - `workflowId`: Database ID
  - `approver1`, `approver2`, `approver3`, etc.: Email addresses of next approvers

### 2. `sendDenialWebhook()`
- **URL**: Denial Webhook
- **Purpose**: Sends formatted denial email to original requester
- **Payload Includes**:
  - `requesterName`: Name of person who made the request
  - `requesterEmail`: Email of requester
  - `subject`: Email subject (e.g., "REQ-001 Denied")
  - `body`: Full HTML-formatted email with denial reason

### 3. `sendDispatchWebhook()`
- **URL**: Dispatch Webhook
- **Purpose**: Notifies when items are dispatched/shipped
- **Payload Includes**:
  - `requestNumber`: Request ID
  - `projectCode`: Site/Project
  - `department`: Store/Department
  - `priority`: Priority level
  - `requester`: Name of original requester
  - `items`: Array of items being dispatched
  - `dispatchedBy`: {name, email, role} of person who dispatched
  - `timestamp`: When dispatched
  - `workflowId`: Database ID
  - `driverName`: Driver's name
  - `vehicleRegistration`: Vehicle reg number

---

## Complete Trigger List - Stock Workflow

### 1. New Stock Request Submitted
- **File**: `components/forms/StockRequestForm.tsx`
- **Trigger**: User submits a new stock request
- **Status Change**: `null` → `REQUEST_SUBMITTED`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 2. Operations Manager Approves
- **File**: `components/Requests.tsx`
- **Trigger**: Operations Manager clicks "Approve" button
- **Status Change**: `REQUEST_SUBMITTED` → `AWAITING_OPS_MANAGER`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Stock Controller (Mitzi)
  - Admin (all with role)

---

### 3. Stock Controller Approves
- **File**: `components/Requests.tsx`
- **Trigger**: Stock Controller clicks "Approve" button
- **Status Change**: `AWAITING_OPS_MANAGER` → `AWAITING_EQUIP_MANAGER`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Equipment Manager (all with role)
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 4. Equipment Manager Approves
- **File**: `components/EquipmentManager.tsx`
- **Trigger**: Equipment Manager clicks "Approve" button
- **Status Change**: `AWAITING_EQUIP_MANAGER` → `AWAITING_PICKING`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Stock Controller
  - Storeman (all with role)
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 5. Storeman Picks Items
- **File**: `components/Picking.tsx`
- **Trigger**: Storeman marks items as picked and loaded
- **Status Change**: `AWAITING_PICKING` → `PICKED_AND_LOADED`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Driver (all with role)
  - Security (all with role)

---

### 6. Security/Driver Dispatches Items (Gate Release)
- **File**: `components/forms/GateReleaseForm.tsx`
- **Trigger**: Security/Driver completes gate release form with driver & vehicle info
- **Status Change**: `PICKED_AND_LOADED` → `DISPATCHED`
- **Webhooks**:
  1. `sendApprovalWebhook('APPROVAL', ...)` - General notification
  2. `sendDispatchWebhook(...)` - Dispatch-specific notification with driver/vehicle info
- **Emails Sent To**:
  - Original Requester (person who made the request)

---

### 7. Driver/Site Manager Confirms EPOD
- **File**: `components/forms/EPODForm.tsx`
- **Trigger**: Driver/Site Manager confirms delivery (Electronic Proof of Delivery)
- **Status Change**: `DISPATCHED` → `EPOD_CONFIRMED`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Original Requester (person who made the request)

---

### 8. Requester Accepts Delivery
- **File**: `components/MyDeliveries.tsx`
- **Trigger**: Original requester confirms they received items correctly
- **Status Change**: `EPOD_CONFIRMED` → `COMPLETED`
- **Webhook**: `sendApprovalWebhook('ACCEPTANCE', ...)`
- **Emails Sent To**:
  - None (workflow complete)

---

### 9. Request Declined (at any approval stage)
- **File**:
  - `components/Requests.tsx` (Ops Manager or Stock Controller decline)
  - `components/EquipmentManager.tsx` (Equipment Manager decline)
- **Trigger**: Any approver clicks "Decline" button with a comment
- **Status Change**: Any status → `REQUEST_DECLINED`
- **Webhooks**:
  1. `sendDenialWebhook(...)` - Formatted HTML email to requester
  2. `sendApprovalWebhook('DECLINE', ...)` - General notification
- **Emails Sent To**:
  - Original Requester (HTML formatted email with denial reason)

---

### 10. Items Rejected at Delivery
- **File**: `components/MyDeliveries.tsx`
- **Trigger**: Requester clicks "Reject Items" button with a reason
- **Status Change**: `EPOD_CONFIRMED` → `REJECTED_AT_DELIVERY`
- **Webhook**: `sendApprovalWebhook('REJECTION', ...)`
- **Emails Sent To**:
  - Stock Controller
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 11. Stock Controller Processes Return
- **File**: `components/Requests.tsx`
- **Trigger**: Stock Controller clicks "Process Return" button
- **Status Change**: `REJECTED_AT_DELIVERY` → `COMPLETED`
- **Webhook**: `sendApprovalWebhook('ACCEPTANCE', ...)`
- **Emails Sent To**:
  - None (workflow complete)

---

## Salvage Workflow Triggers

### 12. Equipment Manager Makes Salvage Decision (Repair)
- **File**: `components/SalvagePage.tsx`
- **Trigger**: Equipment Manager decides item should be repaired
- **Status Change**: `SALVAGE_TO_BE_REPAIRED`
- **Webhook**: `sendApprovalWebhook('SALVAGE_DECISION', ...)`
- **Emails Sent To**:
  - Equipment Manager (all with role)
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 13. Equipment Manager Makes Salvage Decision (Scrap)
- **File**: `components/SalvagePage.tsx`
- **Trigger**: Equipment Manager decides item should be scrapped
- **Status Change**: `SALVAGE_TO_BE_SCRAPPED`
- **Webhook**: `sendApprovalWebhook('SALVAGE_DECISION', ...)`
- **Emails Sent To**:
  - Equipment Manager (all with role)
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 14. Stock Controller Confirms Repair Decision
- **File**: `components/SalvagePage.tsx`
- **Trigger**: Stock Controller confirms repair action
- **Status Change**: `SALVAGE_REPAIR_CONFIRMED`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Stock Controller
  - Operations Manager (all with role)
  - Admin (all with role)

---

### 15. Stock Controller Confirms Scrap Decision
- **File**: `components/SalvagePage.tsx`
- **Trigger**: Stock Controller confirms scrap action
- **Status Change**: `SALVAGE_SCRAP_CONFIRMED`
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**:
  - Stock Controller
  - Operations Manager (all with role)
  - Admin (all with role)

---

## Additional Triggers (Modal Actions)

### 16. Status Updates via Detail Modal
- **File**: `components/WorkflowDetailModal.tsx`
- **Trigger**: User clicks action button in workflow detail modal
- **Status Changes**: Various (same as above, but from modal view)
- **Webhook**: `sendApprovalWebhook('APPROVAL', ...)`
- **Emails Sent To**: Same as corresponding status change above

---

## Email Recipient Logic

### How Recipients Are Determined:

The `getNextApproverEmails()` function queries the database for active users with specific roles:

```typescript
// Example: When status changes to AWAITING_OPS_MANAGER
targetRoles = [UserRole.StockController, UserRole.Admin];

// Query:
SELECT email FROM en_users
WHERE role IN ('Stock Controller', 'Admin')
AND status = 'Active';
```

### Special Cases:

1. **Original Requester**: When status is `DISPATCHED`, `EPOD_CONFIRMED`, or `REQUEST_DECLINED`, the system looks up the requester's email by `requester_id`

2. **Multiple Users Per Role**: If multiple users have the same role (e.g., 3 Admins), ALL of them receive the email

3. **Only Active Users**: Inactive users are excluded from email notifications

---

## Summary Table

| # | Trigger Event | From Status | To Status | Webhook Type | Recipients |
|---|---------------|-------------|-----------|--------------|------------|
| 1 | Submit Request | - | REQUEST_SUBMITTED | Approval | Ops Manager, Admin |
| 2 | Ops Mgr Approves | REQUEST_SUBMITTED | AWAITING_OPS_MANAGER | Approval | Stock Controller, Admin |
| 3 | Stock Ctrl Approves | AWAITING_OPS_MANAGER | AWAITING_EQUIP_MANAGER | Approval | Equip Mgr, Ops Mgr, Admin |
| 4 | Equip Mgr Approves | AWAITING_EQUIP_MANAGER | AWAITING_PICKING | Approval | Stock Ctrl, Storeman, Ops Mgr, Admin |
| 5 | Storeman Picks | AWAITING_PICKING | PICKED_AND_LOADED | Approval | Driver, Security |
| 6 | Gate Release | PICKED_AND_LOADED | DISPATCHED | Approval + Dispatch | Original Requester |
| 7 | EPOD Confirmed | DISPATCHED | EPOD_CONFIRMED | Approval | Original Requester |
| 8 | Requester Accepts | EPOD_CONFIRMED | COMPLETED | Acceptance | None |
| 9 | Request Declined | Any | REQUEST_DECLINED | Denial + Approval | Original Requester |
| 10 | Items Rejected | EPOD_CONFIRMED | REJECTED_AT_DELIVERY | Rejection | Stock Ctrl, Ops Mgr, Admin |
| 11 | Process Return | REJECTED_AT_DELIVERY | COMPLETED | Acceptance | None |
| 12-15 | Salvage Actions | Various | SALVAGE_* | Salvage Decision | Equip Mgr, Ops Mgr, Stock Ctrl, Admin |

---

## Make.com Integration Requirements

Your Make.com scenarios need to handle:

1. **General Workflow Webhook** - Parse `actionType` and `newStatus` to determine:
   - Email subject line
   - Email template to use
   - Send to addresses in `approver1`, `approver2`, `approver3`, etc.

2. **Denial Webhook** - Simple passthrough:
   - Send to `requesterEmail`
   - Subject: `subject` field
   - Body: `body` field (pre-formatted HTML)

3. **Dispatch Webhook** - Format dispatch notification:
   - Send to requester (and optionally site manager/driver)
   - Include: items, driver name, vehicle registration, dispatch time
   - Subject: "Your order {requestNumber} has been dispatched"

---

## Testing Checklist

To test all email triggers:

- [ ] 1. Submit new stock request → Ops Mgr gets email
- [ ] 2. Ops Mgr approves → Stock Ctrl gets email
- [ ] 3. Stock Ctrl approves → Equip Mgr gets email
- [ ] 4. Equip Mgr approves → Storeman gets email
- [ ] 5. Storeman picks → Driver/Security get email
- [ ] 6. Gate release → Requester gets dispatch email
- [ ] 7. EPOD confirmed → Requester gets confirmation email
- [ ] 8. Requester accepts → No email (complete)
- [ ] 9. Decline at any step → Requester gets denial email
- [ ] 10. Reject items → Stock Ctrl/Ops Mgr get email
- [ ] 11. Process return → No email (complete)
- [ ] 12-15. Salvage decisions → Equip Mgr/Stock Ctrl get emails

---

## Notes

- All webhooks are sent via `POST` with JSON payload
- All webhook calls are wrapped in try/catch - failures are logged but don't break the workflow
- Emails are only sent to users with `status = 'Active'` in the database
- Admin role receives emails at most workflow steps (for oversight)
- Operations Manager receives emails at critical steps (visibility)
