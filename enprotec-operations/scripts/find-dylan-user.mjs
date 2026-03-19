import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function findDylan() {
  console.log('\n🔍 Searching for Dylan...\n')

  // Check en_users table
  const { data: usersData, error: userError } = await supabase
    .from('en_users')
    .select('id, name, email, role, sites')
    .or('email.eq.dylan.oosthuysen@enprotec.com,name.ilike.%dylan%')

  if (userError) {
    console.error('❌ Error finding user in en_users:', userError.message)
    return
  }

  if (!usersData || usersData.length === 0) {
    console.log('❌ User not found in en_users table')
    return
  }

  if (usersData.length > 1) {
    console.log(`⚠️  Found ${usersData.length} users matching "dylan":`)
    usersData.forEach((u, i) => {
      console.log(`\n   ${i + 1}. ${u.name} (${u.email})`)
      console.log(`      ID: ${u.id}`)
    })
    console.log('\nPlease use the specific email to update the correct user.')
    return
  }

  const userData = usersData[0]

  console.log('✅ Found user in en_users table:')
  console.log(`   ID: ${userData.id}`)
  console.log(`   Name: ${userData.name}`)
  console.log(`   Email: ${userData.email}`)
  console.log(`   Role: ${userData.role}`)
  console.log(`   Sites: ${userData.sites?.join(', ') || 'None'}`)

  // Check auth.users table
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userData.id)

  if (authError) {
    console.error('❌ Error finding user in auth.users:', authError.message)
    return
  }

  console.log('\n✅ Found user in auth.users table:')
  console.log(`   Auth Email: ${authData.user.email}`)
  console.log(`   Email Confirmed: ${authData.user.email_confirmed_at ? 'Yes' : 'No'}`)
  console.log(`   Created: ${authData.user.created_at}`)

  if (userData.email !== authData.user.email) {
    console.log('\n⚠️  EMAIL MISMATCH DETECTED!')
    console.log(`   en_users table has: ${userData.email}`)
    console.log(`   auth.users table has: ${authData.user.email}`)
    console.log('\n📋 To fix this, run:')
    console.log(`   node --env-file=.env.local scripts/update-user-email.mjs ${userData.id} dylan.oosthuysen@enprotec.com`)
  } else {
    console.log('\n✅ Emails match in both tables')
  }
}

findDylan()
