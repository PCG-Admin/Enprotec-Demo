# Test Users Quick Reference

**Password for ALL test users:** `password123`

---

## All Test Users

| # | Name | Email | Role |
|---|------|-------|------|
| 1 | Adam Administrator | adam.administrator@mindrifttest.com | Admin |
| 2 | Oliver Opsmanager | oliver.opsmanager@mindrifttest.com | Operations Manager |
| 3 | Emma Equipmentmanager | emma.equipmentmanager@mindrifttest.com | Equipment Manager |
| 4 | Samuel Stockcontroller | samuel.stockcontroller@mindrifttest.com | Stock Controller |
| 5 | Steven Storeman | steven.storeman@mindrifttest.com | Storeman |
| 6 | Sophie Sitemanager | sophie.sitemanager@mindrifttest.com | Site Manager |
| 7 | Peter Projectmanager | peter.projectmanager@mindrifttest.com | Project Manager |
| 8 | David Driver | david.driver@mindrifttest.com | Driver |
| 9 | Simon Security | simon.security@mindrifttest.com | Security |

---

## Copy-Paste Ready

### Email Addresses Only
```
adam.administrator@mindrifttest.com
oliver.opsmanager@mindrifttest.com
emma.equipmentmanager@mindrifttest.com
samuel.stockcontroller@mindrifttest.com
steven.storeman@mindrifttest.com
sophie.sitemanager@mindrifttest.com
peter.projectmanager@mindrifttest.com
david.driver@mindrifttest.com
simon.security@mindrifttest.com
```

### Login Credentials (Email + Password)
```
adam.administrator@mindrifttest.com / password123
oliver.opsmanager@mindrifttest.com / password123
emma.equipmentmanager@mindrifttest.com / password123
samuel.stockcontroller@mindrifttest.com / password123
steven.storeman@mindrifttest.com / password123
sophie.sitemanager@mindrifttest.com / password123
peter.projectmanager@mindrifttest.com / password123
david.driver@mindrifttest.com / password123
simon.security@mindrifttest.com / password123
```

---

## Testing Workflow Scenarios

### Scenario 1: Full Approval Workflow
1. **Login as:** peter.projectmanager@mindrifttest.com
2. **Action:** Submit a new request
3. **Login as:** oliver.opsmanager@mindrifttest.com
4. **Action:** Approve request (Ops Manager approval)
5. **Login as:** samuel.stockcontroller@mindrifttest.com
6. **Action:** Review and approve stock availability
7. **Login as:** emma.equipmentmanager@mindrifttest.com
8. **Action:** Approve equipment request
9. **Login as:** samuel.stockcontroller@mindrifttest.com or steven.storeman@mindrifttest.com
10. **Action:** Mark items as picked
11. **Login as:** david.driver@mindrifttest.com
12. **Action:** Mark as dispatched
13. **Login as:** simon.security@mindrifttest.com
14. **Action:** Verify loaded items
15. **Login as:** peter.projectmanager@mindrifttest.com
16. **Action:** Confirm EPOD delivery

### Scenario 2: Denial Workflow
1. **Login as:** peter.projectmanager@mindrifttest.com
2. **Action:** Submit a new request
3. **Login as:** oliver.opsmanager@mindrifttest.com
4. **Action:** Decline request with reason

### Scenario 3: Admin Override
1. **Login as:** adam.administrator@mindrifttest.com
2. **Action:** Access all views, approve/decline any request, modify users

---

## By Role Type

### Admin
- **Email:** adam.administrator@mindrifttest.com
- **Password:** password123
- **Can:** Access everything, manage users, override any workflow step

### Operations Manager
- **Email:** oliver.opsmanager@mindrifttest.com
- **Password:** password123
- **Can:** Approve/decline requests at first approval stage, view requests for assigned sites

### Equipment Manager
- **Email:** emma.equipmentmanager@mindrifttest.com
- **Password:** password123
- **Can:** Approve equipment-related requests, view equipment manager step

### Stock Controller
- **Email:** samuel.stockcontroller@mindrifttest.com
- **Password:** password123
- **Can:** Review stock availability, approve stock requests, mark items as picked, view assigned departments

### Storeman
- **Email:** steven.storeman@mindrifttest.com
- **Password:** password123
- **Can:** Mark items as picked, assist with stock picking process

### Site Manager
- **Email:** sophie.sitemanager@mindrifttest.com
- **Password:** password123
- **Can:** Submit requests for assigned sites, view site-specific workflows

### Project Manager
- **Email:** peter.projectmanager@mindrifttest.com
- **Password:** password123
- **Can:** Submit requests for projects, track request status, confirm EPOD

### Driver
- **Email:** david.driver@mindrifttest.com
- **Password:** password123
- **Can:** Mark items as dispatched, view delivery assignments

### Security
- **Email:** simon.security@mindrifttest.com
- **Password:** password123
- **Can:** Verify loaded items, gate release process

---

## Test Email Recipients

When testing emails via the Email Test page, emails are sent to:
- rahul.nepaulawa@gmail.com
- john.opsmanager@test.com
- mitzi.stock@test.com

---

**Created:** 2026-01-21
