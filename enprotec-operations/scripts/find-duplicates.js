import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Excel file
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet);

const excelUsers = rawData.slice(2)
  .filter(row => row.__EMPTY_2 && typeof row.__EMPTY_2 === 'string' && row.__EMPTY_2.includes('@'))
  .map((row, index) => {
    let email = row.__EMPTY_2?.toLowerCase().trim() || '';
    const emailMatch = email.match(/<([^>]+)>/);
    if (emailMatch) {
      email = emailMatch[1].trim();
    }
    return {
      rowNumber: index + 3, // +3 because we skip 2 header rows and arrays are 0-indexed
      name: row.__EMPTY_1?.trim() || '',
      email: email,
    };
  });

// Find duplicates
const emailCount = new Map();
excelUsers.forEach(user => {
  if (!emailCount.has(user.email)) {
    emailCount.set(user.email, []);
  }
  emailCount.get(user.email).push(user);
});

const duplicates = Array.from(emailCount.entries())
  .filter(([email, users]) => users.length > 1);

if (duplicates.length > 0) {
  console.log('=== DUPLICATE EMAILS FOUND IN EXCEL ===\n');
  duplicates.forEach(([email, users]) => {
    console.log(`Email: ${email} (appears ${users.length} times)`);
    users.forEach(user => {
      console.log(`  Row ${user.rowNumber}: ${user.name}`);
    });
    console.log('');
  });
  console.log(`Total duplicate emails: ${duplicates.length}`);
} else {
  console.log('No duplicates found!');
}
