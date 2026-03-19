/**
 * Create Test Users Script
 * Creates authenticated test users for all roles in the system
 * Password for all TEST users only: password123
 * Does NOT affect any other existing users
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

const testUsers = [
    {
        name: 'Adam Administrator',
        email: 'adam.administrator@mindrifttest.com',
        role: 'Admin',
        password: 'password123'
    },
    {
        name: 'Oliver Opsmanager',
        email: 'oliver.opsmanager@mindrifttest.com',
        role: 'Operations Manager',
        password: 'password123'
    },
    {
        name: 'Emma Equipmentmanager',
        email: 'emma.equipmentmanager@mindrifttest.com',
        role: 'Equipment Manager',
        password: 'password123'
    },
    {
        name: 'Samuel Stockcontroller',
        email: 'samuel.stockcontroller@mindrifttest.com',
        role: 'Stock Controller',
        password: 'password123'
    },
    {
        name: 'Steven Storeman',
        email: 'steven.storeman@mindrifttest.com',
        role: 'Storeman',
        password: 'password123'
    },
    {
        name: 'Sophie Sitemanager',
        email: 'sophie.sitemanager@mindrifttest.com',
        role: 'Site Manager',
        password: 'password123'
    },
    {
        name: 'Peter Projectmanager',
        email: 'peter.projectmanager@mindrifttest.com',
        role: 'Project Manager',
        password: 'password123'
    },
    {
        name: 'David Driver',
        email: 'david.driver@mindrifttest.com',
        role: 'Driver',
        password: 'password123'
    },
    {
        name: 'Simon Security',
        email: 'simon.security@mindrifttest.com',
        role: 'Security',
        password: 'password123'
    }
];

async function createTestUsers() {
    console.log('🚀 Starting test user creation...\n');
    console.log('⚠️  ONLY creating NEW test users - existing users unaffected\n');

    let created = 0;
    let skipped = 0;
    let failed = 0;

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
                    skipped++;
                    continue;
                }
                throw authError;
            }

            if (!authData.user) {
                throw new Error('No user data returned from auth creation');
            }

            console.log(`✅ Auth user created with ID: ${authData.user.id}`);

            // Create user profile in en_users table
            const { error: profileError } = await supabase
                .from('en_users')
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
                    skipped++;
                    continue;
                }
                throw profileError;
            }

            console.log(`✅ Profile created successfully for ${user.name}\n`);
            created++;

        } catch (error) {
            console.error(`❌ Error creating user ${user.email}:`, error.message);
            console.log('');
            failed++;
        }
    }

    console.log('\n🎉 Test user creation complete!\n');
    console.log('📊 Summary:');
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log('\n🔑 Credentials:');
    console.log('  Password for ALL test users: password123');
    console.log('  ⚠️  ONLY test users have this password - existing users unaffected');
    console.log('\n📝 Note:');
    console.log('  No departments or sites assigned to test users');
    console.log('  Assign manually as needed via Users page\n');
    console.log('📋 Test Users:');
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
