import { supabase } from '../supabase/client'
import { User, UserRole, UserStatus, Store } from '../types'

export type RawUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  sites: string[] | null
  departments: string[] | null
  fleet_role: string | null
}

const isUserRole = (value: string): value is UserRole => {
  return Object.values(UserRole).includes(value as UserRole)
}

const isUserStatus = (value: string): value is UserStatus => {
  return Object.values(UserStatus).includes(value as UserStatus)
}

export const sanitizeStores = (departments: string[] | null): Store[] | null => {
  if (!departments) return null
  // IMPORTANT: No longer filter against hardcoded Store enum
  // We now support dynamic departments from enprotec_departments table
  // Just ensure it's a valid array and return as-is
  const filtered = departments.filter((dept): dept is Store =>
    typeof dept === 'string' && dept.trim().length > 0
  )
  return filtered.length > 0 ? filtered : null
}

export const mapRawUserToUser = (raw: RawUser): User | null => {
  if (!isUserRole(raw.role)) {
    console.warn(`Unknown user role received: ${raw.role}`)
    return null
  }

  if (!isUserStatus(raw.status)) {
    console.warn(`Unknown user status received: ${raw.status}`)
    return null
  }

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    status: raw.status,
    sites: raw.sites ?? null,
    departments: sanitizeStores(raw.departments),
    fleet_role: raw.fleet_role ?? null,
  }
}

interface FetchOptions {
  requireActive?: boolean
}

export const fetchUserProfile = async (
  userId: string,
  options: FetchOptions = { requireActive: true }
): Promise<User | null> => {
  console.info('[Supabase] fetchUserProfile', { userId })
  const { data, error } = await supabase
    .from('enprotec_users')
    .select('id, name, email, role, status, sites, departments, fleet_role')
    .eq('id', userId)
    .maybeSingle<RawUser>()

  if (error) {
    console.error('[Supabase] fetchUserProfile error', error)
    return null
  }

  if (!data) {
    console.warn(`No profile found for user ${userId}`)
    return null
  }

  const mapped = mapRawUserToUser(data)
  if (!mapped) return null

  if (options.requireActive !== false && mapped.status !== UserStatus.Active) {
    return null
  }

  return mapped
}

export const fetchUserProfileByEmail = async (
  email: string
): Promise<User | null> => {
  console.info('[Supabase] fetchUserProfileByEmail', { email })
  const { data, error } = await supabase
    .from('enprotec_users')
    .select('id, name, email, role, status, sites, departments, fleet_role')
    .eq('email', email)
    .maybeSingle<RawUser>()

  if (error) {
    console.error('[Supabase] fetchUserProfileByEmail error', error)
    return null
  }

  if (!data) {
    return null
  }

  return mapRawUserToUser(data)
}

