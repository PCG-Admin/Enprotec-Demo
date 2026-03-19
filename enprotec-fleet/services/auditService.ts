import { supabase } from '../supabase/client';

export interface AuditLogEntry {
    id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: any;
    created_at: string;
    user?: { name: string };
}

export const auditService = {
    async getLogs(limit = 50) {
        const { data, error } = await supabase
            .from('en_audit_logs')
            .select('*, user:enprotec_users(name)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as AuditLogEntry[];
    },

    async logAction(userId: string, action: string, entityType: string, entityId: string | null, details: any) {
        const { error } = await supabase.from('en_audit_logs').insert({
            user_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            details
        });

        if (error) console.error('Failed to write audit log:', error);
    }
};
