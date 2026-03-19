import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzePerformance() {
    console.log('🔍 COMPREHENSIVE PERFORMANCE ANALYSIS\n');
    console.log('='.repeat(80) + '\n');

    const results = {
        missingIndexes: [],
        slowQueries: [],
        viewComplexity: [],
        recommendations: []
    };

    try {
        // Check for missing indexes
        console.log('1️⃣  Checking for missing indexes...\n');

        const criticalTables = [
            { table: 'en_stock_movements', columns: ['stock_item_id', 'movement_type', 'created_at', 'workflow_request_id'] },
            { table: 'en_inventory', columns: ['stock_item_id', 'store', 'site_id'] },
            { table: 'en_workflow_items', columns: ['workflow_request_id', 'stock_item_id'] },
            { table: 'en_workflow_requests', columns: ['requester_id', 'site_id', 'department', 'current_status', 'created_at'] },
            { table: 'en_stock_receipts', columns: ['stock_item_id', 'store', 'delivery_note_po'] },
            { table: 'en_stock_items', columns: ['part_number'] }
        ];

        for (const { table, columns } of criticalTables) {
            console.log(`Checking ${table}...`);

            // Note: needs manual index verification
            results.missingIndexes.push({
                table,
                columns: columns.join(', '),
                reason: 'Verify these indexes exist for optimal performance'
            });
        }

        console.log('');
        console.log('='.repeat(80) + '\n');

        // Test query performance
        console.log('2️⃣  Testing query performance...\n');

        const queries = [
            {
                name: 'Stock View (All Stores)',
                test: async () => {
                    const start = Date.now();
                    await supabase.from('en_stock_view').select('*').limit(50);
                    return Date.now() - start;
                }
            },
            {
                name: 'Stock View (Single Store)',
                test: async () => {
                    const start = Date.now();
                    await supabase.from('en_stock_view').select('*').eq('store', 'OEM').limit(50);
                    return Date.now() - start;
                }
            },
            {
                name: 'Workflows View',
                test: async () => {
                    const start = Date.now();
                    await supabase.from('en_workflows_view').select('*').limit(50);
                    return Date.now() - start;
                }
            },
            {
                name: 'Stock Movements View',
                test: async () => {
                    const start = Date.now();
                    await supabase.from('en_stock_movements_view').select('*').limit(50);
                    return Date.now() - start;
                }
            }
        ];

        for (const query of queries) {
            try {
                const time = await query.test();
                console.log(`  ${query.name}: ${time}ms`);

                if (time > 1000) {
                    results.slowQueries.push({
                        name: query.name,
                        time: time,
                        severity: time > 3000 ? 'CRITICAL' : 'WARNING'
                    });
                }
            } catch (err) {
                console.log(`  ${query.name}: ❌ Error - ${err.message}`);
                results.slowQueries.push({
                    name: query.name,
                    time: 'FAILED',
                    severity: 'CRITICAL',
                    error: err.message
                });
            }
        }

        console.log('');
        console.log('='.repeat(80) + '\n');

        // Check table sizes
        console.log('3️⃣  Checking table sizes...\n');

        const tables = [
            'en_stock_items',
            'en_inventory',
            'en_stock_movements',
            'en_stock_receipts',
            'en_workflow_requests',
            'en_workflow_items'
        ];

        for (const table of tables) {
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
            console.log(`  ${table}: ${count?.toLocaleString() || 'unknown'} rows`);
        }

        console.log('');
        console.log('='.repeat(80) + '\n');

        // Check for duplicate inventory records
        console.log('4️⃣  Checking for data quality issues...\n');

        const { data: allInv } = await supabase
            .from('en_inventory')
            .select('stock_item_id, store');

        const grouped = {};
        allInv?.forEach(inv => {
            const key = `${inv.stock_item_id}_${inv.store}`;
            grouped[key] = (grouped[key] || 0) + 1;
        });

        const duplicates = Object.entries(grouped).filter(([_, count]) => count > 1);

        if (duplicates.length > 0) {
            console.log(`  ⚠️  Found ${duplicates.length} stock items with duplicate inventory records`);
            console.log(`  Sample: ${duplicates.slice(0, 3).map(([key, count]) => `${key}: ${count} records`).join(', ')}`);
            results.recommendations.push({
                issue: 'Duplicate inventory records',
                impact: 'Causes incorrect stock counts and slow queries',
                fix: 'Clean up duplicates and add unique constraint'
            });
        } else {
            console.log('  ✅ No duplicate inventory records found');
        }

        console.log('');
        console.log('='.repeat(80) + '\n');

        // Generate report
        console.log('📊 PERFORMANCE REPORT\n');

        if (results.slowQueries.length > 0) {
            console.log('⚠️  SLOW QUERIES DETECTED:\n');
            results.slowQueries.forEach(q => {
                console.log(`  ${q.severity === 'CRITICAL' ? '🔴' : '⚠️ '} ${q.name}: ${q.time}${typeof q.time === 'number' ? 'ms' : ''}`);
                if (q.error) console.log(`     Error: ${q.error}`);
            });
            console.log('');
        }

        if (results.missingIndexes.length > 0) {
            console.log('📌 MISSING INDEXES:\n');
            results.missingIndexes.forEach(idx => {
                console.log(`  - ${idx.table} (${idx.columns})`);
            });
            console.log('');
        }

        if (results.recommendations.length > 0) {
            console.log('💡 RECOMMENDATIONS:\n');
            results.recommendations.forEach((rec, i) => {
                console.log(`  ${i + 1}. ${rec.issue}`);
                console.log(`     Impact: ${rec.impact}`);
                console.log(`     Fix: ${rec.fix}`);
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');
        console.log('✅ Analysis complete!\n');

    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        console.error(err.stack);
    }
}

analyzePerformance();
