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

// Role mapping from clearance levels
const ROLE_MAPPING = {
  'Level 3': 'Admin',
  'Level 2': 'Operations Manager',
  'Level 1': 'Project Manager',
  'Level 0': 'Site Manager',
};

// Department mapping
const DEPARTMENT_COLUMNS = {
  '__EMPTY_5': 'OEM',
  '__EMPTY_6': 'Operations',
  '__EMPTY_7': 'Projects',
  '__EMPTY_8': 'SalvageYard',
  '__EMPTY_9': 'Satellite', // Grootegeluk
  '__EMPTY_10': 'Satellite', // Makhado
};

// Read Excel file - Sites and Access sheet
console.log('Reading Excel file...');
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const sheetName = 'Sites and Access';
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

// Parse users with proper clearance level inheritance
let currentClearanceLevel = null;
const excelUsers = [];

for (let i = 2; i < rawData.length; i++) {
  const row = rawData[i];

  // Skip rows without email
  if (!row.__EMPTY_2 || !row.__EMPTY_2.includes('@')) {
    continue;
  }

  // Update current clearance level if present
  if (row.__EMPTY && row.__EMPTY.toString().startsWith('Level')) {
    currentClearanceLevel = row.__EMPTY.trim();
  }

  // Extract email
  let email = row.__EMPTY_2?.toLowerCase().trim() || '';
  const emailMatch = email.match(/<([^>]+)>/);
  if (emailMatch) {
    email = emailMatch[1].trim();
  }

  // Extract departments
  const departments = [];
  for (const [colName, deptName] of Object.entries(DEPARTMENT_COLUMNS)) {
    if (row[colName] === 'X' || row[colName] === 'x') {
      if (!departments.includes(deptName)) {
        departments.push(deptName);
      }
    }
  }

  excelUsers.push({
    name: row.__EMPTY_1?.trim() || '',
    email: email,
    clearanceLevel: currentClearanceLevel,
    role: ROLE_MAPPING[currentClearanceLevel] || 'Project Manager',
    siteAllocation: row.__EMPTY_3?.trim() || '',
    title: row.__EMPTY_4?.trim() || '',
    departments: departments.sort(),
    description: row.__EMPTY_11?.trim() || '',
  });
}

console.log(`Parsed ${excelUsers.length} users from Excel\n`);

// Get database users
const { data: dbUsers, error: fetchError } = await supabase
  .from('en_users')
  .select('*');

if (fetchError) {
  console.error('Error fetching users:', fetchError);
  process.exit(1);
}

console.log(`Found ${dbUsers.length} users in database\n`);

// Create lookup map
const dbUsersMap = new Map();
dbUsers.forEach(user => {
  dbUsersMap.set(user.email.toLowerCase(), user);
});

// Compare and find discrepancies
const discrepancies = [];
const matchedUsers = [];

for (const excelUser of excelUsers) {
  const dbUser = dbUsersMap.get(excelUser.email);

  if (!dbUser) {
    continue; // User not in DB, skip
  }

  const issues = [];

  // Check role
  if (dbUser.role !== excelUser.role) {
    issues.push({
      field: 'role',
      expected: excelUser.role,
      actual: dbUser.role,
    });
  }

  // Check departments
  const dbDepts = (dbUser.departments || []).sort();
  const excelDepts = excelUser.departments;

  const dbDeptsStr = JSON.stringify(dbDepts);
  const excelDeptsStr = JSON.stringify(excelDepts);

  if (dbDeptsStr !== excelDeptsStr) {
    issues.push({
      field: 'departments',
      expected: excelDepts,
      actual: dbDepts,
    });
  }

  // Check name
  if (dbUser.name !== excelUser.name) {
    issues.push({
      field: 'name',
      expected: excelUser.name,
      actual: dbUser.name,
    });
  }

  if (issues.length > 0) {
    discrepancies.push({
      email: excelUser.email,
      dbId: dbUser.id,
      clearanceLevel: excelUser.clearanceLevel,
      issues: issues,
    });
  } else {
    matchedUsers.push(excelUser.email);
  }
}

// Output results
console.log('=== ANALYSIS RESULTS ===\n');
console.log(`Total users in Excel: ${excelUsers.length}`);
console.log(`Total users in DB: ${dbUsers.length}`);
console.log(`Users with CORRECT data: ${matchedUsers.length}`);
console.log(`Users with DISCREPANCIES: ${discrepancies.length}\n`);

if (discrepancies.length > 0) {
  console.log('=== DISCREPANCIES FOUND ===\n');

  discrepancies.forEach((disc, idx) => {
    console.log(`${idx + 1}. ${disc.email} (${disc.clearanceLevel})`);
    disc.issues.forEach(issue => {
      console.log(`   ${issue.field}:`);
      console.log(`     Expected: ${JSON.stringify(issue.expected)}`);
      console.log(`     Actual:   ${JSON.stringify(issue.actual)}`);
    });
    console.log('');
  });

  // Save discrepancies to a JSON file for the fix script
  const fs = await import('fs');
  fs.writeFileSync(
    join(__dirname, 'user-discrepancies.json'),
    JSON.stringify(discrepancies, null, 2)
  );
  console.log('Discrepancies saved to user-discrepancies.json\n');
}
