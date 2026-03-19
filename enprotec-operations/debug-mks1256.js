import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMKS1256() {
    console.log('🔍 Investigating MKS1256...\n');
    console.log('='.repeat(80) + '\n');

    try {
        // Step 1: Find the stock item
        console.log('Step 1: Looking for MKS1256 in stock items...');
        const { data: stockItems, error: itemError } = await supabase
            .from('en_stock_items')
            .select('*')
            .ilike('part_number', '%MKS1256%');

        if (itemError) {
            console.error('❌ Error:', itemError.message);
            return;
        }

        if (!stockItems || stockItems.length === 0) {
            console.log('❌ No stock item found with part number MKS1256');
            return;
        }

        console.log('✅ Found stock item(s):');
        stockItems.forEach(item => {
            console.log(`  - ID: ${item.id}`);
            console.log(`  - Part Number: ${item.part_number}`);
            console.log(`  - Description: ${item.description}`);
        });

        const stockItemId = stockItems[0].id;
        const partNumber = stockItems[0].part_number;

        console.log('\n' + '='.repeat(80) + '\n');

        // Step 2: Check inventory records
        console.log('Step 2: Checking inventory records...');
        const { data: inventory, error: invError } = await supabase
            .from('en_inventory')
            .select('*')
            .eq('stock_item_id', stockItemId);

        if (invError) {
            console.error('❌ Error:', invError.message);
        } else {
            console.log(`✅ Found ${inventory.length} inventory record(s):`);
            inventory.forEach(inv => {
                console.log(`  - Store: ${inv.store}`);
                console.log(`  - Quantity: ${inv.quantity_on_hand}`);
                console.log(`  - Location: ${inv.location || 'N/A'}`);
                console.log(`  - ID: ${inv.id}`);
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');

        // Step 3: Check stock movements (raw table)
        console.log('Step 3: Checking stock movements (raw table)...');
        const { data: movements, error: movError } = await supabase
            .from('en_stock_movements')
            .select('*')
            .eq('stock_item_id', stockItemId)
            .order('created_at', { ascending: false });

        if (movError) {
            console.error('❌ Error:', movError.message);
        } else {
            console.log(`✅ Found ${movements.length} movement(s) in raw table:`);
            movements.forEach(mov => {
                console.log(`  - ID: ${mov.id}`);
                console.log(`  - Type: ${mov.movement_type}`);
                console.log(`  - Quantity: ${mov.quantity}`);
                console.log(`  - Created: ${mov.created_at}`);
                console.log(`  - User ID: ${mov.user_id}`);
                console.log(`  - Workflow ID: ${mov.workflow_request_id}`);
                console.log(`  - Note: ${mov.note}`);
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');

        // Step 4: Check stock receipts
        console.log('Step 4: Checking stock receipts...');
        const { data: receipts, error: recError } = await supabase
            .from('en_stock_receipts')
            .select('*')
            .eq('stock_item_id', stockItemId)
            .order('received_at', { ascending: false });

        if (recError) {
            console.error('❌ Error:', recError.message);
        } else {
            console.log(`✅ Found ${receipts.length} receipt(s):`);
            receipts.forEach(rec => {
                console.log(`  - ID: ${rec.id}`);
                console.log(`  - Quantity: ${rec.quantity_received}`);
                console.log(`  - Store: ${rec.store}`);
                console.log(`  - Delivery Note: ${rec.delivery_note_po}`);
                console.log(`  - Received At: ${rec.received_at}`);
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');

        // Step 5: Try the view query (what the frontend uses)
        console.log('Step 5: Querying en_stock_movements_view...');
        const { data: viewData, error: viewError } = await supabase
            .from('en_stock_movements_view')
            .select('*')
            .eq('partNumber', partNumber)
            .order('createdAt', { ascending: false });

        if (viewError) {
            console.error('❌ Error querying view:', viewError.message);
            console.log('\n⚠️  The view might not exist yet! Run the migration first.');
        } else {
            console.log(`✅ View returned ${viewData.length} movement(s):`);
            viewData.forEach(mov => {
                console.log(`  - Type: ${mov.movementType}`);
                console.log(`  - Quantity: ${mov.quantityDelta}`);
                console.log(`  - Store: ${mov.store}`);
                console.log(`  - Site: ${mov.siteName || 'N/A'}`);
                console.log(`  - Actioned By: ${mov.actionedBy || 'N/A'}`);
                console.log(`  - Request #: ${mov.requestNumber || 'N/A'}`);
                console.log(`  - Created: ${mov.createdAt}`);
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');

        // Step 6: Check what the frontend query looks like
        console.log('Step 6: Simulating frontend query...');
        const store = inventory && inventory.length > 0 ? inventory[0].store : null;

        if (store) {
            console.log(`Frontend queries for: partNumber="${partNumber}" AND store="${store}"`);

            const { data: frontendData, error: frontendError } = await supabase
                .from('en_stock_movements_view')
                .select('id, movementType, quantityDelta, store, createdAt, siteName, actionedBy, requestNumber, note')
                .eq('partNumber', partNumber)
                .eq('store', store)
                .order('createdAt', { ascending: false })
                .limit(50);

            if (frontendError) {
                console.error('❌ Error:', frontendError.message);
            } else {
                console.log(`✅ Frontend query returned ${frontendData.length} movement(s):`);
                console.log(JSON.stringify(frontendData, null, 2));
            }
        } else {
            console.log('⚠️  No store found in inventory, cannot simulate frontend query');
        }

    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        console.error(err.stack);
    }
}

debugMKS1256();
