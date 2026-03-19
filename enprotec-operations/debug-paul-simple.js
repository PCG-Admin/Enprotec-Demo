// Simple debug script - Check what data Paul Dlhamini has in database
// Run this in browser console (F12) on any page after logging in

(async function checkPaulData() {
    console.log('================================================================================');
    console.log('CHECKING PAUL DLHAMINI DATA');
    console.log('================================================================================');

    // First try to get user from localStorage
    const userStr = localStorage.getItem('user');
    let currentUser = null;

    if (userStr) {
        currentUser = JSON.parse(userStr);
        console.log('\n✅ Found user in localStorage:');
        console.log('   Name:', currentUser.name);
        console.log('   Email:', currentUser.email);
        console.log('   Role:', currentUser.role);
        console.log('   Sites:', JSON.stringify(currentUser.sites));
        console.log('   Departments:', JSON.stringify(currentUser.departments));
    } else {
        console.log('\n⚠️  No user in localStorage - trying to get from Supabase session...');
    }

    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.error('\n❌ Supabase client not available.');
        console.log('   Please run this script on the Dashboard page after logging in.');
        return;
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.error('\n❌ No active session found.');
        console.log('   Please login first, then run this script.');
        return;
    }

    console.log('\n✅ Active session found');
    console.log('   User ID:', session.user.id);
    console.log('   Email:', session.user.email);

    // Fetch user profile from database
    console.log('\n🔍 Fetching user profile from database...');
    const { data: userData, error: userError } = await supabase
        .from('en_users')
        .select('id, name, email, role, sites, departments, status')
        .eq('id', session.user.id)
        .single();

    if (userError) {
        console.error('❌ Error fetching user profile:', userError);
        return;
    }

    console.log('\n👤 USER PROFILE FROM DATABASE:');
    console.log('   Name:', userData.name);
    console.log('   Email:', userData.email);
    console.log('   Role:', userData.role);
    console.log('   Status:', userData.status);
    console.log('   Sites:', JSON.stringify(userData.sites));
    console.log('   Departments:', JSON.stringify(userData.departments));

    // Check if sites exist
    if (!userData.sites || userData.sites.length === 0) {
        console.error('\n❌ PROBLEM FOUND: User has NO sites assigned!');
        console.log('   This is why the user cannot see any workflows.');
        console.log('\n✅ SOLUTION:');
        console.log('   1. Go to Users management page (as Admin)');
        console.log('   2. Edit this user');
        console.log('   3. Add sites to their profile');
        console.log('   4. Save');
        console.log('   5. User must logout and login again');
        return;
    }

    console.log('\n✅ User has', userData.sites.length, 'site(s) assigned');

    // Query all workflows to see what projectCodes exist
    console.log('\n🔍 Checking available workflows...');
    const { data: allWorkflows, error: wfError } = await supabase
        .from('en_workflows_view')
        .select('requestNumber, projectCode, department, currentStatus');

    if (wfError) {
        console.error('❌ Error fetching workflows:', wfError);
        return;
    }

    console.log('\n📊 WORKFLOW ANALYSIS:');
    console.log('   Total workflows in database:', allWorkflows.length);

    // Get unique projectCodes
    const uniqueProjectCodes = [...new Set(allWorkflows.map(w => w.projectCode))].sort();
    console.log('   Unique project codes:', uniqueProjectCodes);

    // Filter by user's departments
    let deptFiltered = allWorkflows;
    if (userData.departments && userData.departments.length > 0) {
        deptFiltered = allWorkflows.filter(w => userData.departments.includes(w.department));
        console.log('\n   Workflows matching user departments:', deptFiltered.length);
        const deptProjectCodes = [...new Set(deptFiltered.map(w => w.projectCode))].sort();
        console.log('   Project codes in those workflows:', deptProjectCodes);
    }

    // Filter by user's sites
    const fullyFiltered = deptFiltered.filter(w => userData.sites.includes(w.projectCode));
    console.log('\n   Workflows matching BOTH departments AND sites:', fullyFiltered.length);

    if (fullyFiltered.length > 0) {
        console.log('\n✅ SUCCESS: User should see these workflows:');
        fullyFiltered.slice(0, 5).forEach(w => {
            console.log(`     - ${w.requestNumber} | ${w.projectCode} | ${w.department} | ${w.currentStatus}`);
        });
    } else {
        console.warn('\n⚠️  NO WORKFLOWS MATCH!');
        console.log('\n   User\'s sites:', userData.sites);
        console.log('   Available projectCodes (for user\'s departments):',
            [...new Set(deptFiltered.map(w => w.projectCode))].sort()
        );

        // Check for case mismatch
        const userSitesLower = userData.sites.map(s => String(s).toLowerCase());
        const availableCodesLower = deptFiltered.map(w => String(w.projectCode || '').toLowerCase());

        const potentialMatches = [];
        userSitesLower.forEach((userSite, idx) => {
            const matchIdx = availableCodesLower.indexOf(userSite);
            if (matchIdx !== -1) {
                potentialMatches.push({
                    userHas: userData.sites[idx],
                    workflowHas: deptFiltered[matchIdx].projectCode
                });
            }
        });

        if (potentialMatches.length > 0) {
            console.warn('\n   🔍 CASE MISMATCH DETECTED!');
            console.log('   The following sites match but with different case:');
            potentialMatches.forEach(m => {
                console.warn(`     User has: "${m.userHas}" | Workflow has: "${m.workflowHas}"`);
            });
            console.log('\n✅ SOLUTION: Update user.sites to match the exact case:');
            console.log('   SQL:');
            const correctSites = userData.sites.map(us => {
                const match = potentialMatches.find(m =>
                    String(m.userHas).toLowerCase() === String(us).toLowerCase()
                );
                return match ? match.workflowHas : us;
            });
            console.log(`   UPDATE en_users SET sites = '${JSON.stringify(correctSites)}'::jsonb WHERE id = '${userData.id}';`);
        } else {
            console.error('\n   ❌ NO MATCH AT ALL!');
            console.log('   User\'s sites don\'t match any workflow projectCodes (even ignoring case).');
            console.log('\n✅ SOLUTION OPTIONS:');
            console.log('   Option 1: Update user sites to match existing workflows:');
            console.log(`     UPDATE en_users SET sites = '${JSON.stringify([...new Set(deptFiltered.map(w => w.projectCode))])}' WHERE id = '${userData.id}';`);
            console.log('\n   Option 2: Create workflows for the user\'s assigned sites:', userData.sites);
        }
    }

    console.log('\n================================================================================');
})();
