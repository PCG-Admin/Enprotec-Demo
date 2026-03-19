-- ============================================================================
-- MANUAL TEST USER CREATION INSTRUCTIONS
-- ============================================================================
-- This SQL script CANNOT create auth users - you must use Supabase Dashboard
--
-- STEP-BY-STEP PROCESS:
--
-- 1. Create Auth Users in Supabase Dashboard FIRST:
--    - Go to Authentication → Users
--    - Click "Add User" button
--    - For each user below, enter:
--      * Email: (see list below)
--      * Password: password123
--      * Check "Auto Confirm User" ✓
--    - Click "Create User"
--    - COPY the generated User ID (UUID)
--
-- 2. Run This SQL Script with User IDs:
--    - Replace the UUID placeholders below with actual auth user IDs
--    - Run in Supabase SQL Editor
--
-- ============================================================================
-- TEST USERS TO CREATE IN AUTH DASHBOARD:
-- ============================================================================
-- 1. adam.administrator@mindrifttest.com
-- 2. oliver.opsmanager@mindrifttest.com
-- 3. emma.equipmentmanager@mindrifttest.com
-- 4. samuel.stockcontroller@mindrifttest.com
-- 5. steven.storeman@mindrifttest.com
-- 6. sophie.sitemanager@mindrifttest.com
-- 7. peter.projectmanager@mindrifttest.com
-- 8. david.driver@mindrifttest.com
-- 9. simon.security@mindrifttest.com
--
-- Password for ALL: password123
-- ============================================================================

-- AFTER creating auth users in dashboard, replace UUIDs below and run this:

-- 1. Admin
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-1'::uuid,  -- Get this from Auth dashboard after creating adam.administrator@mindrifttest.com
    'Adam Administrator',
    'adam.administrator@mindrifttest.com',
    'Admin',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 2. Operations Manager
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-2'::uuid,  -- Get this from Auth dashboard after creating oliver.opsmanager@mindrifttest.com
    'Oliver Opsmanager',
    'oliver.opsmanager@mindrifttest.com',
    'Operations Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 3. Equipment Manager
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-3'::uuid,  -- Get this from Auth dashboard after creating emma.equipmentmanager@mindrifttest.com
    'Emma Equipmentmanager',
    'emma.equipmentmanager@mindrifttest.com',
    'Equipment Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 4. Stock Controller
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-4'::uuid,  -- Get this from Auth dashboard after creating samuel.stockcontroller@mindrifttest.com
    'Samuel Stockcontroller',
    'samuel.stockcontroller@mindrifttest.com',
    'Stock Controller',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 5. Storeman
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-5'::uuid,  -- Get this from Auth dashboard after creating steven.storeman@mindrifttest.com
    'Steven Storeman',
    'steven.storeman@mindrifttest.com',
    'Storeman',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 6. Site Manager
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-6'::uuid,  -- Get this from Auth dashboard after creating sophie.sitemanager@mindrifttest.com
    'Sophie Sitemanager',
    'sophie.sitemanager@mindrifttest.com',
    'Site Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 7. Project Manager
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-7'::uuid,  -- Get this from Auth dashboard after creating peter.projectmanager@mindrifttest.com
    'Peter Projectmanager',
    'peter.projectmanager@mindrifttest.com',
    'Project Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 8. Driver
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-8'::uuid,  -- Get this from Auth dashboard after creating david.driver@mindrifttest.com
    'David Driver',
    'david.driver@mindrifttest.com',
    'Driver',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 9. Security
INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
VALUES (
    'REPLACE-WITH-AUTH-USER-ID-9'::uuid,  -- Get this from Auth dashboard after creating simon.security@mindrifttest.com
    'Simon Security',
    'simon.security@mindrifttest.com',
    'Security',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- Verify all users were created
SELECT name, email, role, status
FROM public.en_users
WHERE email LIKE '%@mindrifttest.com'
ORDER BY role;
