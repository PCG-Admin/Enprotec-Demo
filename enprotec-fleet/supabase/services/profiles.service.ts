import { supabase } from '../client';
import type { ProfileRow, UserStatus } from '../database.types';

export type ProfileUpdate = Partial<Pick<ProfileRow, 'name' | 'role' | 'status' | 'fleet_role'>>;

const SELECT = 'id, name, email, role, status, fleet_role, sites, departments';

export async function getProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('enprotec_users')
    .select(SELECT)
    .order('name');
  if (error) throw error;
  const rows = (data ?? []).map(r => ({ ...r, fleet_role: r.fleet_role ?? null }));
  // Deduplicate by normalised name (trim + lowercase) — catches "John " vs "john" etc.
  const seen = new Set<string>();
  return rows.filter(r => {
    const key = (r.name ?? '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getProfile(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('enprotec_users')
    .select(SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data ? { ...data, fleet_role: data.fleet_role ?? null } : null;
}

export async function updateProfile(id: string, updates: ProfileUpdate): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('enprotec_users')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return { ...data, fleet_role: data.fleet_role ?? null };
}

export async function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const { error } = await supabase.from('enprotec_users').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function setFleetRole(id: string, fleet_role: string | null): Promise<void> {
  const { error } = await supabase.from('enprotec_users').update({ fleet_role }).eq('id', id);
  if (error) throw error;
}
