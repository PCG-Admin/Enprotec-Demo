import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testView() {
    try {
        // First, let's create the view by executing the SQL
        const migrationSQL = fs.readFileSync(
            'supabase/migrations/20260126_create_stock_movements_view.sql',
            'utf8'
        );

        console.log('📝 Creating view...\n');

        // Since we can't execute DDL directly, we'll just test if the view can be queried
        // You'll need to create it manually in Supabase first

        console.log('🔍 Testing view query...\n');

        const { data, error } = await supabase
            .from('en_stock_movements_view')
            .select('*')
            .limit(5);

        if (error) {
            console.error('❌ Error querying view:', error.message);
            console.log('\n📋 Please run this SQL in your Supabase dashboard:');
            console.log('https://supabase.com/dashboard/project/eplxpejktfgnivbwtpes/sql/new');
            console.log('\n' + '='.repeat(80));
            console.log(migrationSQL);
            console.log('='.repeat(80));
        } else {
            console.log('✅ View is working! Sample data:');
            console.log(JSON.stringify(data, null, 2));

            // Check if store field is populated
            const withStore = data.filter(d => d.store);
            console.log(`\n✅ ${withStore.length} out of ${data.length} movements have a store value`);

            if (withStore.length === 0 && data.length > 0) {
                console.log('⚠️  Warning: No movements have a store value. This might be expected if they\'re not linked to workflows or receipts.');
            }
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testView();
