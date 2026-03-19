import { supabase } from '../supabase/client';
import { WorkflowStatus, UserRole, getRolesMappingTo } from '../types';

/**
 * Get the roles that can act on a specific workflow status
 */
export function getRolesForStatus(status: WorkflowStatus): UserRole[] {
    const baseRoles = (() => {
        switch (status) {
            case WorkflowStatus.REQUEST_SUBMITTED:
                return [UserRole.OperationsManager];
            case WorkflowStatus.AWAITING_OPS_MANAGER:
                return [UserRole.StockController];
            case WorkflowStatus.AWAITING_EQUIP_MANAGER:
                return [UserRole.EquipmentManager];
            case WorkflowStatus.AWAITING_PICKING:
                return [UserRole.StockController, UserRole.Storeman];
            case WorkflowStatus.PICKED_AND_LOADED:
                return [UserRole.Security, UserRole.Driver];
            case WorkflowStatus.DISPATCHED:
                // Special case: only requester can act
                return [];
            default:
                return [];
        }
    })();
    return baseRoles.flatMap(getRolesMappingTo);
}

/**
 * Fetch users who can act on a workflow based on status and site
 */
export async function getActorsForWorkflow(
    status: WorkflowStatus,
    siteName: string,
    requesterId?: string
): Promise<{ fullName: string; role: string }[]> {
    // Special case: EPOD step - only requester
    if (status === WorkflowStatus.DISPATCHED && requesterId) {
        const { data, error } = await supabase
            .from('enprotec_users')
            .select('name, role')
            .eq('id', requesterId)
            .single();

        if (error || !data) {
            console.error('Error fetching requester:', error);
            return [];
        }

        return [{ fullName: data.name, role: 'Original Requester' }];
    }

    const roles = getRolesForStatus(status);
    if (roles.length === 0) return [];

    try {
        console.log('Querying users with roles:', roles, 'for site:', siteName);

        // Query all users with the required roles
        const { data, error } = await supabase
            .from('enprotec_users')
            .select('name, role, sites')
            .in('role', roles)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching actors:', error);
            return [];
        }

        console.log('Query returned users:', data);

        // Filter in JavaScript to check if site is in user's sites array
        const filteredUsers = (data || []).filter(user =>
            user.sites && Array.isArray(user.sites) &&
            user.sites.some(s => s.toLowerCase() === siteName.toLowerCase())
        );

        console.log('Filtered users for site:', filteredUsers);

        return filteredUsers.map(user => ({
            fullName: user.name,
            role: user.role
        }));
    } catch (err) {
        console.error('Error in getActorsForWorkflow:', err);
        return [];
    }
}

/**
 * Get a human-readable description of who can act on this status
 */
export function getActorDescription(status: WorkflowStatus): string {
    switch (status) {
        case WorkflowStatus.REQUEST_SUBMITTED:
            return 'Operations Manager';
        case WorkflowStatus.AWAITING_OPS_MANAGER:
            return 'Stock Controller';
        case WorkflowStatus.AWAITING_EQUIP_MANAGER:
            return 'Equipment Manager';
        case WorkflowStatus.AWAITING_PICKING:
            return 'Stock Controller or Storeman';
        case WorkflowStatus.PICKED_AND_LOADED:
            return 'Security or Driver';
        case WorkflowStatus.DISPATCHED:
            return 'Original Requester';
        default:
            return 'N/A';
    }
}
