# User Sync Script

This script synchronizes users from the Excel file "Digital Stores Access_2026.xlsx" to the Supabase `en_users` table.

## Features

- Parses Excel file to extract user information and access control settings
- Compares with existing users in the database
- Identifies new users to insert
- Identifies existing users that need updates (role, departments, name changes)
- Ignores users that are already correctly configured
- Safe dry-run mode by default

## Usage

### Dry Run (Preview Changes)

To see what changes would be made without actually modifying the database:

```bash
npm run sync-users
```

This will show you:
- Number of users to insert
- Number of users to update
- Detailed list of all changes

### Execute Changes

Once you've reviewed the changes and are ready to apply them:

```bash
npm run sync-users:execute
```

This will actually insert new users and update existing users in the database.

## Excel File Format

The script expects the Excel file at: `public/Digital Stores Access_2026.xlsx`

Expected structure:
- Row 1-2: Headers
- Row 3+: User data with columns:
  - Column A: User Number
  - Column B: Clearance Level (Level 0-3)
  - Column C: Name
  - Column D: Email Address
  - Column E: Site Allocation
  - Column F: Title
  - Column G: OEM Department Access (X = has access)
  - Column H: Operations Department Access (X = has access)
  - Column I: Projects Department Access (X = has access)
  - Column J: Salvage Yard Department Access (X = has access)
  - Column K: Grootegeluk Satellite Store Access (X = has access)
  - Column L: Makhado Satellite Store Access (X = has access)

## Role Mapping

Clearance levels are mapped to database roles:
- Level 3 → Admin
- Level 2 → Operations Manager
- Level 1 → Project Manager
- Level 0 → Site Manager

## Department Mapping

Excel columns are mapped to department names:
- OEM → OEM
- Operations → Operations
- Projects → Projects
- Salvage Yard → SalvageYard
- Grootegeluk/Makhado Satellite → Satellite

## What Gets Updated

The script will update existing users if any of these fields differ:
- Name
- Role
- Departments (access control)

## Default Values

New users are created with:
- Status: Active
- Password: password123 (default password, should be changed on first login)
- Sites: Array containing the site allocation from Excel

## Important Notes About Email Domains

The Excel file contains some users with `@enprotec.com` emails, while the database may have the same users with `@enprotec.co.za` emails. The script performs **exact email matching** only.

This means:
- `dylan.oosthuyzen@enprotec.com` (Excel) and `dylan.oosthuyzen@enprotec.co.za` (Database) are treated as **different users**
- If you want both versions in the database, the script will create the .com version as a new user
- You may end up with duplicate users with different email domains

**Recommendation:** Review the "NEW USERS TO INSERT" section carefully in dry-run mode to identify any potential duplicates before executing.

## Notes

- Users are matched by email address (case-insensitive)
- Email addresses can be in format "email@example.com" or "Name <email@example.com>"
- Empty rows and rows without valid email addresses are skipped
- The script requires valid Supabase credentials in `.env.local`
