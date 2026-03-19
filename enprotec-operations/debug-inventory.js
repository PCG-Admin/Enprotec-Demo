import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugInventory() {
    try {
        console.log('🔍 Checking inventory data...\n');

        // Get a sample of inventory records
        const { data: invData, error: invError } = await supabase
            .from('en_inventory')
            .select('*')
            .limit(10);

        if (invError) {
            console.error('❌ Error querying inventory:', invError);
        } else {
            console.log('Sample inventory records:');
            console.log(JSON.stringify(invData, null, 2));
        }

        console.log('\n' + '='.repeat(80) + '\n');

        // Check the stock view
        console.log('🔍 Checking en_stock_view...\n');

        const { data: stockData, error: stockError } = await supabase
            .from('en_stock_view')
            .select('*')
            .limit(10);

        if (stockError) {
            console.error('❌ Error querying stock view:', stockError);
        } else {
            console.log('Sample stock view records:');
            console.log(JSON.stringify(stockData, null, 2));

            // Check if there are duplicate part numbers with different stores
            const partNumbers = stockData.map(s => s.partNumber);
            const duplicates = partNumbers.filter((item, index) => partNumbers.indexOf(item) !== index);

            if (duplicates.length > 0) {
                console.log('\n⚠️  WARNING: Found duplicate part numbers:', [...new Set(duplicates)]);
            }
        }

        console.log('\n' + '='.repeat(80) + '\n');

        // Check stock movements
        console.log('🔍 Checking recent stock movements...\n');

        const { data: movData, error: movError } = await supabase
            .from('en_stock_movements')
            .select('*, en_stock_items(part_number)')
            .order('created_at', { ascending: false })
            .limit(5);

        if (movError) {
            console.error('❌ Error querying movements:', movError);
        } else {
            console.log('Recent movements:');
            console.log(JSON.stringify(movData, null, 2));
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

debugInventory();
