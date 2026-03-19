/**
 * Create Test Users Script
 * Creates authenticated test users for all roles in the system
 * Password for all users: password123
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yyaemtnrqffjbtfbcgca.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5YWVtdG5ycWZmamJ0ZmJjZ2NhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTY2MDAyOCwiZXhwIjoyMDUxMjM2MDI4fQ.v3vNEwJyeRj4YNHYWHqVH3z9mHGFvMk_eDYjbSS2n0g';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

interface TestUser {
    name: string;
    email: string;
    role: string;
    password: string;
}

const testUsers: TestUser[] = [
    {
        name: 'Adam Administrator',
        email: 'admin-test@enprotec.com',
        role: 'Admin',
        password: 'password123'
    },
    {
        name: 'Oliver Opsmanager',
        email: 'opsmanager-test@enprotec.com',
        role: 'Operations Manager',
        password: 'password123'
    },
    {
        name: 'Emma Equipmentmanager',
        email: 'equipmentmanager-test@enprotec.com',
        role: 'Equipment Manager',
        password: 'password123'
    },
    {
        name: 'Samuel Stockcontroller',
        email: 'stockcontroller-test@enprotec.com',
        role: 'Stock Controller',
        password: 'password123'
    },
    {
        name: 'Steven Storeman',
        email: 'storeman-test@enprotec.com',
        role: 'Storeman',
        password: 'password123'
    },
    {
        name: 'Sophie Sitemanager',
        email: 'sitemanager-test@enprotec.com',
        role: 'Site Manager',
        password: 'password123'
    },
    {
        name: 'Peter Projectmanager',
        email: 'projectmanager-test@enprotec.com',
        role: 'Project Manager',
        password: 'password123'
    },
    {
        name: 'David Driver',
        email: 'driver-test@enprotec.com',
        role: 'Driver',
        password: 'password123'
    },
    {
        name: 'Simon Security',
        email: 'security-test@enprotec.com',
        role: 'Security',
        password: 'password123'
    }
];

async function createTestUsers() {
    console.log('🚀 Starting test user creation...\n');

    for (const user of testUsers) {
        try {
            console.log(`Creating user: ${user.name} (${user.email})...`);

            // Create auth user using admin API
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: {
                    name: user.name
                }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    console.log(`⚠️  User ${user.email} already exists, skipping...`);
                    continue;
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error('No user data returned from auth creation');
            }

            console.log(`✅ Auth user created with ID: ${authData.user.id}`);

            // Create user profile in enprotec_users table
            const { error: profileError } = await supabase
                .from('enprotec_users')
                .insert({
                    id: authData.user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: 'Active',
                    departments: null,
                    sites: null
                });

            if (profileError) {
                if (profileError.message.includes('duplicate key')) {
                    console.log(`⚠️  Profile for ${user.email} already exists, skipping...`);
                    continue;
                }
                throw profileError;
            }

            console.log(`✅ Profile created successfully for ${user.name}\n`);

        } catch (error) {
            console.error(`❌ Error creating user ${user.email}:`, error);
            console.log('');
        }
    }

    console.log('\n🎉 Test user creation complete!\n');
    console.log('📋 Summary:');
    console.log('All users have password: password123');
    console.log('No departments or sites assigned (assign manually as needed)\n');
    console.log('Test Users Created:');
    testUsers.forEach(u => {
        console.log(`  • ${u.name} - ${u.email} (${u.role})`);
    });
}

createTestUsers()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
