import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapping from Excel clearance levels to database roles
const ROLE_MAPPING = {
  'Level 3': 'Admin',
  'Level 2': 'Operations Manager',
  'Level 1': 'Project Manager',
  'Level 0': 'Site Manager',
};

// Mapping department access columns
const DEPARTMENT_COLUMNS = {
  '__EMPTY_5': 'OEM',
  '__EMPTY_6': 'Operations',
  '__EMPTY_7': 'Projects',
  '__EMPTY_8': 'SalvageYard',
  '__EMPTY_9': 'Satellite', // Grootegeluk
  '__EMPTY_10': 'Satellite', // Makhado - both satellite stores map to Satellite department
};

// Read Excel file
console.log('Reading Excel file...');
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

// Skip first 2 rows (headers) and parse user data
const allExcelUsers = rawData.slice(2).filter(row => {
  // Filter out empty rows and rows without email
  return row.__EMPTY_2 && typeof row.__EMPTY_2 === 'string' && row.__EMPTY_2.includes('@');
}).map(row => {
  const departments = [];

  // Check each department column for 'X' marking
  for (const [colName, deptName] of Object.entries(DEPARTMENT_COLUMNS)) {
    if (row[colName] === 'X' || row[colName] === 'x') {
      if (!departments.includes(deptName)) {
        departments.push(deptName);
      }
    }
  }

  // Extract email from formats like "name <email@example.com>" or just "email@example.com"
  let email = row.__EMPTY_2?.toLowerCase().trim() || '';
  const emailMatch = email.match(/<([^>]+)>/);
  if (emailMatch) {
    email = emailMatch[1].trim();
  }

  return {
    name: row.__EMPTY_1?.trim() || '',
    email: email,
    clearanceLevel: row.__EMPTY?.trim() || '',
    role: ROLE_MAPPING[row.__EMPTY?.trim()] || 'Project Manager',
    siteAllocation: row.__EMPTY_3?.trim() || '',
    title: row.__EMPTY_4?.trim() || '',
    departments: departments,
    status: 'Active',
  };
});

// Remove duplicates - keep only first occurrence of each email
const seenEmails = new Set();
const excelUsers = allExcelUsers.filter(user => {
  if (seenEmails.has(user.email)) {
    console.log(`⚠️  Skipping duplicate email: ${user.name} (${user.email})`);
    return false;
  }
  seenEmails.add(user.email);
  return true;
});

console.log(`Parsed ${allExcelUsers.length} users from Excel file (${excelUsers.length} unique)`);

// Get existing users from database
console.log('\nFetching existing users from database...');
const { data: existingUsers, error: fetchError } = await supabase
  .from('en_users')
  .select('*');

if (fetchError) {
  console.error('Error fetching users:', fetchError);
  process.exit(1);
}

console.log(`Found ${existingUsers.length} existing users in database`);

// Create a map of existing users by email
const existingUsersMap = new Map();
existingUsers.forEach(user => {
  existingUsersMap.set(user.email.toLowerCase(), user);
});

// Analyze what needs to be done
const usersToInsert = [];
const usersToUpdate = [];
const usersUnchanged = [];

for (const excelUser of excelUsers) {
  const existingUser = existingUsersMap.get(excelUser.email);

  if (!existingUser) {
    // New user - needs to be inserted
    usersToInsert.push(excelUser);
  } else {
    // User exists - check if access needs updating
    const existingDepts = existingUser.departments || [];
    const newDepts = excelUser.departments;

    // Sort arrays for comparison
    const existingDeptsStr = JSON.stringify([...existingDepts].sort());
    const newDeptsStr = JSON.stringify([...newDepts].sort());

    const roleChanged = existingUser.role !== excelUser.role;
    const deptsChanged = existingDeptsStr !== newDeptsStr;
    const nameChanged = existingUser.name !== excelUser.name;

    if (roleChanged || deptsChanged || nameChanged) {
      usersToUpdate.push({
        id: existingUser.id,
        email: existingUser.email,
        changes: {
          ...(nameChanged && { name: excelUser.name }),
          ...(roleChanged && { role: excelUser.role }),
          ...(deptsChanged && { departments: newDepts }),
        },
        oldValues: {
          ...(nameChanged && { name: existingUser.name }),
          ...(roleChanged && { role: existingUser.role }),
          ...(deptsChanged && { departments: existingDepts }),
        },
      });
    } else {
      usersUnchanged.push(excelUser.email);
    }
  }
}

console.log('\n=== SYNC SUMMARY ===');
console.log(`Users to INSERT: ${usersToInsert.length}`);
console.log(`Users to UPDATE: ${usersToUpdate.length}`);
console.log(`Users UNCHANGED: ${usersUnchanged.length}`);

if (usersToInsert.length > 0) {
  console.log('\n--- NEW USERS TO INSERT ---');
  usersToInsert.forEach(user => {
    console.log(`  ${user.name} (${user.email})`);
    console.log(`    Role: ${user.role}`);
    console.log(`    Departments: ${user.departments.join(', ')}`);
    console.log(`    Site: ${user.siteAllocation}`);
  });
}

if (usersToUpdate.length > 0) {
  console.log('\n--- USERS TO UPDATE ---');
  usersToUpdate.forEach(user => {
    console.log(`  ${user.email}`);
    Object.keys(user.changes).forEach(key => {
      const oldVal = JSON.stringify(user.oldValues[key]);
      const newVal = JSON.stringify(user.changes[key]);
      console.log(`    ${key}: ${oldVal} → ${newVal}`);
    });
  });
}

// Ask for confirmation
console.log('\n=== ACTION REQUIRED ===');
console.log('Do you want to proceed with these changes? (y/n)');
console.log('Note: This script is in DRY-RUN mode by default.');
console.log('To actually execute changes, run with: node --env-file=.env.local scripts/sync-users.js --execute');

const executeFlag = process.argv.includes('--execute');

if (executeFlag) {
  console.log('\n⚠️  EXECUTE MODE ENABLED - Making actual changes...\n');

  // Insert new users
  if (usersToInsert.length > 0) {
    console.log('Inserting new users...');
    const insertData = usersToInsert.map(user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      departments: user.departments,
      sites: user.siteAllocation ? [user.siteAllocation] : [],
      status: 'Active',
      password: 'password123', // Default password for new users
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('en_users')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('❌ Error inserting users:', insertError);
    } else {
      console.log(`✅ Successfully inserted ${insertedData.length} users`);
    }
  }

  // Update existing users
  if (usersToUpdate.length > 0) {
    console.log('\nUpdating existing users...');
    let updateCount = 0;
    let errorCount = 0;

    for (const user of usersToUpdate) {
      const { error: updateError } = await supabase
        .from('en_users')
        .update(user.changes)
        .eq('id', user.id);

      if (updateError) {
        console.error(`❌ Error updating ${user.email}:`, updateError);
        errorCount++;
      } else {
        updateCount++;
      }
    }

    console.log(`✅ Successfully updated ${updateCount} users`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update ${errorCount} users`);
    }
  }

  console.log('\n✅ Sync completed!');
} else {
  console.log('\n📋 DRY-RUN mode - No changes made to database');
  console.log('Review the changes above and run with --execute flag to apply them.');
}
