import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const UserStatus = {
  Active: 'Active',
  Inactive: 'Inactive',
} as const

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

interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

const REQUIRED_FIELDS: Array<keyof CreateUserPayload> = [
  'name',
  'email',
  'password',
  'role',
]

const PASSWORD_PLACEHOLDER = 'Supabase-Auth-Managed'

export const handleCreateUser = async (
  payload: CreateUserPayload | undefined
): Promise<HandlerResult> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return {
      status: 500,
      body: { error: 'Supabase configuration missing on server' },
    }
  }

  if (!payload) {
    return { status: 400, body: { error: 'Missing request body' } }
  }

  const missingField = REQUIRED_FIELDS.find((field) => {
    const value = payload[field]
    return value === undefined || value === null || value === ''
  })

  if (missingField) {
    return { status: 400, body: { error: `Missing required field: ${missingField}` } }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const authResponse = await supabaseAdmin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      name: payload.name,
      role: payload.role,
      sites: payload.sites,
      departments: payload.departments,
      status: payload.status ?? UserStatus.Active,
    },
  })

  if (authResponse.error || !authResponse.data?.user) {
    return {
      status: authResponse.error?.status ?? 500,
      body: { error: authResponse.error?.message ?? 'Failed to create auth user' },
    }
  }

  const authUser = authResponse.data.user

  const profileResponse = await supabaseAdmin
    .from('enprotec_users')
    .upsert({
      id: authUser.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      sites: payload.sites,
      departments: payload.departments,
      password: PASSWORD_PLACEHOLDER,
      status: payload.status ?? UserStatus.Active,
    }, { onConflict: 'id' })
    .select('*')
    .single()

  if (profileResponse.error || !profileResponse.data) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id)
    return {
      status: 500,
      body: { error: profileResponse.error?.message ?? 'Failed to create user profile' },
    }
  }

  return {
    status: 200,
    body: profileResponse.data as Record<string, unknown>,
  }
}

const vercelHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(200).send('OK')
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { status, body } = await handleCreateUser(req.body as CreateUserPayload)
  res.status(status).json(body)
}

export default vercelHandler

