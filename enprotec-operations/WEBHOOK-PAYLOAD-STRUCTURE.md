# Webhook Payload Structure - Updated (Individual Recipients)

## Overview
All webhook email notifications have been restructured to simplify integration with Make.com automation platform.

## Changes Made

### 1. Recipient Information Structure
**Before:**
```json
{
  "recipientEmails": ["email1@example.com", "email2@example.com", "email3@example.com"],
  "recipientNames": ["Name 1", "Name 2", "Name 3"]
}
```

**After:**
```json
{
  "email1": "email1@example.com",
  "name1": "Name 1",
  "email2": "email2@example.com",
  "name2": "Name 2",
  "email3": "email3@example.com",
  "name3": "Name 3"
}
```

**Benefit:** No need for array iteration in Make.com - each recipient is a separate field that can be directly mapped.

---

### 2. Workflow Information in HTML Body
**Before:**
- Separate JSON fields for `actor`, `previousStatus`, `newStatus`, `comment`, `timestamp`, etc.
- Required manual mapping in Make.com to construct email content

**After:**
- All information embedded directly in the HTML `body` field
- Actor details (name, email, role, timestamp) displayed in a dedicated card
- Status changes shown in formatted table
- Comments highlighted in separate section
- Request details (site, department, priority) formatted in the HTML

**Benefit:** Complete, formatted email is ready to send without additional processing.

---

## Updated Payload Structures

### General Workflow Webhook (Approval/Decline/Rejection/Acceptance)

**Webhook URL:** `https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv`

**Payload:**
```json
{
  "subject": "REQ-2024-001 - Approved",
  "body": "<html>...fully formatted email with all details...</html>",
  "email1": "recipient1@example.com",
  "name1": "Recipient Name 1",
  "email2": "recipient2@example.com",
  "name2": "Recipient Name 2"
  // ... email3, name3, email4, name4, etc. for additional recipients
}
```

**HTML Body Includes:**
- Request number and details card:
  - Site/Project
  - Department
  - Priority
  - Requested by
- Status update card:
  - Previous status
  - New status
- **Action taken by card** (NEW):
  - Actor name
  - Actor email
  - Actor role
  - Timestamp (formatted as "21 January 2026, 10:45 AM")
- Comments card (if comments provided)

---

### Denial Webhook

**Webhook URL:** `https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj`

**Payload:**
```json
{
  "subject": "REQ-2024-001 - Denied",
  "body": "<html>...fully formatted email with all details...</html>",
  "email1": "requester@example.com",
  "name1": "Requester Name"
}
```

**HTML Body Includes:**
- Denial badge and notice
- Reason for denial (comments)
- Request summary:
  - Request number
  - Site/Project
  - Department/Store
  - Priority
  - Status (Denied)

---

### Dispatch Webhook

**Webhook URL:** `https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913`

**Payload:**
```json
{
  "subject": "REQ-2024-001 - Items Dispatched",
  "body": "<html>...fully formatted email with all details...</html>",
  "email1": "participant1@example.com",
  "name1": "Participant Name 1",
  "email2": "participant2@example.com",
  "name2": "Participant Name 2"
  // ... email3, name3, email4, name4, etc. for all workflow participants
}
```

**HTML Body Includes:**
- Dispatch badge
- Delivery information card:
  - Driver name
  - Vehicle registration
  - Destination (site)
  - Department
  - Dispatched by (name and role)
- Items table:
  - Part numbers
  - Descriptions
  - Quantities
- Priority badge (if applicable)

---

## Make.com Integration Guide

### Setup for Each Recipient

Since recipients are now individual fields instead of arrays:

1. **In Make.com scenario:**
   - Map `email1` → Recipient 1 email address
   - Map `name1` → Recipient 1 name
   - Map `email2` → Recipient 2 email address
   - Map `name2` → Recipient 2 name
   - Continue for all recipients (up to the maximum number expected)

2. **Email content:**
   - Use the `subject` field directly as email subject
   - Use the `body` field directly as HTML email body
   - **No additional processing required** - all details are already formatted in the HTML

### Example Make.com Email Module Configuration

**Option 1: Send Individual Emails**
```
Module 1 - Email to Recipient 1:
  To: {{email1}}
  Subject: {{subject}}
  Body Type: HTML
  Body Content: {{body}}

Module 2 - Email to Recipient 2 (if email2 exists):
  To: {{email2}}
  Subject: {{subject}}
  Body Type: HTML
  Body Content: {{body}}

Module 3 - Email to Recipient 3 (if email3 exists):
  To: {{email3}}
  Subject: {{subject}}
  Body Type: HTML
  Body Content: {{body}}
```

**Option 2: Conditional Router**
```
1. Webhook Trigger
   ↓
2. Router with filters:
   - Route 1: If email1 exists → Send to email1
   - Route 2: If email2 exists → Send to email2
   - Route 3: If email3 exists → Send to email3
   - etc.
```

---

## Benefits Summary

1. **Simpler Mapping:** No array iteration needed - direct field mapping in Make.com
2. **Self-Contained Emails:** All information embedded in HTML body
3. **Consistent Formatting:** Professional, branded email templates with Enprotec colors
4. **Text-Only Branding:** No image dependencies - "ENPROTEC" header text ensures fast loading
5. **Actor Visibility:** Who did what is clearly displayed in the email
6. **Timestamp Clarity:** Human-readable timestamp format (e.g., "21 January 2026, 10:45 AM")
7. **Mobile-Responsive:** HTML emails render well on all devices
8. **Easy Testing:** Use the "Test Email" button on the Email Test page to verify

---

## Testing

To test the new payload structure:

1. Navigate to **Email Test** page in the application
2. Click **Test General Workflow Email**
3. Check the webhook receiver in Make.com
4. Verify that:
   - `email1`, `name1`, `email2`, `name2` fields are populated (not arrays)
   - `body` contains full HTML with actor details, status, and timestamp
   - No separate `actor`, `previousStatus`, `newStatus`, `actionType`, `comment`, `timestamp`, `workflowId` fields

---

## Migration Notes

**Files Modified:**
- `services/webhookService.ts` - Updated all three webhook functions:
  - `sendApprovalWebhook()` - Lines 579-591
  - `sendDenialWebhook()` - Lines 749-754
  - `sendDispatchWebhook()` - Lines 828-840
  - `generateWorkflowEmailHTML()` - Lines 315-406 (added actor details card)

**Backward Compatibility:**
- ⚠️ **Breaking change** - Make.com scenarios must be updated to use new field structure
- Old `recipientEmails` and `recipientNames` arrays removed
- Old separate `actor`, `comment`, `timestamp`, `actionType`, `previousStatus`, `newStatus`, `workflowId` fields removed
- All information now in:
  - `subject` field
  - `body` field (HTML with all details embedded)
  - `email1`, `name1`, `email2`, `name2`, etc. fields

---

## Example Full Payloads

### Approval Webhook Example
```json
{
  "subject": "REQ-2024-001 - Approved",
  "body": "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/>...[full HTML with actor card, status card, comments]...</html>",
  "email1": "ops.manager@enprotec.com",
  "name1": "John Ops Manager",
  "email2": "admin@enprotec.com",
  "name2": "Admin User"
}
```

### Denial Webhook Example
```json
{
  "subject": "REQ-2024-001 - Denied",
  "body": "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/>...[full HTML with denial reason, request summary]...</html>",
  "email1": "requester@enprotec.com",
  "name1": "Jane Requester"
}
```

### Dispatch Webhook Example
```json
{
  "subject": "REQ-2024-001 - Items Dispatched",
  "body": "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/>...[full HTML with delivery info, items table]...</html>",
  "email1": "requester@enprotec.com",
  "name1": "Jane Requester",
  "email2": "stock.controller@enprotec.com",
  "name2": "Mitzi Stock",
  "email3": "admin@enprotec.com",
  "name3": "Admin User"
}
```

---

**Date:** 2026-01-21
**Status:** ✅ Implemented and Ready for Testing
**Updated By:** Claude Code Assistant
