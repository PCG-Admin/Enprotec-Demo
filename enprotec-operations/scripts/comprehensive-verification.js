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

// Read Excel file - Sites and Access sheet
console.log('Reading Excel file...\n');
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const worksheet = workbook.Sheets['Sites and Access'];

// Get raw data as array to see exact structure
const rawArrayData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Print header rows to understand column positions
console.log('=== HEADER STRUCTURE ===');
console.log('Row 2 (Main Headers):', rawArrayData[1]);
console.log('Row 3 (Store Headers):', rawArrayData[2]);
console.log('\n');

// Based on the screenshot, the columns are:
// A: User #
// B: Clearance Level
// C: Name
// D: Email Address
// E: Site Allocation
// F: Title
// G: OEM (Store Access)
// H: Operations
// I: Projects
// J: Salvage Yard
// K: Grootegeluk Satellite Store
// L: Makhado Satellite Store
// M: Description

// Parse with proper understanding
const rawData = XLSX.utils.sheet_to_json(worksheet);

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

  // Extract departments based on X markings
  const departments = [];

  // Column G (__EMPTY_5): OEM
  if (row.__EMPTY_5 === 'X' || row.__EMPTY_5 === 'x') {
    departments.push('OEM');
  }

  // Column H (__EMPTY_6): Operations
  if (row.__EMPTY_6 === 'X' || row.__EMPTY_6 === 'x') {
    departments.push('Operations');
  }

  // Column I (__EMPTY_7): Projects
  if (row.__EMPTY_7 === 'X' || row.__EMPTY_7 === 'x') {
    departments.push('Projects');
  }

  // Column J (__EMPTY_8): Salvage Yard
  if (row.__EMPTY_8 === 'X' || row.__EMPTY_8 === 'x') {
    departments.push('SalvageYard');
  }

  // Column K (__EMPTY_9): Grootegeluk Satellite Store
  // Column L (__EMPTY_10): Makhado Satellite Store
  // Both map to 'Satellite' department
  if (row.__EMPTY_9 === 'X' || row.__EMPTY_9 === 'x' ||
      row.__EMPTY_10 === 'X' || row.__EMPTY_10 === 'x') {
    if (!departments.includes('Satellite')) {
      departments.push('Satellite');
    }
  }

  excelUsers.push({
    userNumber: row['Inventory Digital System Access Guideline'],
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

// Create lookup map
const dbUsersMap = new Map();
dbUsers.forEach(user => {
  dbUsersMap.set(user.email.toLowerCase(), user);
});

// Compare and find ALL discrepancies
const discrepancies = [];
const correctUsers = [];

for (const excelUser of excelUsers) {
  const dbUser = dbUsersMap.get(excelUser.email);

  if (!dbUser) {
    continue; // User not in DB
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
      userNumber: excelUser.userNumber,
      email: excelUser.email,
      name: excelUser.name,
      clearanceLevel: excelUser.clearanceLevel,
      dbId: dbUser.id,
      issues: issues,
    });
  } else {
    correctUsers.push(excelUser.email);
  }
}

// Output results
console.log('=== VERIFICATION RESULTS ===\n');
console.log(`Total users in Excel: ${excelUsers.length}`);
console.log(`Total users in DB: ${dbUsers.length}`);
console.log(`Users with CORRECT data: ${correctUsers.length}`);
console.log(`Users with DISCREPANCIES: ${discrepancies.length}\n`);

if (discrepancies.length > 0) {
  console.log('=== ❌ DISCREPANCIES FOUND ===\n');

  discrepancies.forEach((disc, idx) => {
    console.log(`${idx + 1}. User #${disc.userNumber}: ${disc.name} (${disc.email})`);
    console.log(`   Clearance Level: ${disc.clearanceLevel}`);
    disc.issues.forEach(issue => {
      console.log(`   ${issue.field}:`);
      console.log(`     Expected (Excel): ${JSON.stringify(issue.expected)}`);
      console.log(`     Actual (DB):      ${JSON.stringify(issue.actual)}`);
    });
    console.log('');
  });
} else {
  console.log('✅ ALL USERS IN DATABASE MATCH THE EXCEL FILE PERFECTLY!');
  console.log('No discrepancies found.');
}
