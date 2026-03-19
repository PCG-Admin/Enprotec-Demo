# Make.com Quick Setup Reference

**One-page guide for configuring webhooks in Make.com**

---

## Scenario Structure (Same for All 3 Webhooks)

```
[Webhook] → [Router] → 8 Routes (each with filter + Outlook Send Email)
```

---

## Step-by-Step Setup

### 1. Add Modules

1. **Webhooks → Custom Webhook** (trigger)
2. **Flow Control → Router** (after webhook)
3. **Add 8 routes** to router

### 2. Configure Each Route (1-8)

**For Route 1:**
- Filter: `{{1.email1}}` ≠ (empty)
- Module: **Outlook → Send an Email**
  - To: `{{1.email1}}`
  - Subject: `{{1.subject}}`
  - Content Type: HTML
  - Body: `{{1.body}}`

**For Route 2:**
- Filter: `{{1.email2}}` ≠ (empty)
- Module: **Outlook → Send an Email**
  - To: `{{1.email2}}`
  - Subject: `{{1.subject}}`
  - Content Type: HTML
  - Body: `{{1.body}}`

**Repeat for Routes 3-8** (change emailX to match route number)

### 3. Activate

- Save scenario
- Turn ON
- Copy webhook URL

---

## Filter Configuration

**For each route, set filter:**

| Field | Operator | Value |
|-------|----------|-------|
| `{{1.emailX}}` | Text operator: Is not equal to | (leave empty) |

**Label:** "Recipient X exists"

---

## Email Module Configuration

**Same for all 8 routes:**

| Setting | Value |
|---------|-------|
| To | `{{1.emailX}}` (X = route number) |
| Subject | `{{1.subject}}` |
| Content Type | HTML |
| Body | `{{1.body}}` |

---

## Webhook URLs

Copy these exact URLs into Make.com scenarios:

1. **General Workflow:**
   ```
   https://hook.eu2.make.com/8txtgm1ou36nd0t1w3jrx891kpqy90mv
   ```

2. **Denial:**
   ```
   https://hook.eu2.make.com/gew2qe8azxbg884131aa8ynd8gcycrmj
   ```

3. **Dispatch:**
   ```
   https://hook.eu2.make.com/av4hh2h3xnnnr18j5twe6eqwbslhu913
   ```

---

## Testing Checklist

### After setup, test each webhook:

1. ✅ Navigate to `http://localhost:3002/email-test`
2. ✅ Click test button for webhook type
3. ✅ Check Make.com execution history
4. ✅ Verify only non-blank routes executed
5. ✅ Check recipient inboxes for emails
6. ✅ Confirm Enprotec branding displays correctly
7. ✅ Confirm ACTION REQUIRED banner shows (for pending approvals)

---

## Visual Reference

```
┌─────────────────┐
│ Webhook Trigger │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Router  │
    └──┬──────┘
       │
       ├─ [Filter: email1≠""] → [📧 Send to email1]
       ├─ [Filter: email2≠""] → [📧 Send to email2]
       ├─ [Filter: email3≠""] → [📧 Send to email3]
       ├─ [Filter: email4≠""] → [📧 Send to email4]
       ├─ [Filter: email5≠""] → [📧 Send to email5]
       ├─ [Filter: email6≠""] → [📧 Send to email6]
       ├─ [Filter: email7≠""] → [📧 Send to email7]
       └─ [Filter: email8≠""] → [📧 Send to email8]
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid email address" error | Check that filter uses `≠ (empty)`, not `≠ ""` with quotes |
| All routes executing even for blanks | Add filters to each route checking if email is not empty |
| Emails not sending | Verify Content Type is set to HTML (not Plain Text) |
| Branding not showing | Check Body field uses `{{1.body}}` with double curly braces |

---

## Expected Behavior

**Example 1: 3 recipients**
- email1, email2, email3 → Routes 1-3 execute ✅
- email4-8 are blank → Routes 4-8 skip ⏭️

**Example 2: 1 recipient (denial)**
- email1 → Route 1 executes ✅
- email2-8 are blank → Routes 2-8 skip ⏭️

**Example 3: 8 recipients**
- email1-8 all populated → All routes execute ✅

---

## Quick Troubleshooting

### Problem: Webhook not receiving data
- Check webhook URL matches exactly
- Verify scenario is turned ON
- Test from Email Test page first

### Problem: Filters not working
- Use "Is not equal to" operator
- Leave value field empty (for empty string)
- Don't use quotes around empty value

### Problem: HTML not rendering
- Set Content Type to HTML
- Use `{{1.body}}` not `{{body}}`
- Check Outlook connection is authenticated

---

**Setup Time:** ~15 minutes per webhook
**Total Time:** ~45 minutes for all 3 webhooks

**Document:** WEBHOOK-FINAL-SOLUTION.md (detailed explanation)
**Document:** MAKE-OUTLOOK-SETUP.md (full setup guide)
