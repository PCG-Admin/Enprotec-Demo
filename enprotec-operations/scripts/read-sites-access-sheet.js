import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Excel file
const workbook = XLSX.readFile(join(__dirname, '../public/Digital Stores Access_2026.xlsx'));

console.log('Available sheets:', workbook.SheetNames);
console.log('');

// Check if 'Sites and access' sheet exists
const sheetName = workbook.SheetNames.find(name =>
  name.toLowerCase().includes('sites') || name.toLowerCase().includes('access')
);

if (!sheetName) {
  console.log('Could not find "Sites and access" sheet');
  console.log('Available sheets:', workbook.SheetNames);
  process.exit(1);
}

console.log(`Reading sheet: "${sheetName}"\n`);

const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Display first 15 rows to see structure
console.log('=== FIRST 15 ROWS ===\n');
rawData.slice(0, 15).forEach((row, idx) => {
  console.log(`Row ${idx + 1}:`, row);
});

console.log('\n=== COLUMN HEADERS ===\n');

// Try to get data with column names
const dataWithHeaders = XLSX.utils.sheet_to_json(worksheet);
if (dataWithHeaders.length > 0) {
  console.log('Column names detected:', Object.keys(dataWithHeaders[0]));
  console.log('\n=== SAMPLE RECORDS (First 5 users) ===\n');
  dataWithHeaders.slice(0, 5).forEach((row, idx) => {
    console.log(`\nUser ${idx + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });
}
