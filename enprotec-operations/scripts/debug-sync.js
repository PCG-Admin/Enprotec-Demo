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

// Read Excel file
console.log('Reading Excel file...');
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

// Parse emails from Excel
const excelEmails = rawData.slice(2)
  .filter(row => row.__EMPTY_2 && typeof row.__EMPTY_2 === 'string' && row.__EMPTY_2.includes('@'))
  .map(row => {
    let email = row.__EMPTY_2?.toLowerCase().trim() || '';
    const emailMatch = email.match(/<([^>]+)>/);
    if (emailMatch) {
      email = emailMatch[1].trim();
    }
    return { name: row.__EMPTY_1, email };
  });

console.log(`Found ${excelEmails.length} emails in Excel\n`);

// Get existing users from database
const { data: existingUsers, error: fetchError } = await supabase
  .from('en_users')
  .select('email, name');

if (fetchError) {
  console.error('Error fetching users:', fetchError);
  process.exit(1);
}

console.log(`Found ${existingUsers.length} users in database\n`);

// Create maps for comparison
const dbEmailsSet = new Set(existingUsers.map(u => u.email.toLowerCase()));
const excelEmailsSet = new Set(excelEmails.map(u => u.email));

console.log('=== DEBUGGING EMAIL MATCHES ===\n');

// Find emails in Excel that are NOT in database
const newEmails = excelEmails.filter(u => !dbEmailsSet.has(u.email));
console.log(`Emails in Excel but NOT in database (${newEmails.length}):`);
newEmails.forEach(u => console.log(`  ${u.name} - ${u.email}`));

console.log('\n');

// Find emails in database that are NOT in Excel
const removedEmails = existingUsers.filter(u => !excelEmailsSet.has(u.email.toLowerCase()));
console.log(`Emails in database but NOT in Excel (${removedEmails.length}):`);
removedEmails.forEach(u => console.log(`  ${u.name} - ${u.email}`));

console.log('\n');

// Show some examples of matches
const matches = excelEmails.filter(u => dbEmailsSet.has(u.email)).slice(0, 10);
console.log(`Sample of MATCHED emails (${excelEmails.length - newEmails.length} total):`);
matches.forEach(u => console.log(`  ${u.name} - ${u.email}`));
