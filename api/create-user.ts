import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const UserStatus = { Active: 'Active', Inactive: 'Inactive' } as const
type UserStatusValue = (typeof UserStatus)[keyof typeof UserStatus]

type CreateUserPayload = {
  name: string
  email: string
  password: string
  role: string
  sites: string[]
  departments: string[]
  status?: UserStatusValue
}

const PASSWORD_PLACEHOLDER = 'Supabase-Auth-Managed'

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(200).send('OK')
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    const missing = [!serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY', !supabaseUrl && 'SUPABASE_URL'].filter(Boolean).join(', ')
    console.error('[create-user] Missing env vars:', missing)
    return res.status(500).json({ error: `Server misconfiguration: missing ${missing}` })
  }

  const payload = req.body as CreateUserPayload
  if (!payload?.email || !payload?.password || !payload?.name || !payload?.role) {
    return res.status(400).json({ error: 'Missing required fields: name, email, password, role' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { name: payload.name, role: payload.role },
  })

  if (authError || !authData?.user) {
    console.error('[create-user] auth error:', authError)
    return res.status(authError?.status ?? 500).json({ error: authError?.message ?? 'Failed to create auth user' })
  }

  const { data: profile, error: profileError } = await admin
    .from('en_users')
    .upsert({
      id: authData.user.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      sites: payload.sites ?? [],
      departments: payload.departments ?? [],
      password: PASSWORD_PLACEHOLDER,
      status: payload.status ?? UserStatus.Active,
    }, { onConflict: 'id' })
    .select('*')
    .single()

  if (profileError) {
    console.error('[create-user] en_users upsert failed:', profileError)
    await admin.auth.admin.deleteUser(authData.user.id)
    return res.status(500).json({ error: profileError.message })
  }

  return res.status(200).json(profile)
}

export default handler
