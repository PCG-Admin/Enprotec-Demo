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

async function checkBothDylans() {
  const dylanIds = [
    { id: '199e6528-5d63-4eb3-aeed-2fa89dd585cd', name: 'Dylan Oosthuysen', expectedEmail: 'dylan.oosthuysen@enprotec.com' },
    { id: '01435844-5d74-4d98-bc40-81e42819ff67', name: 'Dylan Oosthuyzen', expectedEmail: 'dylan.oosthuyzen@enprotec.co.za' }
  ]

  console.log('\n🔍 Checking both Dylan users...\n')

  for (const dylan of dylanIds) {
    console.log(`\n━━━ ${dylan.name} ━━━`)
    console.log(`ID: ${dylan.id}`)
    console.log(`Expected Email: ${dylan.expectedEmail}`)

    // Check en_users table
    const { data: userData } = await supabase
      .from('en_users')
      .select('email')
      .eq('id', dylan.id)
      .single()

    console.log(`en_users email: ${userData?.email || 'NOT FOUND'}`)

    // Check auth.users table
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(dylan.id)

    if (authError) {
      console.log(`auth.users email: ❌ ERROR - ${authError.message}`)
    } else {
      console.log(`auth.users email: ${authData.user.email}`)

      if (userData?.email !== authData.user.email) {
        console.log('\n⚠️  MISMATCH DETECTED!')
        console.log(`\n📋 To fix, run:`)
        console.log(`node --env-file=.env.local scripts/update-user-email.mjs ${dylan.id} ${dylan.expectedEmail}`)
      } else {
        console.log('✅ Emails match')
      }
    }
  }
}

checkBothDylans()
