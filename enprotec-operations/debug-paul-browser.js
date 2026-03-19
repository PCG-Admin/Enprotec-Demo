// Browser Console Debug Script - Check Paul's User Profile and Workflows
//
// INSTRUCTIONS:
// 1. Login as Paul Dlhamini
// 2. Open browser DevTools (F12)
// 3. Go to Console tab
// 4. Copy and paste this entire script
// 5. Press Enter

(async function debugPaulSites() {
    console.log('='.repeat(80));
    console.log('PAUL DLHAMINI - SITE VISIBILITY DEBUG');
    console.log('='.repeat(80));

    // Get user from localStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        console.error('❌ No user found in localStorage');
        return;
    }

    const user = JSON.parse(userStr);

    console.log('\n👤 USER PROFILE:');
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Sites:', JSON.stringify(user.sites));
    console.log('  Departments:', JSON.stringify(user.departments));

    // Check if sites is array
    if (!Array.isArray(user.sites)) {
        console.error('\n❌ ERROR: user.sites is NOT an array!');
        console.log('  Type:', typeof user.sites);
        console.log('  Value:', user.sites);
        return;
    }

    if (user.sites.length === 0) {
        console.error('\n❌ ERROR: user.sites array is EMPTY!');
        console.log('  This user has no sites assigned.');
        console.log('  Solution: Edit user profile and add sites.');
        return;
    }

    console.log('\n✅ User has', user.sites.length, 'site(s) assigned');

    // Check supabase
    if (typeof supabase === 'undefined') {
        console.error('\n❌ Supabase not available. Try running this on Dashboard page.');
        return;
    }

    console.log('\n🔍 TESTING QUERIES...\n');

    // Query 1: All workflows (no filter)
    console.log('1️⃣  Query ALL workflows (no filters):');
    const { data: allData, error: allError } = await supabase
        .from('en_workflows_view')
        .select('*');

    if (allError) {
        console.error('   ❌ Error:', allError);
    } else {
        console.log(`   ✅ Total workflows in database: ${allData.length}`);
        if (allData.length > 0) {
            console.log('   Sample projectCodes:',
                [...new Set(allData.map(w => w.projectCode))].slice(0, 10)
            );
        }
    }

    // Query 2: Filter by departments only
    console.log('\n2️⃣  Query with DEPARTMENT filter only:');
    let deptQuery = supabase.from('en_workflows_view').select('*');
    if (user.departments && user.departments.length > 0) {
        deptQuery = deptQuery.in('department', user.departments);
    }
    const { data: deptData, error: deptError } = await deptQuery;

    if (deptError) {
        console.error('   ❌ Error:', deptError);
    } else {
        console.log(`   ✅ Workflows matching departments: ${deptData.length}`);
        if (deptData.length > 0) {
            console.log('   ProjectCodes in results:',
                [...new Set(deptData.map(w => w.projectCode))].slice(0, 10)
            );
        }
    }

    // Query 3: Filter by departments AND sites (actual query)
    console.log('\n3️⃣  Query with DEPARTMENT + SITE filters (actual Dashboard query):');
    let fullQuery = supabase.from('en_workflows_view').select('*');

    if (user.departments && user.departments.length > 0) {
        fullQuery = fullQuery.in('department', user.departments);
    }

    if (user.sites && user.sites.length > 0) {
        fullQuery = fullQuery.in('projectCode', user.sites);
    }

    const { data: fullData, error: fullError } = await fullQuery;

    if (fullError) {
        console.error('   ❌ Error:', fullError);
    } else {
        console.log(`   ✅ Workflows matching departments AND sites: ${fullData.length}`);
        if (fullData.length > 0) {
            console.log('   Matched workflows:');
            fullData.slice(0, 5).forEach(w => {
                console.log(`     - ${w.requestNumber} | ${w.projectCode} | ${w.department} | ${w.currentStatus}`);
            });
        } else {
            console.warn('   ⚠️  NO WORKFLOWS MATCHED!');
        }
    }

    // Analysis
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS:');
    console.log('='.repeat(80));

    if (fullData && fullData.length > 0) {
        console.log('✅ SUCCESS: User can see workflows!');
        console.log(`   ${fullData.length} workflow(s) match the filters.`);
    } else if (deptData && deptData.length > 0) {
        console.warn('⚠️  ISSUE: Workflows exist for user\'s departments but NOT for user\'s sites');
        console.log('\n   User\'s sites:', user.sites);
        console.log('   Available projectCodes:', [...new Set(deptData.map(w => w.projectCode))]);

        // Check for case mismatch
        const userSitesLower = user.sites.map(s => s.toLowerCase());
        const projectCodesLower = deptData.map(w => (w.projectCode || '').toLowerCase());
        const caseInsensitiveMatches = projectCodesLower.filter(pc => userSitesLower.includes(pc));

        if (caseInsensitiveMatches.length > 0) {
            console.warn('\n   🔍 FOUND CASE MISMATCH!');
            console.warn('   Some projectCodes match user sites but with different case.');
            console.warn('   Example:');
            deptData.forEach(w => {
                const userSite = user.sites.find(s => s.toLowerCase() === (w.projectCode || '').toLowerCase());
                if (userSite && userSite !== w.projectCode) {
                    console.warn(`     User has: "${userSite}" | Workflow has: "${w.projectCode}"`);
                }
            });
            console.warn('\n   ✅ SOLUTION: Update user.sites to match exact case of workflow projectCodes');
        } else {
            console.error('\n   ❌ NO MATCH: User\'s sites do not match any workflow projectCodes');
            console.log('\n   ✅ SOLUTION: Either:');
            console.log('      1. Add workflows for these sites: ', user.sites);
            console.log('      2. Update user.sites to match existing projectCodes');
        }
    } else {
        console.error('❌ No workflows exist for user\'s departments:', user.departments);
    }

    console.log('='.repeat(80));
})();
