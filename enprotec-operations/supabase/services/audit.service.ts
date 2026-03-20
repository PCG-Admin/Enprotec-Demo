import { supabase } from '../client';
import type { AuditRow } from '../database.types';

export type AuditInsert = Omit<AuditRow, 'id' | 'created_at'>;

export async function getAuditLog(limit = 100): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from('enprotec_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getAuditByModule(module: string, limit = 50): Promise<AuditRow[]> {
  const { data, error } = await supabase
    .from('enprotec_audit_log')
    .select('*')
    .eq('module', module)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function writeAuditEntry(entry: AuditInsert): Promise<void> {
  const { error } = await supabase.from('enprotec_audit_log').insert(entry);
  if (error) console.error('Audit log write failed:', error.message);
}

/** Convenience: log a user action */
export async function logAction(
  userId: string,
  userName: string,
  action: string,
  module: string,
  details: string,
): Promise<void> {
  return writeAuditEntry({ user_id: userId, user_name: userName, action, module, details });
}
