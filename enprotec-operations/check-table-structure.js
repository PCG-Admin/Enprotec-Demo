import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
    try {
        // Try to get a sample record to see what columns exist
        const { data, error } = await supabase
            .from('en_stock_movements')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error querying table:', error);
        } else {
            console.log('Sample record from en_stock_movements:');
            console.log(data);

            if (data && data.length > 0) {
                console.log('\nColumns found:');
                console.log(Object.keys(data[0]));
            } else {
                console.log('\nNo records found in table');
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkTableStructure();
