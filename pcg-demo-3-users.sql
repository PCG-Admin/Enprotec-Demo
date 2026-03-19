-- ============================================
-- PCG DEMO: PART 3 of 3 - Demo User Profiles
-- Run AFTER Part 1 (schema) and Part 2 (migrations) complete
-- Creates auth accounts + enprotec_users profiles in one go
-- ============================================

-- Credentials:
--   admin-test@enprotec.com      Admin123!
--   driver-test@enprotec.com     Driver123!
--   opsmanager-test@enprotec.com OpsMan123!
--   dual-test@enprotec.com       Dual123!

-- ============================================
-- STEP 1: Clean up any previous attempts
-- ============================================

DELETE FROM public.enprotec_users WHERE email IN (
    'admin-test@enprotec.com',
    'driver-test@enprotec.com',
    'opsmanager-test@enprotec.com',
    'dual-test@enprotec.com',
    'equipmentmanager-test@enprotec.com',
    'stockcontroller-test@enprotec.com',
    'storeman-test@enprotec.com',
    'sitemanager-test@enprotec.com',
    'projectmanager-test@enprotec.com',
    'security-test@enprotec.com'
);

DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN (
        'admin-test@enprotec.com',
        'driver-test@enprotec.com',
        'opsmanager-test@enprotec.com',
        'dual-test@enprotec.com'
    )
);

DELETE FROM auth.users WHERE email IN (
    'admin-test@enprotec.com',
    'driver-test@enprotec.com',
    'opsmanager-test@enprotec.com',
    'dual-test@enprotec.com'
);

-- ============================================
-- STEP 2: Create auth accounts
-- ============================================

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES
    (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'admin-test@enprotec.com', crypt('Admin123!', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}',
        '', '', '', ''
    ),
    (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'driver-test@enprotec.com', crypt('Driver123!', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}',
        '', '', '', ''
    ),
    (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'opsmanager-test@enprotec.com', crypt('OpsMan123!', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}',
        '', '', '', ''
    ),
    (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'dual-test@enprotec.com', crypt('Dual123!', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}',
        '', '', '', ''
    );

-- Create identities (required for email login)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id,
    u.email,
    format('{"sub":"%s","email":"%s"}', u.id::text, u.email)::jsonb,
    'email',
    now(), now(), now()
FROM auth.users u
WHERE u.email IN (
    'admin-test@enprotec.com',
    'driver-test@enprotec.com',
    'opsmanager-test@enprotec.com',
    'dual-test@enprotec.com'
);

-- ============================================
-- STEP 3: Create enprotec_users profiles
-- ============================================

INSERT INTO public.enprotec_users (id, name, email, password, role, fleet_role, status, departments, sites)
SELECT id, 'Admin Test',      email, 'supabase_auth', 'Admin',              NULL,               'Active', NULL, NULL FROM auth.users WHERE email = 'admin-test@enprotec.com';

INSERT INTO public.enprotec_users (id, name, email, password, role, fleet_role, status, departments, sites)
SELECT id, 'Driver Test',     email, 'supabase_auth', 'Driver',             NULL,               'Active', NULL, NULL FROM auth.users WHERE email = 'driver-test@enprotec.com';

INSERT INTO public.enprotec_users (id, name, email, password, role, fleet_role, status, departments, sites)
SELECT id, 'Operations Test', email, 'supabase_auth', 'Operations Manager', NULL,               'Active', NULL, NULL FROM auth.users WHERE email = 'opsmanager-test@enprotec.com';

INSERT INTO public.enprotec_users (id, name, email, password, role, fleet_role, status, departments, sites)
SELECT id, 'Dual Role Test',  email, 'supabase_auth', 'Admin',              'Fleet Coordinator','Active', NULL, NULL FROM auth.users WHERE email = 'dual-test@enprotec.com';

-- ============================================
-- STEP 4: Verify
-- ============================================

SELECT u.name, u.email, u.role, u.fleet_role, u.status
FROM public.enprotec_users u
WHERE u.email IN (
    'admin-test@enprotec.com',
    'driver-test@enprotec.com',
    'opsmanager-test@enprotec.com',
    'dual-test@enprotec.com'
)
ORDER BY u.name;
