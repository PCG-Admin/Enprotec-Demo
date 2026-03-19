const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fqgvwmubetdikhhqnuyd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxZ3Z3bXViZXRkaWtoaHFudXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxMjkzNjMsImV4cCI6MjA1MjcwNTM2M30.KOSiygB9d_A7aP2wBDuJJ49TZscHkR8ZT_Pf0Ye0gqs';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('Checking workflow statuses from both table and view...\n');
  
  // Check direct table
  const { data: tableData, error: tableError } = await supabase
    .from('en_workflow_requests')
    .select('id, request_number, current_status')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (tableError) {
    console.error('Table error:', tableError);
  } else {
    console.log('Direct from en_workflow_requests table:');
    tableData?.forEach(w => console.log(`  ${w.request_number}: ${w.current_status}`));
  }
  
  console.log('\n');
  
  // Check view
  const { data: viewData, error: viewError } = await supabase
    .from('en_workflows_view')
    .select('requestNumber, currentStatus')
    .order('createdAt', { ascending: false })
    .limit(5);
  
  if (viewError) {
    console.error('View error:', viewError);
  } else {
    console.log('From en_workflows_view:');
    viewData?.forEach(w => console.log(`  ${w.requestNumber}: ${w.currentStatus}`));
  }
})();
