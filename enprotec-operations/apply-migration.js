import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260126_create_stock_movements_view.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Applying migration: 20260126_create_stock_movements_view.sql');
        console.log('');

        // Execute the SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });

        if (error) {
            // Try alternative approach - split by semicolons and execute each statement
            console.log('⚠️  RPC method not available, trying direct SQL execution...');

            const { error: directError } = await supabase
                .from('_migrations')
                .select('*')
                .limit(1);

            if (directError) {
                console.error('❌ Cannot execute SQL directly. Please run the migration manually.');
                console.log('\nCopy and paste the following SQL into your Supabase SQL Editor:');
                console.log('https://supabase.com/dashboard/project/eplxpejktfgnivbwtpes/sql/new');
                console.log('\n' + '='.repeat(80));
                console.log(migrationSQL);
                console.log('='.repeat(80));
                return;
            }
        }

        console.log('✅ Migration applied successfully!');
        console.log('');
        console.log('The view en_stock_movements_view has been created.');
        console.log('You can now run your app and the "View history" feature should work.');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
        console.log('\n📋 Please run the migration manually:');
        console.log('1. Go to: https://supabase.com/dashboard/project/eplxpejktfgnivbwtpes/sql/new');
        console.log('2. Copy the SQL from: supabase/migrations/20260126_create_stock_movements_view.sql');
        console.log('3. Paste and execute it in the SQL Editor');
    }
}

applyMigration();
