/**
 * Browser Console Debug Script for Operations Manager Visibility Issue
 *
 * HOW TO USE:
 * 1. Login as the Operations Manager user
 * 2. Open browser DevTools (F12)
 * 3. Go to the Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter to run
 * 6. Review the output to see what's filtering out the workflows
 */

(async function debugOpsManagerAccess() {
    console.log('='.repeat(80));
    console.log('OPERATIONS MANAGER VISIBILITY DEBUG');
    console.log('='.repeat(80));

    // Get the current user from localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        console.error('❌ No user found in localStorage');
        return;
    }

    const user = JSON.parse(userStr);
    console.log('\n📋 CURRENT USER:');
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Sites:', user.sites);
    console.log('  Departments:', user.departments);

    // Check if user has sites and departments
    const hasSites = user.sites && user.sites.length > 0;
    const hasDepartments = user.departments && user.departments.length > 0;

    console.log('\n✅ ACCESS CHECKS:');
    console.log('  Has Sites Assigned:', hasSites ? '✓ YES' : '✗ NO');
    console.log('  Has Departments Assigned:', hasDepartments ? '✓ YES' : '✗ NO');

    if (!hasSites) {
        console.warn('⚠️  WARNING: User has NO sites assigned! This is why Requests page is empty.');
        console.warn('   Solution: Add sites to this user in the Users management page.');
    }

    if (!hasDepartments) {
        console.warn('⚠️  WARNING: User has NO departments assigned! This might cause issues.');
    }

    // Import supabase from the window object (if available)
    if (typeof window.supabase === 'undefined') {
        console.error('❌ Supabase client not found. Cannot run queries.');
        console.log('   This script needs to be run on a page where supabase is available.');
        return;
    }

    const supabase = window.supabase;

    console.log('\n🔍 QUERYING WORKFLOWS...\n');

    // Query 1: Dashboard query (departments only)
    console.log('📊 DASHBOARD QUERY (departments only):');
    let dashboardQuery = supabase.from('en_workflows_view').select('*');
    if (user.role !== 'Admin' && hasDepartments) {
        dashboardQuery = dashboardQuery.in('department', user.departments);
    }
    const { data: dashboardData, error: dashboardError } = await dashboardQuery;

    if (dashboardError) {
        console.error('   ❌ Error:', dashboardError);
    } else {
        console.log(`   ✓ Found ${dashboardData.length} workflows`);
        if (dashboardData.length > 0) {
            console.log('   Sample workflows:');
            dashboardData.slice(0, 3).forEach(wf => {
                console.log(`     - ${wf.requestNumber} | ${wf.projectCode} | ${wf.department} | ${wf.currentStatus}`);
            });
        }
    }

    // Query 2: Requests page query (departments AND sites)
    console.log('\n📋 REQUESTS QUERY (departments AND sites):');

    if (!hasSites) {
        console.log('   ⚠️  SKIPPED: User has no sites assigned');
        console.log('   This is why Requests page returns empty!');
    } else {
        let requestsQuery = supabase
            .from('en_workflows_view')
            .select('*')
            .in('currentStatus', ['Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery']);

        if (user.role !== 'Admin' && hasDepartments) {
            requestsQuery = requestsQuery.in('department', user.departments);
        }

        if (user.role !== 'Admin' && hasSites) {
            requestsQuery = requestsQuery.in('projectCode', user.sites);
        }

        const { data: requestsData, error: requestsError } = await requestsQuery;

        if (requestsError) {
            console.error('   ❌ Error:', requestsError);
        } else {
            console.log(`   ✓ Found ${requestsData.length} workflows`);
            if (requestsData.length > 0) {
                console.log('   Sample workflows:');
                requestsData.slice(0, 3).forEach(wf => {
                    console.log(`     - ${wf.requestNumber} | ${wf.projectCode} | ${wf.department} | ${wf.currentStatus}`);
                });
            } else {
                console.log('   ⚠️  NO workflows matched both department AND site filters');
            }
        }
    }

    // Query 3: Show which workflows match department but NOT site
    if (hasSites && hasDepartments) {
        console.log('\n🔎 WORKFLOWS MATCHING DEPARTMENT BUT NOT SITE:');

        let mismatchQuery = supabase
            .from('en_workflows_view')
            .select('*')
            .in('currentStatus', ['Request Submitted', 'Awaiting Ops Manager', 'Rejected at Delivery']);

        if (user.role !== 'Admin') {
            mismatchQuery = mismatchQuery.in('department', user.departments);
        }

        const { data: allDeptData, error: mismatchError } = await mismatchQuery;

        if (mismatchError) {
            console.error('   ❌ Error:', mismatchError);
        } else {
            const mismatches = allDeptData.filter(wf =>
                !user.sites.map(s => s.toLowerCase()).includes((wf.projectCode || '').toLowerCase())
            );

            if (mismatches.length > 0) {
                console.log(`   ⚠️  Found ${mismatches.length} workflows that match department but NOT site:`);
                mismatches.forEach(wf => {
                    console.log(`     - ${wf.requestNumber} | projectCode: "${wf.projectCode}" (not in user.sites)`);
                });
                console.log('\n   💡 SOLUTION: Either:');
                console.log('      1. Add these sites to the user profile, OR');
                console.log('      2. Verify the workflow projectCode values are correct');
            } else {
                console.log('   ✓ All workflows matching department also match site filter');
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));

    if (!hasSites) {
        console.log('❌ ISSUE: User has NO sites assigned');
        console.log('   This is why Requests page is empty while Dashboard shows workflows.');
        console.log('\n✅ SOLUTION:');
        console.log('   1. Go to Users management page');
        console.log('   2. Edit this Operations Manager user');
        console.log('   3. Assign the appropriate sites');
        console.log('   4. Save and refresh');
    } else if (!hasDepartments) {
        console.log('❌ ISSUE: User has NO departments assigned');
        console.log('\n✅ SOLUTION:');
        console.log('   1. Go to Users management page');
        console.log('   2. Edit this Operations Manager user');
        console.log('   3. Assign the appropriate departments');
        console.log('   4. Save and refresh');
    } else {
        console.log('ℹ️  User has both sites and departments assigned.');
        console.log('   If Requests page is still empty, check the mismatch analysis above.');
    }

    console.log('='.repeat(80));
})();
