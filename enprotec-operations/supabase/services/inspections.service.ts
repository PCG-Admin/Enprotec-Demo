import { supabase } from '../client';
import type { InspectionRow } from '../database.types';

export type InspectionInsert = Omit<InspectionRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'inspector'>;
export type InspectionUpdate = Partial<InspectionInsert>;

const INSPECTION_SELECT = '*, vehicle:vehicles(id, registration, make, model), inspector:enprotec_users(id, name, email)';

export async function getInspections(limit = 100): Promise<InspectionRow[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

export async function getInspectionsByVehicle(vehicleId: string): Promise<InspectionRow[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('vehicle_id', vehicleId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

export async function getInspection(id: string): Promise<InspectionRow | null> {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as InspectionRow | null;
}

export async function createInspection(inspection: InspectionInsert): Promise<InspectionRow> {
  const { data, error } = await supabase
    .from('inspections')
    .insert(inspection)
    .select(INSPECTION_SELECT)
    .single();
  if (error) throw error;
  return data as InspectionRow;
}

export async function updateInspection(id: string, updates: InspectionUpdate): Promise<InspectionRow> {
  const { data, error } = await supabase
    .from('inspections')
    .update(updates)
    .eq('id', id)
    .select(INSPECTION_SELECT)
    .single();
  if (error) throw error;
  return data as InspectionRow;
}

export async function deleteInspection(id: string): Promise<void> {
  const { error } = await supabase.from('inspections').delete().eq('id', id);
  if (error) throw error;
}

/** Dashboard helper: inspections in the last N days */
export async function getRecentInspections(days = 7): Promise<InspectionRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

/** Dashboard helper: inspections by a specific inspector in the last N days */
export async function getRecentInspectionsByInspector(inspectorId: string, days = 7): Promise<InspectionRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('inspector_id', inspectorId)
    .gte('started_at', since.toISOString())
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

/** All inspections by a specific inspector */
export async function getInspectionsByInspector(inspectorId: string): Promise<InspectionRow[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .eq('inspector_id', inspectorId)
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

/** Count overdue (in_progress past 24h) inspections */
export async function getOverdueCount(): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const { count, error } = await supabase
    .from('inspections')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'in_progress')
    .lt('started_at', yesterday.toISOString());
  if (error) throw error;
  return count ?? 0;
}
