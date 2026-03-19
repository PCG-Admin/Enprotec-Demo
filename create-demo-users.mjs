/**
 * Creates PCG/MindRift demo users in the pcg-demo Supabase project.
 * Creates both auth accounts AND en_users profile records.
 *
 * Run: node create-demo-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bzdqjdimepilunztvavl.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6ZHFqZGltZXBpbHVuenR2YXZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkyMDE3MSwiZXhwIjoyMDg3NDk2MTcxfQ.uDyYuZ6PoDVNQZHo7xGpmzgtwNCk8mH6R67YKcHjwjU';
const PASSWORD = 'EnprotecDev2026!';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo users config
// fleet_role: null = operations only, 'Fleet Coordinator' = fleet access too
// role: Supabase user_role enum value
const DEMO_USERS = [
  {
    email: 'reinard.griesel@enprotec.com',
    name: 'Reinard Griesel',
    role: 'Admin',
    fleet_role: 'Fleet Coordinator', // Admin gets everything
    departments: null,
    sites: null,
    label: 'Admin — All Access',
  },
  {
    email: 'azande@pc-group.net',
    name: 'Azande',
    role: 'Driver',
    fleet_role: null, // Fleet/Driver only
    departments: null,
    sites: null,
    label: 'Driver — Fleet Only',
  },
  {
    email: 'sboniso.thage@enprotec.com',
    name: 'Sboniso Thage',
    role: 'Operations Manager',
    fleet_role: null, // Operations/Workflow only — no fleet
    departments: null,
    sites: null,
    label: 'Operations Manager — Workflow Only',
  },
  {
    email: 'anthony.beukes@enprotec.com',
    name: 'Anthony Beukes',
    role: 'Admin',
    fleet_role: 'Fleet Coordinator', // Dual roles
    departments: null,
    sites: null,
    label: 'Dual Roles — Operations + Fleet',
  },
];

async function createUser(user) {
  console.log(`\n→ Creating: ${user.label} (${user.email})`);

  // Step 1: Create auth account
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true, // skip email verification for demo
  });

  if (authError) {
    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
      console.log(`  ⚠  Auth user already exists — fetching existing ID`);
      // Try to get existing user
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find(u => u.email === user.email);
      if (!found) {
        console.error(`  ✗  Could not find existing user: ${authError.message}`);
        return;
      }
      authData = { user: found };
    } else {
      console.error(`  ✗  Auth creation failed: ${authError.message}`);
      return;
    }
  }

  const authUserId = authData.user.id;
  console.log(`  ✓  Auth user created (id: ${authUserId})`);

  // Step 2: Insert en_users profile
  const { error: profileError } = await supabase
    .from('en_users')
    .upsert(
      {
        id: authUserId,
        name: user.name,
        email: user.email,
        password: 'supabase_auth', // auth handled by Supabase Auth — placeholder
        role: user.role,
        fleet_role: user.fleet_role ?? null,
        status: 'Active',
        departments: user.departments,
        sites: user.sites,
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    // fleet_role column might not exist yet if migration_v2 hasn't run — retry without it
    if (profileError.message?.includes('fleet_role')) {
      const { error: retryError } = await supabase
        .from('en_users')
        .upsert(
          {
            id: authUserId,
            name: user.name,
            email: user.email,
            password: 'supabase_auth',
            role: user.role,
            status: 'Active',
            departments: user.departments,
            sites: user.sites,
          },
          { onConflict: 'id' }
        );
      if (retryError) {
        console.error(`  ✗  Profile creation failed: ${retryError.message}`);
        return;
      }
      console.log(`  ⚠  Profile created without fleet_role (run migration_v2 to enable fleet access)`);
    } else {
      console.error(`  ✗  Profile creation failed: ${profileError.message}`);
      return;
    }
  } else {
    console.log(`  ✓  en_users profile created (role: ${user.role}${user.fleet_role ? `, fleet_role: ${user.fleet_role}` : ''})`);
  }
}

async function main() {
  console.log('=== PCG/MindRift Demo User Setup ===');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log(`Password for all users: ${PASSWORD}`);

  let authData; // hoisted for use inside createUser
  for (const user of DEMO_USERS) {
    await createUser(user);
  }

  console.log('\n=== Done ===');
  console.log('\nDemo login credentials:');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.label.padEnd(35)} ${u.email}`);
  }
  console.log(`  Password: ${PASSWORD}`);
}

main().catch(console.error);
