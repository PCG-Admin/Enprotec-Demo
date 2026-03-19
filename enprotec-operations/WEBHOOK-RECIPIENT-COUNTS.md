# Webhook Recipient Counts - Complete Summary

## Overview

This document shows **exactly how many recipients** receive emails for each workflow trigger in the Enprotec Workflow Management System.

The number of recipients depends on:
1. How many **Active** users exist in the database with each role
2. **Site and Department Assignments** - Users must be assigned to BOTH the workflow's site AND department
3. **Admin Bypass** - Admins with no site restrictions receive all notifications

## Important Filtering Rules

**General Workflow Emails**: Recipients are filtered by site and department assignments. Only users assigned to BOTH the workflow's site AND department receive notifications.

**Dispatch Emails**: Sent to ALL workflow participants (everyone involved in workflows for that site/department).

**Denial Emails**: Sent only to the original requester.

---

## Site and Department Filtering Logic

### How Filtering Works

For every workflow email (except denial which always goes to requester):

```javascript
// Pseudo-code for recipient filtering
function shouldReceiveEmail(user, workflow) {
    // Admin bypass
    if (user.role === 'Admin' && (!user.sites || user.sites.length === 0)) {
        return true; // Admin with no restrictions receives ALL emails
    }

    // Check site access
    const hasSiteAccess = user.sites.includes(workflow.projectCode);

    // Check department access
    const hasDepartmentAccess = user.departments.includes(workflow.department);

    // Must have BOTH
    return hasSiteAccess && hasDepartmentAccess;
}
```

### Example

**Workflow Details:**
- Site: "Site A"
- Department: "Operations"

**User 1 - Operations Manager:**
- Sites: ["Site A", "Site B"]
- Departments: ["Operations", "Projects"]
- **Result**: ✅ Receives email (has both Site A AND Operations)

**User 2 - Operations Manager:**
- Sites: ["Site B"]
- Departments: ["Operations"]
- **Result**: ❌ Does NOT receive email (missing Site A)

**User 3 - Admin:**
- Sites: [] (empty or null)
- Departments: ["Operations"]
- **Result**: ✅ Receives email (Admin bypass - no site restrictions)

**User 4 - Admin:**
- Sites: ["Site A"]
- Departments: ["Projects"]
- **Result**: ❌ Does NOT receive email (has Site A but missing Operations department)

---

## Stock Workflow - Email Recipient Counts

### 1. New Stock Request Submitted
- **Status Change**: `null` → `REQUEST_SUBMITTED`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Operations Manager** (status = Active) **assigned to this site AND department**
  - All users with role **Admin** (status = Active) **assigned to this site AND department**
  - Admins with no site restrictions receive all notifications
- **Expected Count**: `COUNT(Filtered Operations Managers) + COUNT(Filtered Admins)`
- **Example**: If workflow is for Site A/Operations Department:
  - 2 Ops Managers assigned to Site A/Operations
  - 1 Admin assigned to Site A/Operations
  - 2 Admins with no site restrictions
  - **Total: 5 recipients**

---

### 2. Operations Manager Approves
- **Status Change**: `REQUEST_SUBMITTED` → `AWAITING_OPS_MANAGER`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Stock Controller** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Stock Controllers) + COUNT(Admins)`
- **Example**: If 1 Stock Controller + 3 Admins → **4 recipients**

---

### 3. Stock Controller Approves
- **Status Change**: `AWAITING_OPS_MANAGER` → `AWAITING_EQUIP_MANAGER`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Equipment Manager** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Equipment Managers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Equip Mgr + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

### 4. Equipment Manager Approves
- **Status Change**: `AWAITING_EQUIP_MANAGER` → `AWAITING_PICKING`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Stock Controller** (status = Active)
  - All users with role **Storeman** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Stock Controllers) + COUNT(Storemen) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Stock Ctrl + 2 Storemen + 2 Ops Mgrs + 3 Admins → **8 recipients**

---

### 5. Storeman Picks Items
- **Status Change**: `AWAITING_PICKING` → `PICKED_AND_LOADED`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Driver** (status = Active)
  - All users with role **Security** (status = Active)
- **Expected Count**: `COUNT(Drivers) + COUNT(Security)`
- **Example**: If 3 Drivers + 2 Security → **5 recipients**

---

### 6. Security/Driver Dispatches Items (Gate Release)
- **Status Change**: `PICKED_AND_LOADED` → `DISPATCHED`
- **Webhooks**:
  1. General Workflow Webhook (Approval) - Sent to original requester
  2. Dispatch Webhook - **Sent to ALL workflow participants**
- **Recipients for General Workflow**: **Original Requester** (1 recipient)
- **Recipients for Dispatch Webhook**: **ALL workflow participants assigned to this site AND department**
  - Original Requester
  - Operations Managers (assigned to site/department)
  - Stock Controllers (assigned to site/department)
  - Equipment Managers (assigned to site/department)
  - Storemen (assigned to site/department)
  - Drivers (assigned to site/department)
  - Security (assigned to site/department)
  - Admins (assigned to site/department OR with no restrictions)
- **Expected Count for Dispatch**: Variable - depends on how many workflow participants are assigned to this site/department
- **Example**: If 1 Requester + 2 Ops Mgrs + 1 Stock Ctrl + 1 Equip Mgr + 2 Storemen + 3 Drivers + 2 Security + 3 Admins = **15 recipients for dispatch email**

---

### 7. Driver/Site Manager Confirms EPOD
- **Status Change**: `DISPATCHED` → `EPOD_CONFIRMED`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - **Original Requester** (person who submitted the request)
- **Expected Count**: **1 recipient** (always)

---

### 8. Requester Accepts Delivery
- **Status Change**: `EPOD_CONFIRMED` → `COMPLETED`
- **Webhook**: General Workflow Webhook (Acceptance)
- **Recipients**: **NONE** (workflow complete, no notification needed)
- **Expected Count**: **0 recipients**

---

### 9. Request Declined (at any approval stage)
- **Status Change**: Any status → `REQUEST_DECLINED`
- **Webhooks**:
  1. Denial Webhook (formatted HTML email to requester)
  2. General Workflow Webhook (Decline)
- **Recipients**:
  - **Original Requester** (person who submitted the request)
- **Expected Count**: **1 recipient** (always)
- **Note**: Both webhooks send to the same recipient

---

### 10. Items Rejected at Delivery
- **Status Change**: `EPOD_CONFIRMED` → `REJECTED_AT_DELIVERY`
- **Webhook**: General Workflow Webhook (Rejection)
- **Recipients**:
  - All users with role **Stock Controller** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Stock Controllers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Stock Ctrl + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

### 11. Stock Controller Processes Return
- **Status Change**: `REJECTED_AT_DELIVERY` → `COMPLETED`
- **Webhook**: General Workflow Webhook (Acceptance)
- **Recipients**: **NONE** (workflow complete, no notification needed)
- **Expected Count**: **0 recipients**

---

## Salvage Workflow - Email Recipient Counts

### 12. Equipment Manager Makes Salvage Decision (Repair)
- **Status Change**: → `SALVAGE_TO_BE_REPAIRED`
- **Webhook**: General Workflow Webhook (Salvage Decision)
- **Recipients**:
  - All users with role **Equipment Manager** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Equipment Managers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Equip Mgr + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

### 13. Equipment Manager Makes Salvage Decision (Scrap)
- **Status Change**: → `SALVAGE_TO_BE_SCRAPPED`
- **Webhook**: General Workflow Webhook (Salvage Decision)
- **Recipients**:
  - All users with role **Equipment Manager** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Equipment Managers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Equip Mgr + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

### 14. Stock Controller Confirms Repair Decision
- **Status Change**: → `SALVAGE_REPAIR_CONFIRMED`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Stock Controller** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Stock Controllers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Stock Ctrl + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

### 15. Stock Controller Confirms Scrap Decision
- **Status Change**: → `SALVAGE_SCRAP_CONFIRMED`
- **Webhook**: General Workflow Webhook (Approval)
- **Recipients**:
  - All users with role **Stock Controller** (status = Active)
  - All users with role **Operations Manager** (status = Active)
  - All users with role **Admin** (status = Active)
- **Expected Count**: `COUNT(Stock Controllers) + COUNT(Ops Managers) + COUNT(Admins)`
- **Example**: If 1 Stock Ctrl + 2 Ops Mgrs + 3 Admins → **6 recipients**

---

## Summary Table

| # | Trigger Event | Webhook Type | Roles Notified | Typical Count |
|---|---------------|--------------|----------------|---------------|
| 1 | Submit Request | Approval | Ops Mgr, Admin | 5 |
| 2 | Ops Mgr Approves | Approval | Stock Ctrl, Admin | 4 |
| 3 | Stock Ctrl Approves | Approval | Equip Mgr, Ops Mgr, Admin | 6 |
| 4 | Equip Mgr Approves | Approval | Stock Ctrl, Storeman, Ops Mgr, Admin | 8 |
| 5 | Storeman Picks | Approval | Driver, Security | 5 |
| 6 | Gate Release | Approval + Dispatch | Original Requester | 1 |
| 7 | EPOD Confirmed | Approval | Original Requester | 1 |
| 8 | Requester Accepts | Acceptance | None | 0 |
| 9 | Request Declined | Denial + Approval | Original Requester | 1 |
| 10 | Items Rejected | Rejection | Stock Ctrl, Ops Mgr, Admin | 6 |
| 11 | Process Return | Acceptance | None | 0 |
| 12 | Salvage: Repair | Salvage Decision | Equip Mgr, Ops Mgr, Admin | 6 |
| 13 | Salvage: Scrap | Salvage Decision | Equip Mgr, Ops Mgr, Admin | 6 |
| 14 | Confirm Repair | Approval | Stock Ctrl, Ops Mgr, Admin | 6 |
| 15 | Confirm Scrap | Approval | Stock Ctrl, Ops Mgr, Admin | 6 |

---

## Important Notes

### How Recipients Are Determined

1. **Role-Based + Site/Department Filtered**: Most triggers send emails to Active users with specific roles WHO ARE ASSIGNED to the workflow's site AND department
2. **Site Assignment Check**: User's `sites` array must include the workflow's `projectCode`
3. **Department Assignment Check**: User's `departments` array must include the workflow's `department`
4. **Both Required**: Users must pass BOTH checks (site AND department) to receive notifications
5. **Admin Bypass**: Admins with empty/null `sites` array receive ALL notifications regardless of site/department
6. **Requester Always Included**: For dispatch emails, the original requester is always included even if not assigned to that site/department
7. **Active Users Only**: Only users with `status = 'Active'` in the database receive emails
8. **Dispatch Exception**: Dispatch webhook sends to ALL workflow participants (all roles) assigned to the site/department

### Example User Database

**Scenario**: Workflow for Site A, Operations Department

User Database:
- 2 Operations Managers (Active) - **both** assigned to Site A/Operations
- 1 Stock Controller (Active) - assigned to Site A/Operations
- 1 Equipment Manager (Active) - assigned to Site A/Operations
- 2 Storemen (Active) - assigned to Site A/Operations
- 3 Drivers (Active) - assigned to Site A/Operations
- 2 Security (Active) - assigned to Site A/Operations
- 2 Admins (Active) - assigned to Site A/Operations
- 1 Admin (Active) - **no site restrictions** (receives all)
- 5 Regular Users (Active) - assigned to Site A/Operations

Then for **Site A/Operations Department workflows**:
- **Trigger #1** (Submit Request): 2 Ops Mgrs + 3 Admins = **5 emails**
- **Trigger #2** (Ops Mgr Approves): 1 Stock Ctrl + 3 Admins = **4 emails**
- **Trigger #3** (Stock Ctrl Approves): 1 Equip Mgr + 2 Ops Mgrs + 3 Admins = **6 emails**
- **Trigger #4** (Equip Mgr Approves): 1 Stock Ctrl + 2 Storemen + 2 Ops Mgrs + 3 Admins = **8 emails**
- **Trigger #5** (Storeman Picks): 3 Drivers + 2 Security = **5 emails**
- **Trigger #6** (Gate Release - General): **1 email** (requester only)
- **Trigger #6** (Gate Release - Dispatch): **15 emails** (all workflow participants)
- **Trigger #7** (EPOD): **1 email** (requester only)
- **Trigger #9** (Decline): **1 email** (requester only)

**Users assigned to different sites/departments will NOT receive these emails.**

---

## Webhook Payload Structure

Each webhook receives:
```json
{
  "subject": "REQ-001 - Approved",
  "body": "<!DOCTYPE html>...<full HTML email>...",
  "recipientEmails": [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com"
  ],
  "recipientNames": [
    "John Ops Manager",
    "Jane Admin",
    "Bob Admin"
  ],
  ... additional metadata ...
}
```

The **number of items** in `recipientEmails` and `recipientNames` arrays = **number of emails sent**.

---

## Testing

To verify correct recipient counts:
1. Query your database for count of Active users per role
2. Use the formulas above to calculate expected recipients
3. Trigger the workflow action
4. Check webhook payload received by Make.com
5. Verify `recipientEmails.length` matches expected count
