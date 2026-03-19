# Test User Creation Guide

## Quick Summary

You need to create 9 test users (one for each role) to test the full workflow system.

**Email Domain:** @mindrifttest.com
**Password for ALL test users:** password123
**⚠️ Important:** Only test users have this password - existing users are unaffected.

---

## Option 1: Using Node.js Script (Recommended if network is working)

```bash
node scripts/create-test-users.js
```

This script will:
- Create all 9 auth users in Supabase Auth
- Create all 9 user profiles in en_users table
- Set password to password123 for all
- Skip any users that already exist

---

## Option 2: Manual Creation via Supabase Dashboard

### Step 1: Create Auth Users

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" button
3. For each user below, enter:
   - **Email:** (from list below)
   - **Password:** password123
   - **Check "Auto Confirm User"** ✓
4. Click "Create User"
5. **COPY the User ID (UUID)** shown in the user list

### Step 2: Run SQL Script

1. Go to Supabase Dashboard → SQL Editor
2. Open [scripts/insert-test-users.sql](scripts/insert-test-users.sql)
3. Replace all `REPLACE-WITH-AUTH-USER-ID-X` placeholders with the actual UUIDs from Step 1
4. Run the script

---

## Test Users to Create

| # | Name | Email | Role | Password |
|---|------|-------|------|----------|
| 1 | Adam Administrator | adam.administrator@mindrifttest.com | Admin | password123 |
| 2 | Oliver Opsmanager | oliver.opsmanager@mindrifttest.com | Operations Manager | password123 |
| 3 | Emma Equipmentmanager | emma.equipmentmanager@mindrifttest.com | Equipment Manager | password123 |
| 4 | Samuel Stockcontroller | samuel.stockcontroller@mindrifttest.com | Stock Controller | password123 |
| 5 | Steven Storeman | steven.storeman@mindrifttest.com | Storeman | password123 |
| 6 | Sophie Sitemanager | sophie.sitemanager@mindrifttest.com | Site Manager | password123 |
| 7 | Peter Projectmanager | peter.projectmanager@mindrifttest.com | Project Manager | password123 |
| 8 | David Driver | david.driver@mindrifttest.com | Driver | password123 |
| 9 | Simon Security | simon.security@mindrifttest.com | Security | password123 |

---

## After Creating Users

1. Log in as **Admin** (your real admin account or Adam Administrator)
2. Go to **Users** page
3. Assign **departments** and **sites** to test users as needed for testing:

### Suggested Assignments for Testing:

- **Oliver Opsmanager**: Sites = Lephalale; Departments = Operations, OEM
- **Samuel Stockcontroller**: Departments = OEM, Operations, Projects
- **Emma Equipmentmanager**: Sites = All sites
- **Peter Projectmanager**: Sites = Lephalale (or specific project site)
- **Sophie Sitemanager**: Sites = Johannesburg

---

## Testing Email Test Page

The Email Test page now pulls real workflow data from the database:

1. Navigate to **Email Test** page in the app
2. Select email type (Approval, Denial, or Dispatch)
3. Click "Send Test Email"
4. Test emails will be sent to:
   - rahul.nepaulawa@gmail.com
   - john.opsmanager@test.com
   - mitzi.stock@test.com

The email will contain:
- Real workflow data from your most recent workflow request
- Production-quality HTML with Enprotec branding
- Workflow progress tracker with visual step indicators
- All request details, items, and history

---

## Troubleshooting

### Script Fails with Network Error
If `node scripts/create-test-users.js` fails with ENOTFOUND error, use Option 2 (Manual Creation via Dashboard) instead.

### Email Test Page Shows "undefined"
This has been fixed - the page now fetches from `en_workflows_view` which properly maps database columns to interface properties.

Make sure you have at least one workflow request in the database. If you don't, create one via the Requests page first.

---

**Created:** 2026-01-21
**Purpose:** Comprehensive system testing with all role types
**Security:** Only test users have password123 - production users unaffected
