import { supabase } from '../client';
import type { TemplateRow, DbQuestion } from '../database.types';

export type TemplateInsert = Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>;
export type TemplateUpdate = Partial<TemplateInsert>;

export async function getTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('enprotec_inspection_templates')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const { data, error } = await supabase
    .from('enprotec_inspection_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from('enprotec_inspection_templates')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createTemplate(template: TemplateInsert): Promise<TemplateRow> {
  const { data, error } = await supabase
    .from('enprotec_inspection_templates')
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, updates: TemplateUpdate): Promise<TemplateRow> {
  const { data, error } = await supabase
    .from('enprotec_inspection_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplateQuestions(id: string, questions: DbQuestion[]): Promise<void> {
  const { error } = await supabase
    .from('enprotec_inspection_templates')
    .update({ questions, last_used: new Date().toISOString().slice(0, 10) })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('inspection_templates').delete().eq('id', id);
  if (error) throw error;
}
