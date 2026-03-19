import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read discrepancies file
const discrepanciesPath = join(__dirname, 'user-discrepancies.json');

if (!fs.existsSync(discrepanciesPath)) {
  console.error('Discrepancies file not found. Run analyze-user-discrepancies.js first.');
  process.exit(1);
}

const discrepancies = JSON.parse(fs.readFileSync(discrepanciesPath, 'utf8'));

console.log(`Found ${discrepancies.length} users to fix\n`);

console.log('=== USERS TO UPDATE ===\n');
discrepancies.forEach((disc, idx) => {
  console.log(`${idx + 1}. ${disc.email}`);
  disc.issues.forEach(issue => {
    console.log(`   ${issue.field}: ${JSON.stringify(issue.actual)} → ${JSON.stringify(issue.expected)}`);
  });
  console.log('');
});

const executeFlag = process.argv.includes('--execute');

if (executeFlag) {
  console.log('⚠️  EXECUTE MODE ENABLED - Making actual changes...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const disc of discrepancies) {
    // Build update object with only the fields that need changing
    const updates = {};

    disc.issues.forEach(issue => {
      updates[issue.field] = issue.expected;
    });

    console.log(`Updating ${disc.email}...`);

    const { error } = await supabase
      .from('en_users')
      .update(updates)
      .eq('id', disc.dbId);

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✅ Updated successfully`);
      successCount++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('\n✅ Fix completed!');
} else {
  console.log('📋 DRY-RUN mode - No changes made to database');
  console.log('Run with --execute flag to apply these changes:');
  console.log('  node --env-file=.env.local scripts/fix-user-discrepancies.js --execute');
}
