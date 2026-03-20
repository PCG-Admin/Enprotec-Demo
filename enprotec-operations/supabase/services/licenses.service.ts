import { supabase } from '../client';
import type { LicenseRow } from '../database.types';

export type LicenseInsert = Omit<LicenseRow, 'id' | 'created_at' | 'updated_at'>;
export type LicenseUpdate = Partial<LicenseInsert>;

/** Derive status from expiry date */
export function computeLicenseStatus(expiryDate: string): 'active' | 'expiring' | 'expired' {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days <= 0)  return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

/** Granular urgency: expired / critical (≤7d) / warning (≤14d) / soon (≤30d) / active */
export function licenseUrgency(expiryDate: string): 'expired' | 'critical' | 'warning' | 'soon' | 'active' {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days <= 0)  return 'expired';
  if (days <= 7)  return 'critical';
  if (days <= 14) return 'warning';
  if (days <= 30) return 'soon';
  return 'active';
}

export async function getLicenses(): Promise<LicenseRow[]> {
  const { data, error } = await supabase
    .from('enprotec_licenses')
    .select('*')
    .order('expiry_date');
  if (error) throw error;
  return data ?? [];
}

export async function getLicensesByVehicle(vehicleId: string): Promise<LicenseRow[]> {
  const { data, error } = await supabase
    .from('enprotec_licenses')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('expiry_date');
  if (error) throw error;
  return data ?? [];
}

export async function getExpiringLicenses(withinDays = 30): Promise<LicenseRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  const { data, error } = await supabase
    .from('enprotec_licenses')
    .select('*')
    .lte('expiry_date', cutoff.toISOString().slice(0, 10))
    .gte('expiry_date', new Date().toISOString().slice(0, 10))
    .order('expiry_date');
  if (error) throw error;
  return data ?? [];
}

export async function createLicense(license: LicenseInsert): Promise<LicenseRow> {
  const { data, error } = await supabase
    .from('enprotec_licenses')
    .insert(license)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLicense(id: string, updates: LicenseUpdate): Promise<LicenseRow> {
  const { data, error } = await supabase
    .from('enprotec_licenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLicense(id: string): Promise<void> {
  const { error } = await supabase.from('enprotec_licenses').delete().eq('id', id);
  if (error) throw error;
}

/** Upload a license document and return its URL */
export async function uploadLicenseDoc(file: File, licenseId: string): Promise<string> {
  const ext  = file.name.split('.').pop();
  const path = `${licenseId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('license-docs').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('license-docs').getPublicUrl(path);
  return data.publicUrl;
}
