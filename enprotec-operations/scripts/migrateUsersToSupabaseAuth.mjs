import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const { config } = await import('dotenv')
    const envFiles = ['.env.local', '.env']
    for (const file of envFiles) {
      config({ path: file, override: false })
    }
  } catch (error) {
    console.warn('dotenv not installed; attempting to continue with existing environment variables.')
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const defaultPassword = process.env.MIGRATION_DEFAULT_PASSWORD ?? 'password123'

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_URL environment variable')
  process.exit(1)
}

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: { schema: 'public' },
})

async function fetchEnUsers() {
  const { data, error } = await supabase
    .from('en_users')
    .select(
      'id, email, name, role, status, sites, departments'
    )

  if (error) {
    throw new Error(`Failed to fetch en_users: ${error.message}`)
  }

  return data ?? []
}

async function createAuthUserFromProfile(profile) {
  const payload = {
    id: profile.id,
    email: profile.email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      name: profile.name,
      role: profile.role,
      status: profile.status,
      sites: profile.sites,
      departments: profile.departments,
    },
  }

  const { data, error } = await supabase.auth.admin.createUser(payload)

  if (error) {
    if (error.status === 422 || error.status === 409) {
      console.warn(
        `Auth user already exists for email ${profile.email}; skipping creation.`
      )
      return 'skipped'
    }
    throw new Error(
      `Failed to create auth user for ${profile.email}: ${error.message}`
    )
  }

  return data?.user?.id ? 'created' : 'skipped'
}

async function run() {
  console.log('Starting Supabase Auth migration...')
  console.log(`Using Supabase project: ${supabaseUrl}`)

  const profiles = await fetchEnUsers()
  console.log(`Found ${profiles.length} profiles to process`)

  let createdCount = 0
  let skippedCount = 0

  for (const profile of profiles) {
    try {
      const result = await createAuthUserFromProfile(profile)
      if (result === 'skipped') {
        skippedCount += 1
        console.log(`- Skipped auth user for ${profile.email}`)
      } else {
        createdCount += 1
        console.log(`+ Created auth user for ${profile.email}`)
      }
    } catch (error) {
      console.error(`! Error processing ${profile.email}:`, error.message)
    }
  }

  console.log('Migration summary:')
  console.log(`  Created: ${createdCount}`)
  console.log(`  Skipped: ${skippedCount}`)
  console.log('Done.')
}

run().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})

