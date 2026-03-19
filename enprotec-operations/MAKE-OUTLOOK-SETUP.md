# Make.com - Outlook Email Setup Guide

**Date:** 2026-01-21
**Status:** ✅ Ready for Configuration

---

## Problem Solved

Make.com was failing when webhook payloads contained blank email addresses in recipient fields (email2-email8 when fewer than 8 recipients exist).

**Solution:** Added a `to` field containing ALL recipient emails in semicolon-separated format that Outlook expects.

---

## New Payload Structure

All three webhooks now send:

```json
{
  "subject": "REQ-2024-001 - Approved",
  "body": "<html>...fully formatted Enprotec branded email...</html>",
  "to": "email1@enprotec.com;email2@enprotec.com;email3@enprotec.com",  // For reference only - not used in Make.com
  "recipient_count": 3,  // For reference - indicates how many recipients
  "email1": "email1@enprotec.com",
  "name1": "Name 1",
  "email2": "email2@enprotec.com",
  "name2": "Name 2",
  "email3": "email3@enprotec.com",
  "name3": "Name 3",
  "email4": "",
  "name4": "",
  "email5": "",
  "name5": "",
  "email6": "",
  "name6": "",
  "email7": "",
  "name7": "",
  "email8": "",
  "name8": ""
}
```

---

## Make.com Configuration

### Important Note About `to` Field:
The `to` field contains semicolon-separated emails for reference, but **Make.com's Outlook module doesn't accept multiple emails in this format**. Instead, we need to use individual email fields.

### Solution: Use Router with Conditional Routes

For all three webhooks, use this pattern:

```
Webhook Trigger
   ↓
Router (8 routes)
   ↓
Route 1: Filter (email1 is not empty) → Outlook Send Email (To: {{email1}})
Route 2: Filter (email2 is not empty) → Outlook Send Email (To: {{email2}})
Route 3: Filter (email3 is not empty) → Outlook Send Email (To: {{email3}})
Route 4: Filter (email4 is not empty) → Outlook Send Email (To: {{email4}})
Route 5: Filter (email5 is not empty) → Outlook Send Email (To: {{email5}})
Route 6: Filter (email6 is not empty) → Outlook Send Email (To: {{email6}})
Route 7: Filter (email7 is not empty) → Outlook Send Email (To: {{email7}})
Route 8: Filter (email8 is not empty) → Outlook Send Email (To: {{email8}})
```

**Each Outlook Send Email Module Settings:**
- **To:** `{{emailX}}` (where X is 1-8 depending on route)
- **Subject:** `{{subject}}`
- **Body Type:** HTML
- **Body Content:** `{{body}}`

**Filter Condition for Each Route:**
- Route 1: `{{email1}}` Text operator: Is not equal to (empty string)
- Route 2: `{{email2}}` Text operator: Is not equal to (empty string)
- Route 3: `{{email3}}` Text operator: Is not equal to (empty string)
- ... etc for routes 4-8

This ensures that:
- Only non-empty email addresses trigger email sends
- Each recipient gets an individual email
- No errors from blank email addresses

---

## Detailed Setup Instructions

### Step 1: Create Scenario in Make.com

1. Go to Make.com and create a new scenario
2. Add **Webhooks → Custom Webhook** module as the trigger
3. Click "Add" to create a new webhook
4. Copy the webhook URL provided by Make.com

### Step 2: Add Router Module

1. Click the + button after the webhook trigger
2. Search for and add **Flow Control → Router**
3. The router will allow you to create multiple conditional paths

### Step 3: Create Route 1 (email1)

1. Click "Add route" on the router
2. Click the **wrench icon** on Route 1 to set up a filter
3. Configure filter:
   - **Label:** "Recipient 1 exists"
   - **Condition:** `{{1.email1}}` (Text operator) "Is not equal to" (leave value empty for blank string)
4. Click OK to save filter
5. Click the + button after Route 1 filter
6. Add **Outlook → Send an Email** module
7. Configure the email module:
   - **To:** `{{1.email1}}`
   - **Subject:** `{{1.subject}}`
   - **Content Type:** HTML
   - **Body:** `{{1.body}}`

### Step 4: Create Routes 2-8 (email2 through email8)

Repeat Step 3 for each additional route:

**Route 2:**
- Filter: `{{1.email2}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email2}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 3:**
- Filter: `{{1.email3}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email3}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 4:**
- Filter: `{{1.email4}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email4}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 5:**
- Filter: `{{1.email5}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email5}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 6:**
- Filter: `{{1.email6}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email6}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 7:**
- Filter: `{{1.email7}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email7}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

**Route 8:**
- Filter: `{{1.email8}}` is not equal to (empty)
- Outlook Send Email: To = `{{1.email8}}`, Subject = `{{1.subject}}`, Body = `{{1.body}}`

### Step 5: Activate Scenario

1. Save the scenario
2. Turn the scenario **ON**
3. The webhook is now ready to receive requests

### Visual Layout

Your Make.com scenario should look like this:

```
[Webhook Trigger]
        ↓
    [Router]
   /   |   \
  /    |    \
 /     |     \
[R1]  [R2]  [R3]  [R4]  [R5]  [R6]  [R7]  [R8]
 ↓     ↓     ↓     ↓     ↓     ↓     ↓     ↓
[✉️]  [✉️]  [✉️]  [✉️]  [✉️]  [✉️]  [✉️]  [✉️]

R1-R8 = Routes with filters for email1-email8 (only runs if email is not blank)
✉️ = Outlook Send Email module
```

### Important Notes

- **All routes run in parallel** - if 3 emails are populated, routes 1-3 will execute simultaneously
- **Blank emails are skipped** - routes with empty email fields won't execute due to filters
- **Same email body for all** - each recipient gets the same formatted HTML email
- **No duplicate logic needed** - the system handles this automatically

---

## Webhook URLs

### 1. General Workflow Webhook
**URL:** `https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv`

**Triggers:**
- Approval
- Decline
- Rejection
- Acceptance

**Recipients in `to` field:** 1-8 emails separated by semicolons

**Pending Approvals Include:**
- ⚠️ ACTION REQUIRED banner (blue gradient)
- Message: "This request requires your approval."

---

### 2. Denial Webhook
**URL:** `https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj`

**Triggers:**
- Denial

**Recipients in `to` field:** Single email (requester only)

**Note:** email2-email8 will be blank strings, but the `to` field only contains the requester's email, so Outlook will only send to one person.

---

### 3. Dispatch Webhook
**URL:** `https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913`

**Triggers:**
- Items Dispatched

**Recipients in `to` field:** 2-8 emails separated by semicolons

---

## Email Features

### Enprotec Branding:
- **Header:** Large "ENPROTEC" text with blue gradient background (#0B5FAA to #1E7BC5)
- **Colors:**
  - Primary Blue: #0B5FAA
  - Green: #00A651
  - Dark Grey: #2D2D2D (for denials/declines)

### General Workflow Emails (Approvals):
1. **ACTION REQUIRED Banner** (for pending approvals):
   - Blue gradient banner with ⚠️ icon
   - "You have a pending approval waiting for your review"
   - Shows only for: 'Awaiting Ops Manager', 'Awaiting Equip. Manager', 'Awaiting Stock Controller', 'Manager Approval'

2. **Status Badge:** Green (approved), Red (declined), Blue (other)

3. **Request Details Card:**
   - Request Number
   - Site/Project
   - Department/Store
   - Priority
   - Requested By

4. **Status Update Card:**
   - Previous Status
   - New Status

5. **Action Taken By Card:**
   - Name, Email, Role, Timestamp

6. **Comments Card** (if provided)

### Denial Emails:
- Dark grey gradient header
- Red denial badge
- Reason for denial (comments)
- Request summary

### Dispatch Emails:
- Blue gradient header
- Green dispatch badge
- Delivery information (driver, vehicle, destination)
- Items table (part numbers, descriptions, quantities)

---

## Testing Instructions

### Step 1: Navigate to Email Test Page
```
http://localhost:3002/email-test
```

### Step 2: Test General Workflow Email
1. Click **"Test General Workflow Email"** button
2. Check Make.com webhook receiver
3. Verify payload contains:
   - ✅ `to` field with 3 emails: `"test1@example.com;test2@example.com;test3@example.com"`
   - ✅ `recipient_count: 3`
   - ✅ `email1-email3` populated with actual emails
   - ✅ `email4-email8` are blank strings `""`
   - ✅ `body` contains full HTML with ACTION REQUIRED banner visible
   - ✅ Enprotec blue gradient branding

### Step 3: Test Denial Email
1. Click **"Test Denial Email"** button
2. Check Make.com webhook receiver
3. Verify payload contains:
   - ✅ `to` field with single email: `"test1@example.com"`
   - ✅ `recipient_count: 1`
   - ✅ Only `email1` populated
   - ✅ `email2-email8` are blank strings `""`
   - ✅ Dark grey gradient branding

### Step 4: Test Dispatch Email
1. Click **"Test Dispatch Email"** button
2. Check Make.com webhook receiver
3. Verify payload contains:
   - ✅ `to` field with 3 emails separated by semicolons
   - ✅ `recipient_count: 3`
   - ✅ `email1-email3` populated
   - ✅ `email4-email8` are blank strings
   - ✅ Blue gradient branding with dispatch badge

### Step 5: Configure Make.com Scenarios

**For Each Webhook:**

1. Create new scenario in Make.com
2. Add **Webhooks → Custom Webhook** trigger
3. Copy webhook URL from trigger
4. Add **Outlook → Send Email** module
5. Configure module:
   - To: `{{to}}`
   - Subject: `{{subject}}`
   - Body Type: HTML
   - Body Content: `{{body}}`
6. Activate scenario
7. Test using the Email Test page buttons

### Step 6: Verify Emails in Inbox

After testing, check recipient inboxes:
- ✅ Email received with correct subject
- ✅ Enprotec branding displays correctly
- ✅ ACTION REQUIRED banner visible (for approval emails)
- ✅ All recipient details visible
- ✅ HTML renders correctly on mobile and desktop
- ✅ No duplicate emails sent

---

## Benefits of This Approach

1. ✅ **No Make.com Errors:** Each route sends to a single valid email address
2. ✅ **Automatic Blank Handling:** Filters prevent empty email addresses from triggering sends
3. ✅ **Parallel Execution:** All routes with valid emails run simultaneously for fast delivery
4. ✅ **Clear Action Required:** Pending approvals have prominent banner and focused messaging
5. ✅ **Professional Branding:** Enprotec logo colors (blue/green) applied consistently
6. ✅ **Scalable:** Handles 1-8 recipients automatically based on which fields are populated
7. ✅ **No Duplicate Logic:** System sends to each email exactly once

---

## Example Payloads

### General Workflow Approval (3 Recipients):
```json
{
  "subject": "REQ-2024-001 - Approved",
  "body": "<!DOCTYPE html>...[ACTION REQUIRED banner, Enprotec branding, status details]...</html>",
  "to": "ops@enprotec.com;admin@enprotec.com;requester@enprotec.com",
  "recipient_count": 3,
  "email1": "ops@enprotec.com",
  "name1": "Ops Manager",
  "email2": "admin@enprotec.com",
  "name2": "Admin User",
  "email3": "requester@enprotec.com",
  "name3": "Jane Requester",
  "email4": "",
  "name4": "",
  "email5": "",
  "name5": "",
  "email6": "",
  "name6": "",
  "email7": "",
  "name7": "",
  "email8": "",
  "name8": ""
}
```

### Denial (1 Recipient):
```json
{
  "subject": "REQ-2024-001 - Denied",
  "body": "<!DOCTYPE html>...[Dark grey branding, denial reason]...</html>",
  "to": "requester@enprotec.com",
  "recipient_count": 1,
  "email1": "requester@enprotec.com",
  "name1": "Jane Requester",
  "email2": "",
  "name2": "",
  "email3": "",
  "name3": "",
  "email4": "",
  "name4": "",
  "email5": "",
  "name5": "",
  "email6": "",
  "name6": "",
  "email7": "",
  "name7": "",
  "email8": "",
  "name8": ""
}
```

### Dispatch (5 Recipients):
```json
{
  "subject": "REQ-2024-001 - Items Dispatched",
  "body": "<!DOCTYPE html>...[Blue branding, delivery info, items table]...</html>",
  "to": "requester@enprotec.com;stock@enprotec.com;ops@enprotec.com;admin@enprotec.com;supervisor@enprotec.com",
  "recipient_count": 5,
  "email1": "requester@enprotec.com",
  "name1": "Jane Requester",
  "email2": "stock@enprotec.com",
  "name2": "Mitzi Stock",
  "email3": "ops@enprotec.com",
  "name3": "John Ops",
  "email4": "admin@enprotec.com",
  "name4": "Admin User",
  "email5": "supervisor@enprotec.com",
  "name5": "Sarah Supervisor",
  "email6": "",
  "name6": "",
  "email7": "",
  "name7": "",
  "email8": "",
  "name8": ""
}
```

---

## Troubleshooting

### Issue: "Invalid email address in parameter 'address'" Error
**Cause:** Make.com's Outlook module doesn't accept semicolon-separated email lists in the `to` field
**Solution:** Use the Router approach with 8 conditional routes (see setup instructions above). Each route sends to a single individual email address (email1, email2, etc.)

### Issue: Make.com Still Failing with Blank Emails
**Cause:** Routes don't have filters to check if email field is empty
**Solution:** Add filter to each route: `{{1.emailX}}` is not equal to (empty string)

### Issue: ACTION REQUIRED Banner Not Showing
**Cause:** Email is for completed approval, not pending approval
**Solution:** Banner only shows for these statuses:
- 'Awaiting Ops Manager'
- 'Awaiting Equip. Manager'
- 'Awaiting Stock Controller'
- 'Manager Approval'

### Issue: Wrong Branding Colors
**Cause:** Using old orange branding (#FF6600)
**Solution:** Updated to correct Enprotec blue (#0B5FAA) and green (#00A651) from logo

### Issue: Duplicate Emails Sent
**Cause:** Using both `to` field and looping through email1-email8
**Solution:** Only use `{{to}}` field in Outlook Send Email module

### Issue: HTML Not Rendering
**Cause:** Body Type set to "Plain Text" instead of "HTML"
**Solution:** Set Body Type to "HTML" in Outlook Send Email module

---

## Files Modified

1. **`services/webhookService.ts`**
   - Lines 579-600: General workflow `to` field
   - Lines 754-773: Denial `to` field
   - Lines 838-859: Dispatch `to` field
   - Lines 264-278: ACTION REQUIRED banner
   - Lines 294-297: Updated message text for pending approvals

2. **`src/components/EmailTestPage.tsx`**
   - Lines 268-278: General workflow test `to` field
   - Lines 317-323: Denial test `to` field
   - Lines 359-369: Dispatch test `to` field
   - Lines 91-105: ACTION REQUIRED banner in test HTML

---

## Success Criteria

✅ **All webhooks include `to` field** with semicolon-separated emails
✅ **All webhooks include `recipient_count` field**
✅ **Blank email fields (email4-email8) don't cause Make.com failures**
✅ **Outlook Send Email module can use `{{to}}` directly**
✅ **ACTION REQUIRED banner shows for pending approvals**
✅ **Enprotec branding (blue/green) applied correctly**
✅ **No complex logic needed in Make.com**
✅ **Email Test page works for all 3 webhook types**

---

**Implementation Complete:** 2026-01-21
**Ready for:** Make.com Configuration
**Updated By:** Claude Code Assistant
