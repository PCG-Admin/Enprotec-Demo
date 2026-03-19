import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Excel file
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const worksheet = workbook.Sheets['Sites and Access'];
const rawData = XLSX.utils.sheet_to_json(worksheet);

// Focus on the users mentioned
const targetEmails = [
  'jujuan.kasselman@enprotec.com',
  'sboniso.thage@enprotec.com',
  'riaan.visser@enprotec.com',
  'riaan.botha@enprotec.com'
];

console.log('=== ANALYZING SPECIFIC USERS ===\n');

for (let i = 2; i < rawData.length; i++) {
  const row = rawData[i];

  let email = row.__EMPTY_2?.toLowerCase().trim() || '';
  const emailMatch = email.match(/<([^>]+)>/);
  if (emailMatch) {
    email = emailMatch[1].trim();
  }

  if (targetEmails.includes(email)) {
    console.log(`\n${row.__EMPTY_1} (${email})`);
    console.log('Raw row data:');
    console.log(JSON.stringify(row, null, 2));
    console.log('\nColumn mappings:');
    console.log(`  __EMPTY_5 (OEM): ${row.__EMPTY_5}`);
    console.log(`  __EMPTY_6 (Operations): ${row.__EMPTY_6}`);
    console.log(`  __EMPTY_7 (Projects): ${row.__EMPTY_7}`);
    console.log(`  __EMPTY_8 (Salvage Yard): ${row.__EMPTY_8}`);
    console.log(`  __EMPTY_9 (Grootegeluk Satellite): ${row.__EMPTY_9}`);
    console.log(`  __EMPTY_10 (Makhado Satellite): ${row.__EMPTY_10}`);
    console.log(`  __EMPTY_11 (Description): ${row.__EMPTY_11}`);
    console.log('---');
  }
}
