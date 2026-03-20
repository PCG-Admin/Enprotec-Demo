import { supabase } from '../client';
import type { CostRow, CostCat } from '../database.types';

export type CostInsert = Omit<CostRow, 'id' | 'created_at' | 'updated_at' | 'vehicle'>;
export type CostUpdate = Partial<CostInsert>;

const COST_SELECT = '*, vehicle:enprotec_vehicles(id, registration, make, model)';

export async function getCosts(limit = 200): Promise<CostRow[]> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .select(COST_SELECT)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CostRow[];
}

export async function getCostsByVehicle(vehicleId: string): Promise<CostRow[]> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .select(COST_SELECT)
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostRow[];
}

export async function getCostsByDateRange(from: string, to: string): Promise<CostRow[]> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .select(COST_SELECT)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostRow[];
}

export async function getCostsByCategory(category: CostCat): Promise<CostRow[]> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .select(COST_SELECT)
    .eq('category', category)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostRow[];
}

export async function createCost(cost: CostInsert): Promise<CostRow> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .insert(cost)
    .select(COST_SELECT)
    .single();
  if (error) throw error;
  return data as CostRow;
}

export async function updateCost(id: string, updates: CostUpdate): Promise<CostRow> {
  const { data, error } = await supabase
    .from('enprotec_costs')
    .update(updates)
    .eq('id', id)
    .select(COST_SELECT)
    .single();
  if (error) throw error;
  return data as CostRow;
}

export async function deleteCost(id: string): Promise<void> {
  const { error } = await supabase.from('enprotec_costs').delete().eq('id', id);
  if (error) throw error;
}

/** Monthly totals helper for charts (last N months) */
export async function getMonthlyCostTotals(months = 6): Promise<{ month: string; total: number; fuel: number; maintenance: number; other: number }[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const costs = await getCostsByDateRange(from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));

  const buckets: Record<string, { fuel: number; maintenance: number; other: number }> = {};
  costs.forEach(c => {
    const key = c.date.slice(0, 7); // YYYY-MM
    if (!buckets[key]) buckets[key] = { fuel: 0, maintenance: 0, other: 0 };
    if (c.category === 'Fuel') buckets[key].fuel += c.amount;
    else if (c.category === 'Maintenance') buckets[key].maintenance += c.amount;
    else buckets[key].other += c.amount;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: new Date(month + '-01').toLocaleString('en-ZA', { month: 'short' }),
      total: v.fuel + v.maintenance + v.other,
      ...v,
    }));
}

/** Upload a cost receipt */
export async function uploadReceipt(file: File, costId: string): Promise<string> {
  const ext  = file.name.split('.').pop();
  const path = `${costId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('cost-receipts').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('cost-receipts').getPublicUrl(path);
  return data.publicUrl;
}
