import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// The 4 users that need role corrections
const roleCorrections = [
  { email: 'reinard.griesel@enprotec.com', correctRole: 'Admin' },
  { email: 'jaco.pieterse@enprotec.com', correctRole: 'Admin' },
  { email: 'riaant@enprotec.com', correctRole: 'Operations Manager' },
  { email: 'phethani.ravele@enprotec.com', correctRole: 'Operations Manager' },
];

console.log('=== ROLE CORRECTIONS ===\n');
console.log('The following 4 users will have their roles updated:\n');

roleCorrections.forEach((user, idx) => {
  console.log(`${idx + 1}. ${user.email}`);
  console.log(`   Role: Project Manager → ${user.correctRole}\n`);
});

const executeFlag = process.argv.includes('--execute');

if (executeFlag) {
  console.log('⚠️  EXECUTE MODE ENABLED - Making changes...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const user of roleCorrections) {
    console.log(`Updating ${user.email}...`);

    const { error } = await supabase
      .from('en_users')
      .update({ role: user.correctRole })
      .eq('email', user.email);

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✅ Role updated to ${user.correctRole}`);
      successCount++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('\n✅ Role corrections completed!');
  console.log('Note: Passwords remain unchanged.');
} else {
  console.log('📋 DRY-RUN mode - No changes made to database');
  console.log('Run with --execute flag to apply these changes:');
  console.log('  node --env-file=.env.local scripts/fix-roles-only.js --execute');
}
