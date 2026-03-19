-- Insert test users for every role in the system
-- Date: 2026-01-21
-- Purpose: Create comprehensive test users for workflow testing

-- Note: These users will have no departments or sites assigned initially
-- Assign departments and sites manually after creation as needed

-- 1. Admin User
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Adam Administrator',
    'admin-test@enprotec.com',
    'Admin',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 2. Operations Manager
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Oliver Opsmanager',
    'opsmanager-test@enprotec.com',
    'Operations Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 3. Equipment Manager
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Emma Equipmentmanager',
    'equipmentmanager-test@enprotec.com',
    'Equipment Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 4. Stock Controller
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Samuel Stockcontroller',
    'stockcontroller-test@enprotec.com',
    'Stock Controller',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 5. Storeman
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Steven Storeman',
    'storeman-test@enprotec.com',
    'Storeman',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 6. Site Manager
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Sophie Sitemanager',
    'sitemanager-test@enprotec.com',
    'Site Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 7. Project Manager
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Peter Projectmanager',
    'projectmanager-test@enprotec.com',
    'Project Manager',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 8. Driver
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'David Driver',
    'driver-test@enprotec.com',
    'Driver',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 9. Security
INSERT INTO public.enprotec_users (
    id,
    name,
    email,
    role,
    status,
    departments,
    sites
) VALUES (
    gen_random_uuid(),
    'Simon Security',
    'security-test@enprotec.com',
    'Security',
    'Active',
    NULL,
    NULL
) ON CONFLICT (email) DO NOTHING;

-- Verification query to check all test users were created
-- Run this after migration to verify:
-- SELECT name, email, role, status, departments, sites
-- FROM public.enprotec_users
-- WHERE email LIKE '%-test@enprotec.com'
-- ORDER BY role;
