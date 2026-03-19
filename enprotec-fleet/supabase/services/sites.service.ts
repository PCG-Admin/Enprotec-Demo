import { supabase } from '../client';
import type { SiteRow, SiteStatus } from '../database.types';

export type SiteInsert = { name: string; status?: SiteStatus };
export type SiteUpdate = Partial<SiteInsert>;

export async function getSites(): Promise<SiteRow[]> {
  const { data, error } = await supabase
    .from('enprotec_sites')
    .select('id, name, status')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getSite(id: string): Promise<SiteRow | null> {
  const { data, error } = await supabase
    .from('enprotec_sites')
    .select('id, name, status')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createSite(site: SiteInsert): Promise<SiteRow> {
  const { data, error } = await supabase
    .from('enprotec_sites')
    .insert({ ...site, status: site.status ?? 'Active' })
    .select('id, name, status')
    .single();
  if (error) throw error;
  return data;
}

export async function updateSite(id: string, updates: SiteUpdate): Promise<SiteRow> {
  const { data, error } = await supabase
    .from('enprotec_sites')
    .update(updates)
    .eq('id', id)
    .select('id, name, status')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSite(id: string): Promise<void> {
  const { error } = await supabase.from('enprotec_sites').delete().eq('id', id);
  if (error) throw error;
}
