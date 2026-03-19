# Test Users Setup Guide

## Overview
Create test users for all roles to enable comprehensive system testing.

**Password for ALL test users:** `password123`
**⚠️ Important:** ONLY test users have this password - existing users are unaffected.

---

## Test Users to Create

### 1. Admin
- **Name:** Adam Administrator
- **Email:** adam.administrator@mindrifttest.com
- **Role:** Admin
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 2. Operations Manager
- **Name:** Oliver Opsmanager
- **Email:** oliver.opsmanager@mindrifttest.com
- **Role:** Operations Manager
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 3. Equipment Manager
- **Name:** Emma Equipmentmanager
- **Email:** emma.equipmentmanager@mindrifttest.com
- **Role:** Equipment Manager
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 4. Stock Controller
- **Name:** Samuel Stockcontroller
- **Email:** samuel.stockcontroller@mindrifttest.com
- **Role:** Stock Controller
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 5. Storeman
- **Name:** Steven Storeman
- **Email:** steven.storeman@mindrifttest.com
- **Role:** Storeman
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 6. Site Manager
- **Name:** Sophie Sitemanager
- **Email:** sophie.sitemanager@mindrifttest.com
- **Role:** Site Manager
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 7. Project Manager
- **Name:** Peter Projectmanager
- **Email:** peter.projectmanager@mindrifttest.com
- **Role:** Project Manager
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 8. Driver
- **Name:** David Driver
- **Email:** david.driver@mindrifttest.com
- **Role:** Driver
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

### 9. Security
- **Name:** Simon Security
- **Email:** simon.security@mindrifttest.com
- **Role:** Security
- **Password:** password123
- **Departments:** (Leave empty - assign manually as needed)
- **Sites:** (Leave empty - assign manually as needed)

---

## How to Create Users

### Option 1: Through Application UI (Recommended)
1. Log in as an Admin user
2. Navigate to **Users** page
3. Click **Add User** button
4. Fill in the form with the details above
5. Set password to `password123`
6. Leave departments and sites empty initially
7. Save the user
8. Repeat for all 9 test users

### Option 2: Through Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User**
4. Enter email and set password to `password123`
5. Click **Create User**
6. Then navigate to **Database** → **en_users** table
7. Add a row with:
   - `id`: (copy from auth.users)
   - `name`: (from list above)
   - `email`: (from list above)
   - `role`: (from list above)
   - `status`: Active
   - `departments`: NULL
   - `sites`: NULL
8. Repeat for all 9 test users

### Option 3: Run the Script (When Network is Available)
If network connectivity is restored:
```bash
node scripts/create-test-users.js
```

---

## Testing Workflow Coverage

With all 9 test users, you can test:

### ✅ Request Submission
- Use **Peter Projectmanager** or **Sophie Sitemanager** to submit requests

### ✅ Operations Manager Approval
- Use **Oliver Opsmanager** to approve/decline requests at first approval stage
- Assign Oliver to specific sites to test site-based filtering

### ✅ Stock Controller Review
- Use **Samuel Stockcontroller** to review stock availability
- Assign Samuel to specific departments to test department-based filtering

### ✅ Equipment Manager Approval
- Use **Emma Equipmentmanager** to approve equipment-related requests
- Test equipment manager step in workflow

### ✅ Picking Process
- Use **Samuel Stockcontroller** or **Steven Storeman** to mark items as picked
- Test picking workflow step

### ✅ Dispatch Process
- Use **David Driver** to mark items as dispatched
- Use **Simon Security** to verify loaded items
- Test dispatch and delivery workflow

### ✅ Admin Functions
- Use **Adam Administrator** to:
  - Manage all users
  - Override any workflow step
  - Access all system features
  - Assign departments and sites to test users

---

## Assigning Departments and Sites

After creating the test users:

1. Log in as **Admin**
2. Go to **Users** page
3. Click **Edit** on each test user
4. Assign relevant **departments** (e.g., OEM, Operations, Projects)
5. Assign relevant **sites** (e.g., Lephalale, Johannesburg)
6. Save changes

**Example Assignments:**
- **Oliver Opsmanager**: Sites = Lephalale, Departments = Operations
- **Samuel Stockcontroller**: Departments = OEM, Operations
- **Emma Equipmentmanager**: Sites = All sites
- **Peter Projectmanager**: Sites = Specific project site

---

## Quick Reference Table

| Role | Name | Email | Password |
|------|------|-------|----------|
| Admin | Adam Administrator | adam.administrator@mindrifttest.com | password123 |
| Operations Manager | Oliver Opsmanager | oliver.opsmanager@mindrifttest.com | password123 |
| Equipment Manager | Emma Equipmentmanager | emma.equipmentmanager@mindrifttest.com | password123 |
| Stock Controller | Samuel Stockcontroller | samuel.stockcontroller@mindrifttest.com | password123 |
| Storeman | Steven Storeman | steven.storeman@mindrifttest.com | password123 |
| Site Manager | Sophie Sitemanager | sophie.sitemanager@mindrifttest.com | password123 |
| Project Manager | Peter Projectmanager | peter.projectmanager@mindrifttest.com | password123 |
| Driver | David Driver | david.driver@mindrifttest.com | password123 |
| Security | Simon Security | simon.security@mindrifttest.com | password123 |

---

## Testing Checklist

Once all users are created and assigned:

- [ ] Test request submission (Project/Site Manager)
- [ ] Test Ops Manager approval workflow
- [ ] Test Stock Controller review workflow
- [ ] Test Equipment Manager approval workflow
- [ ] Test picking process (Stock Controller/Storeman)
- [ ] Test dispatch process (Driver/Security)
- [ ] Test email notifications (verify workflow progress tracker)
- [ ] Test role-based access control
- [ ] Test department filtering
- [ ] Test site filtering
- [ ] Test admin overrides
- [ ] Test denial/rejection workflows
- [ ] Test EPOD confirmation
- [ ] Test salvage workflows

---

**Created:** 2026-01-21
**Purpose:** Comprehensive system testing with all role types
**Security:** Only test users have password123 - production users unaffected
