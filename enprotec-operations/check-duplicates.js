import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
    try {
        // Check for the problematic part
        console.log('🔍 Checking inventory for part PO16380...\n');

        const { data: items } = await supabase
            .from('en_stock_items')
            .select('*')
            .eq('part_number', 'PO16380');

        console.log('Stock items with part number PO16380:');
        console.log(JSON.stringify(items, null, 2));

        if (items && items.length > 0) {
            const stockItemId = items[0].id;

            console.log(`\n🔍 Checking inventory records for stock_item_id: ${stockItemId}...\n`);

            const { data: invRecords } = await supabase
                .from('en_inventory')
                .select('*')
                .eq('stock_item_id', stockItemId);

            console.log('Inventory records:');
            console.log(JSON.stringify(invRecords, null, 2));

            console.log(`\n📊 Total inventory records: ${invRecords?.length || 0}`);
        }

        // Check if there are stock items with inventory in multiple stores
        console.log('\n' + '='.repeat(80));
        console.log('\n🔍 Checking for items with multiple store locations...\n');

        const { data: multiStore } = await supabase.rpc('exec_sql', {
            sql: `
                SELECT
                    si.part_number,
                    COUNT(DISTINCT inv.store) as store_count,
                    array_agg(DISTINCT inv.store) as stores
                FROM en_stock_items si
                JOIN en_inventory inv ON si.id = inv.stock_item_id
                GROUP BY si.part_number
                HAVING COUNT(DISTINCT inv.store) > 1
                LIMIT 10
            `
        }).catch(() => null);

        if (multiStore && multiStore.data) {
            console.log('Items in multiple stores:');
            console.log(JSON.stringify(multiStore.data, null, 2));
        } else {
            // Alternative query
            console.log('Running alternative check...\n');

            const { data: allInv } = await supabase
                .from('en_inventory')
                .select('stock_item_id, store, quantity_on_hand');

            // Group by stock_item_id
            const grouped = {};
            allInv?.forEach(inv => {
                if (!grouped[inv.stock_item_id]) {
                    grouped[inv.stock_item_id] = [];
                }
                grouped[inv.stock_item_id].push(inv);
            });

            // Find items with multiple stores
            const multipleStores = Object.entries(grouped)
                .filter(([_, invs]) => invs.length > 1)
                .slice(0, 10);

            console.log(`Found ${multipleStores.length} items with multiple inventory records:`);
            multipleStores.forEach(([id, invs]) => {
                console.log(`\nStock Item ID: ${id}`);
                console.log('Stores:', invs.map(i => `${i.store} (qty: ${i.quantity_on_hand})`).join(', '));
            });
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

checkDuplicates();
