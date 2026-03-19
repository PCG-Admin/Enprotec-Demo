# Webhook Documentation - Enprotec Workflow Management System

This document outlines all webhook integrations for email notifications via Make.com.

## Overview

The system sends webhook notifications at various workflow stages to trigger email notifications to relevant users. All webhooks are sent as POST requests with JSON payloads.

---

## Webhook Endpoints Required

You will need to create **3 separate webhooks** in Make.com:

### 1. **General Workflow Approval/Status Change Webhook**
- **Current URL**: `https://hook.eu2.make.com/auxwo8ivmlye45wqwguiwthp78mwpiyc`
- **Purpose**: Handles all workflow status changes and approval notifications
- **Use Cases**:
  - New request submitted
  - Ops Manager approval needed
  - Stock Controller approval needed
  - Equipment Manager approval needed
  - Picking required
  - Gate release needed
  - EPOD confirmation needed
  - Request declined
  - Return workflow notifications

### 2. **Request Denial Webhook**
- **Current URL**: `https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj`
- **Purpose**: Sends formatted email to requester when their request is denied
- **Use Cases**:
  - Request declined by Stock Controller or Ops Manager
  - Contains formatted HTML email with denial reason

### 3. **Dispatch Notification Webhook** ⭐ NEW
- **URL**: `https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913`
- **Purpose**: Notifies when items have been dispatched/shipped
- **Use Cases**:
  - Items picked and loaded
  - Driver and vehicle information available
  - Gate release completed

---

## Detailed Webhook Payloads

### 1. General Workflow Webhook Payload

**Trigger Points:**
- REQUEST_SUBMITTED → Operations Manager approval needed
- AWAITING_OPS_MANAGER → Stock Controller approval needed
- AWAITING_EQUIP_MANAGER → Equipment Manager approval needed
- AWAITING_PICKING → Storeman/Stock Controller picking needed
- PICKED_AND_LOADED → Driver/Security gate release needed
- DISPATCHED → Driver/Site Manager EPOD confirmation needed
- EPOD_CONFIRMED → Requester acceptance/rejection needed
- REQUEST_DECLINED → Requester notification
- REJECTED_AT_DELIVERY → Stock Controller return processing needed

**Payload Structure:**
```json
{
  "actionType": "APPROVAL" | "DECLINE" | "REJECTION" | "ACCEPTANCE" | "SALVAGE_DECISION",
  "requestNumber": "REQ-001",
  "previousStatus": "Request Submitted",
  "newStatus": "Awaiting Ops Manager",
  "actor": {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Operations Manager"
  },
  "comment": "Optional comment text",
  "timestamp": "2026-01-19T15:30:00.000Z",
  "workflowId": "uuid-here",
  "approver1": "ops.manager@example.com",
  "approver2": "stock.controller@example.com",
  "approver3": "admin@example.com"
}
```

**Next Approver Routing:**
- `REQUEST_SUBMITTED` → Notifies: Operations Manager, Admin
- `AWAITING_OPS_MANAGER` → Notifies: Stock Controller, Admin
- `AWAITING_EQUIP_MANAGER` → Notifies: Equipment Manager, Operations Manager, Admin
- `AWAITING_PICKING` → Notifies: Stock Controller, Storeman, Operations Manager, Admin
- `PICKED_AND_LOADED` → Notifies: Driver, Security
- `DISPATCHED` → Notifies: Original requester
- `EPOD_CONFIRMED` → Notifies: Original requester
- `REQUEST_DECLINED` → Notifies: Original requester
- `REJECTED_AT_DELIVERY` → Notifies: Stock Controller, Operations Manager, Admin

---

### 2. Denial Webhook Payload

**Trigger Point:** When a request is declined at approval stage

**Payload Structure:**
```json
{
  "requesterName": "Jane Smith",
  "requesterEmail": "jane.smith@example.com",
  "subject": "REQ-001 Denied",
  "body": "<!DOCTYPE html>...formatted HTML email..."
}
```

**HTML Email Template Includes:**
- Request number
- Site/Project name
- Department/Store
- Priority level
- Denial reason/comments
- Formatted styling matching company branding

---

### 3. Dispatch Notification Webhook ⭐ NEW

**Trigger Point:** When items are dispatched (PICKED_AND_LOADED → DISPATCHED)

**Payload Structure:**
```json
{
  "requestNumber": "REQ-001",
  "projectCode": "Site A",
  "department": "Operations",
  "priority": "High",
  "requester": "Jane Smith",
  "items": [
    {
      "partNumber": "PART-001",
      "description": "Sample Item",
      "quantityRequested": 5,
      "quantityOnHand": 10
    }
  ],
  "dispatchedBy": {
    "name": "Security Guard",
    "email": "security@example.com",
    "role": "Security"
  },
  "timestamp": "2026-01-19T15:30:00.000Z",
  "workflowId": "uuid-here",
  "driverName": "John Driver",
  "vehicleRegistration": "ABC-123"
}
```

**Intended Recipients:**
- Site Manager at destination
- Original requester
- Driver (for confirmation)

---

## Email Notification Matrix

| Workflow Step | Webhook Used | Who Gets Notified | Email Purpose |
|---------------|--------------|-------------------|---------------|
| **1. Request Submitted** | General Workflow | Operations Manager, Admin | "New request needs your approval" |
| **2. Awaiting Ops Manager** | General Workflow | Stock Controller, Admin | "Request approved by Ops Manager, needs your review" |
| **3. Awaiting Equipment Manager** | General Workflow | Equipment Manager, Operations Manager, Admin | "Equipment approval needed" |
| **4. Awaiting Picking** | General Workflow | Storeman, Stock Controller, Operations Manager, Admin | "Items ready for picking" |
| **5. Picked & Loaded** | General Workflow | Driver, Security | "Ready for gate release" |
| **6. Dispatched** | Dispatch Webhook ⭐ | Site Manager, Requester, Driver | "Items dispatched - delivery in progress" |
| **7. EPOD Confirmed** | General Workflow | Original Requester | "Please confirm receipt or report issues" |
| **8. Completed** | General Workflow | None | Workflow complete |
| **Request Declined** | Denial Webhook | Original Requester | "Your request was declined - see reason" |
| **Rejected at Delivery** | General Workflow | Stock Controller, Operations Manager, Admin | "Items rejected - return processing needed" |

---

## Stock Intake & Salvage Webhooks

Currently, salvage workflow decisions use the **General Workflow Webhook** with these status transitions:

- `SALVAGE_TO_BE_REPAIRED` or `SALVAGE_TO_BE_SCRAPPED` → Notifies: Equipment Manager, Operations Manager, Admin
- `SALVAGE_REPAIR_CONFIRMED` or `SALVAGE_SCRAP_CONFIRMED` → Notifies: Stock Controller, Operations Manager, Admin

---

## Implementation Notes

### Current Webhook Service Location
- **File**: `services/webhookService.ts`
- **Functions**:
  - `sendApprovalWebhook()` - General workflow changes
  - `sendDenialWebhook()` - Request denials
  - `sendDispatchWebhook()` - Dispatch notifications ⭐ NEW

### Webhook Calls in Code
- **Requests Component**: `components/Requests.tsx` - Calls approval/denial webhooks
- **WorkflowDetailModal**: `components/WorkflowDetailModal.tsx` - Calls approval webhook
- **GateReleaseForm**: `components/forms/GateReleaseForm.tsx` - Calls dispatch webhook ⭐ NEW
- **Equipment Manager**: `components/EquipmentManager.tsx` - Calls approval webhook
- **Picking**: `components/Picking.tsx` - Calls approval webhook

---

## Permissions & Access Control Summary

### Stock Intake Permissions:
- **Can book into ALL stores (including Salvage)**: Admin, Stock Controller (Mitzi)
- **Can book into Operations store only**: Operations Managers (if assigned to Operations department)
- **Cannot book into Salvage**: Operations Managers, Equipment Managers
- **Salvage is restricted to**: Stock Controller only (and Admin)

### Approval Permissions:
- **Step 1 (REQUEST_SUBMITTED)**: Operations Manager, Admin
- **Step 2 (AWAITING_OPS_MANAGER)**: Stock Controller, Admin
- **Step 3 (AWAITING_EQUIP_MANAGER)**: Equipment Manager, Operations Manager (view), Admin
- **Step 4 (AWAITING_PICKING)**: Stock Controller, Storeman, Operations Manager (view), Admin
- **Step 5 (PICKED_AND_LOADED)**: Driver, Security, Operations Manager (view), Admin
- **Step 6 (DISPATCHED)**: Driver, Site Manager, Operations Manager (view), Admin
- **Step 7 (EPOD_CONFIRMED)**: Original Requester

### Site Access Control:
- **Admin**: Access to ALL sites
- **All other roles**: Restricted to assigned sites only
- **Operations Managers**: Can VIEW all requests for their assigned sites but can only ACT at Step 2 (Ops Manager Approval)

---

## Testing Webhooks

To test each webhook in Make.com:

1. **General Workflow Webhook**: Create a test request and approve it through each stage
2. **Denial Webhook**: Create a test request and decline it with a comment
3. **Dispatch Webhook**: Create a test request, approve it through all stages, and dispatch it with driver/vehicle info

### Sample Test Flow:
1. Login as Site Manager → Create new stock request
2. Login as Operations Manager → Approve request (webhook 1 fired)
3. Login as Stock Controller → Approve request (webhook 1 fired)
4. Login as Equipment Manager → Approve equipment (webhook 1 fired)
5. Login as Storeman → Pick items (webhook 1 fired)
6. Login as Security → Dispatch items (webhook 3 fired ⭐)
7. Login as Site Manager → Confirm EPOD (webhook 1 fired)
8. Login as Requester → Accept delivery (webhook 1 fired)

---

## Migration Required

**Database Migration File**: `supabase/migrations/20260119_add_awaiting_ops_manager_status.sql`

This migration adds the new `AWAITING_OPS_MANAGER` workflow status to the database enum. Apply this migration to your Supabase instance before deploying the changes.

---

## Summary

✅ **3 webhooks required in total**
✅ **All workflow stages covered**
✅ **Site access control enforced**
✅ **Stock intake restricted to Stock Controller for Salvage**
✅ **Operations Managers can VIEW all but only ACT at their approval step**
✅ **Email notifications route to correct approvers at each stage**
