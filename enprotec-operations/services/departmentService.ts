import { supabase } from '../supabase/client';
import { Department } from '../types';

/**
 * Fetch all departments from database
 */
export const fetchDepartments = async (): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('enprotec_departments')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching departments:', error);
        throw error;
    }

    return (data as Department[]) || [];
};

/**
 * Fetch active departments only
 */
export const fetchActiveDepartments = async (): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('enprotec_departments')
        .select('*')
        .eq('status', 'Active')
        .order('name', { ascending: true});

    if (error) {
        console.error('Error fetching active departments:', error);
        throw error;
    }

    return (data as Department[]) || [];
};

/**
 * Create a new department
 */
export const createDepartment = async (
    name: string,
    code: string,
    description: string | null = null
): Promise<Department> => {
    const { data, error } = await supabase
        .from('enprotec_departments')
        .insert({ name, code, description, status: 'Active' })
        .select()
        .single();

    if (error) {
        console.error('Error creating department:', error);
        throw error;
    }

    return data as Department;
};

/**
 * Update a department
 */
export const updateDepartment = async (
    id: string,
    updates: Partial<Pick<Department, 'name' | 'code' | 'description' | 'status'>>
): Promise<Department> => {
    const { data, error } = await supabase
        .from('enprotec_departments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating department:', error);
        throw error;
    }

    return data as Department;
};

/**
 * Delete a department (with validation to prevent deleting if in use)
 */
export const deleteDepartment = async (code: string): Promise<void> => {
    // First check if department code is referenced in workflows
    // Note: workflows store department as enum code string, not UUID
    const { count: workflowCount, error: workflowError } = await supabase
        .from('enprotec_workflow_requests')
        .select('id', { count: 'exact', head: true })
        .eq('department', code);

    if (workflowError) {
        console.error('Error checking workflow references:', workflowError);
        throw new Error('Unable to verify department usage');
    }

    // Check if department code is assigned to users
    // Note: users.departments is array of department codes
    const { data: users, error: userError } = await supabase
        .from('enprotec_users')
        .select('id')
        .contains('departments', [code]);

    if (userError) {
        console.error('Error checking user references:', userError);
        throw new Error('Unable to verify department usage');
    }

    // If department is in use, prevent deletion
    if (workflowCount && workflowCount > 0) {
        throw new Error(`Cannot delete department: it is referenced by ${workflowCount} existing workflow(s)`);
    }

    if (users && users.length > 0) {
        throw new Error(`Cannot delete department: it is assigned to ${users.length} user(s)`);
    }

    // Proceed with deletion by code
    const { error: deleteError } = await supabase
        .from('enprotec_departments')
        .delete()
        .eq('code', code);

    if (deleteError) {
        console.error('Error deleting department:', deleteError);
        throw deleteError;
    }
};

/**
 * Map department code to Store enum value (for backward compatibility)
 */
export const departmentCodeToStore = (code: string): string => {
    return code; // Direct mapping since codes match enum values
};

/**
 * Get department by code
 */
export const getDepartmentByCode = async (code: string): Promise<Department | null> => {
    const { data, error } = await supabase
        .from('enprotec_departments')
        .select('*')
        .eq('code', code)
        .single();

    if (error) {
        console.error('Error fetching department by code:', error);
        return null;
    }

    return data as Department;
};
