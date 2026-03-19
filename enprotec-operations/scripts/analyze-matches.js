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
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

const excelUsers = rawData.slice(2)
  .filter(row => row.__EMPTY_2 && typeof row.__EMPTY_2 === 'string' && row.__EMPTY_2.includes('@'))
  .map(row => {
    let email = row.__EMPTY_2?.toLowerCase().trim() || '';
    const emailMatch = email.match(/<([^>]+)>/);
    if (emailMatch) {
      email = emailMatch[1].trim();
    }
    return {
      name: row.__EMPTY_1?.trim() || '',
      email,
      // Get email prefix for matching
      emailPrefix: email.split('@')[0]
    };
  });

// Get existing users from database
const { data: existingUsers } = await supabase
  .from('en_users')
  .select('email, name');

// Create maps
const dbByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));
const dbByPrefix = new Map(existingUsers.map(u => [u.email.split('@')[0].toLowerCase(), u]));

console.log('=== POTENTIAL MATCHES BY EMAIL PREFIX ===\n');

let potentialMatches = 0;
let exactMatches = 0;

excelUsers.forEach(excelUser => {
  const exactMatch = dbByEmail.has(excelUser.email);
  const prefixMatch = dbByPrefix.get(excelUser.emailPrefix);

  if (exactMatch) {
    exactMatches++;
  } else if (prefixMatch && prefixMatch.email !== excelUser.email) {
    potentialMatches++;
    console.log(`Excel: ${excelUser.name} <${excelUser.email}>`);
    console.log(`   DB: ${prefixMatch.name} <${prefixMatch.email}>`);
    console.log('');
  }
});

console.log(`\n=== SUMMARY ===`);
console.log(`Total Excel users: ${excelUsers.length}`);
console.log(`Total DB users: ${existingUsers.length}`);
console.log(`Exact email matches: ${exactMatches}`);
console.log(`Potential prefix matches (different domains): ${potentialMatches}`);
console.log(`Truly new users: ${excelUsers.length - exactMatches - potentialMatches}`);
