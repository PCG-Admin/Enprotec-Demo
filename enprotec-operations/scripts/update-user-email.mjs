import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateUserEmail(userId, newEmail) {
  console.log(`\n🔄 Updating user email...`)
  console.log(`   User ID: ${userId}`)
  console.log(`   New Email: ${newEmail}`)

  // Update email in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
    userId,
    {
      email: newEmail,
      email_confirm: true // Auto-confirm the new email
    }
  )

  if (authError) {
    console.error('❌ Failed to update auth user:', authError.message)
    return false
  }

  console.log('✅ Auth user email updated')

  // Update email in en_users table
  const { data: profileData, error: profileError } = await supabase
    .from('en_users')
    .update({ email: newEmail })
    .eq('id', userId)
    .select()
    .single()

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError.message)
    return false
  }

  console.log('✅ Profile email updated')
  console.log('\n✨ User email successfully updated!')
  console.log(`   User can now login with: ${newEmail}`)

  return true
}

// Get command line arguments
const userId = process.argv[2]
const newEmail = process.argv[3]

if (!userId || !newEmail) {
  console.error('❌ Usage: node scripts/update-user-email.mjs <user-id> <new-email>')
  console.error('   Example: node scripts/update-user-email.mjs abc-123-def john.doe@enprotec.com')
  process.exit(1)
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(newEmail)) {
  console.error('❌ Invalid email format')
  process.exit(1)
}

updateUserEmail(userId, newEmail)
  .then(success => {
    if (!success) {
      process.exit(1)
    }
  })
  .catch(err => {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  })
