-- ============================================================================
-- AUTOMATIC TEST USER PROFILE CREATION
-- ============================================================================
-- This script automatically looks up auth user IDs by email
-- Run AFTER creating auth users in Supabase Dashboard
--
-- Prerequisites:
-- 1. Create auth users in Dashboard (Authentication → Users → Add User)
-- 2. Use these emails with password: password123
-- 3. Check "Auto Confirm User"
-- ============================================================================

-- Create user profiles by looking up auth user IDs from emails
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Admin
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'adam.administrator@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Adam Administrator', 'adam.administrator@mindrifttest.com', 'Admin', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Adam Administrator';
    ELSE
        RAISE NOTICE 'Skipped: adam.administrator@mindrifttest.com (auth user not found)';
    END IF;

    -- 2. Operations Manager
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'oliver.opsmanager@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Oliver Opsmanager', 'oliver.opsmanager@mindrifttest.com', 'Operations Manager', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Oliver Opsmanager';
    ELSE
        RAISE NOTICE 'Skipped: oliver.opsmanager@mindrifttest.com (auth user not found)';
    END IF;

    -- 3. Equipment Manager
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'emma.equipmentmanager@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Emma Equipmentmanager', 'emma.equipmentmanager@mindrifttest.com', 'Equipment Manager', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Emma Equipmentmanager';
    ELSE
        RAISE NOTICE 'Skipped: emma.equipmentmanager@mindrifttest.com (auth user not found)';
    END IF;

    -- 4. Stock Controller
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'samuel.stockcontroller@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Samuel Stockcontroller', 'samuel.stockcontroller@mindrifttest.com', 'Stock Controller', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Samuel Stockcontroller';
    ELSE
        RAISE NOTICE 'Skipped: samuel.stockcontroller@mindrifttest.com (auth user not found)';
    END IF;

    -- 5. Storeman
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'steven.storeman@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Steven Storeman', 'steven.storeman@mindrifttest.com', 'Storeman', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Steven Storeman';
    ELSE
        RAISE NOTICE 'Skipped: steven.storeman@mindrifttest.com (auth user not found)';
    END IF;

    -- 6. Site Manager
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'sophie.sitemanager@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Sophie Sitemanager', 'sophie.sitemanager@mindrifttest.com', 'Site Manager', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Sophie Sitemanager';
    ELSE
        RAISE NOTICE 'Skipped: sophie.sitemanager@mindrifttest.com (auth user not found)';
    END IF;

    -- 7. Project Manager
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'peter.projectmanager@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Peter Projectmanager', 'peter.projectmanager@mindrifttest.com', 'Project Manager', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Peter Projectmanager';
    ELSE
        RAISE NOTICE 'Skipped: peter.projectmanager@mindrifttest.com (auth user not found)';
    END IF;

    -- 8. Driver
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'david.driver@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'David Driver', 'david.driver@mindrifttest.com', 'Driver', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: David Driver';
    ELSE
        RAISE NOTICE 'Skipped: david.driver@mindrifttest.com (auth user not found)';
    END IF;

    -- 9. Security
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'simon.security@mindrifttest.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.en_users (id, name, email, role, status, departments, sites)
        VALUES (v_user_id, 'Simon Security', 'simon.security@mindrifttest.com', 'Security', 'Active', NULL, NULL)
        ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id, name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status;
        RAISE NOTICE 'Created/Updated: Simon Security';
    ELSE
        RAISE NOTICE 'Skipped: simon.security@mindrifttest.com (auth user not found)';
    END IF;
END $$;

-- Verify all users were created
SELECT name, email, role, status
FROM public.en_users
WHERE email LIKE '%@mindrifttest.com'
ORDER BY role;
