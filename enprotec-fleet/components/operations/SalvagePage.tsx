import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { getMappedRole, SalvageRequest, User, WorkflowStatus, UserRole, Store } from '../../types';
import Card from './Card';
import { sendApprovalWebhook } from '../../services/webhookService';

interface SalvagePageProps {
    user: User;
}

const getStatusBadge = (status: WorkflowStatus) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full inline-block border";
    switch(status) {
        case WorkflowStatus.SALVAGE_AWAITING_DECISION: return <span className={`${baseClasses} bg-amber-100 text-amber-800 border-amber-200`}>Awaiting Decision</span>
        case WorkflowStatus.SALVAGE_TO_BE_REPAIRED: return <span className={`${baseClasses} bg-sky-100 text-sky-800 border-sky-200`}>To Be Repaired</span>
        case WorkflowStatus.SALVAGE_REPAIR_CONFIRMED: return <span className={`${baseClasses} bg-sky-100 text-sky-800 border-sky-200`}>Repair Confirmed</span>
        case WorkflowStatus.SALVAGE_TO_BE_SCRAPPED: return <span className={`${baseClasses} bg-red-100 text-red-800 border-red-200`}>To Be Scrapped</span>
        case WorkflowStatus.SALVAGE_SCRAP_CONFIRMED: return <span className={`${baseClasses} bg-red-100 text-red-800 border-red-200`}>Scrap Confirmed</span>
        case WorkflowStatus.SALVAGE_COMPLETE: return <span className={`${baseClasses} bg-emerald-100 text-emerald-800 border-emerald-200`}>Complete</span>
        default: return <span className={`${baseClasses} bg-zinc-100 text-zinc-800 border-zinc-200`}>{status}</span>;
    }
};

const SalvagePage: React.FC<SalvagePageProps> = ({ user }) => {
    const [requests, setRequests] = useState<SalvageRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    
    const isManager = getMappedRole(user.role) === UserRole.Admin || getMappedRole(user.role) === UserRole.OperationsManager || getMappedRole(user.role) === UserRole.EquipmentManager;

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('enprotec_salvage_requests_view')
                .select('*')
                .not('status', 'eq', WorkflowStatus.SALVAGE_COMPLETE)
                .order('createdAt', { ascending: true });

            if (error) throw error;

            const rawRequests = (data as any[]) ?? [];

            const normalized = rawRequests.map(item => {
                const sourceStore: Store | undefined = (item.sourceStore ??
                    item.source_department) as Store | undefined;

                return {
                    id: item.id,
                    stock_item_id: item.stock_item_id,
                    partNumber: item.partNumber ?? item.part_number ?? '',
                    description: item.description ?? '',
                    quantity: item.quantity ?? 0,
                    status: item.status as WorkflowStatus,
                    notes: item.notes ?? null,
                    sourceStore,
                    createdBy: item.createdBy ?? item.created_by ?? '',
                    createdAt: item.createdAt ?? item.created_at ?? '',
                    decisionBy: item.decisionBy ?? item.decision_by ?? null,
                    decisionAt: item.decisionAt ?? item.decision_at ?? null,
                    photoUrl: item.photoUrl ?? item.photo_url ?? null,
                } satisfies SalvageRequest;
            });

            const filtered = (() => {
                if (getMappedRole(user.role) === UserRole.Admin || !user.departments || user.departments.length === 0) {
                    return normalized;
                }
                const allowedStores = user.departments.filter(store =>
                    ['OEM', 'Operations', 'Projects', 'SalvageYard'].includes(store)
                );
                if (allowedStores.length === 0) {
                    return normalized;
                }
                return normalized.filter(req => !req.sourceStore || allowedStores.includes(req.sourceStore));
            })();

            setRequests(filtered);
        } catch(err) {
            setError("Failed to fetch salvage requests.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);
    
    const handleUpdate = async (id: string, newStatus: WorkflowStatus) => {
        setUpdatingId(id);
        const requestToUpdate = requests.find(r => r.id === id);
        if (!requestToUpdate) {
            console.error("Could not find salvage request to update.");
            setUpdatingId(null);
            return;
        }

        try {
            // Further actions would be needed here in a real app, e.g., creating a repair job card
            // or adjusting stock levels after scrapping. This implementation focuses on status changes.
            
            const { error } = await supabase.from('enprotec_salvage_requests').update({ 
                status: newStatus,
                decision_by_id: user.id,
                decision_at: new Date().toISOString()
            }).eq('id', id);

            if (error) throw error;
            
            await sendApprovalWebhook('SALVAGE_DECISION', requestToUpdate, newStatus, user);
            
            fetchRequests(); // Refresh data
        } catch(err) {
            alert('Failed to update status.');
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Salvage Store Management</h1>
                <p className="text-zinc-500 mt-1">{requests.length} items currently in the salvage process.</p>
            </div>
            
             {loading && <p className="text-zinc-500">Loading salvage requests...</p>}
             {error && <p className="text-red-600">{error}</p>}
            
            {!loading && !error && requests.length === 0 && (
                 <div className="text-center p-12 bg-white rounded-lg border border-zinc-200">
                    <h2 className="text-xl font-semibold text-zinc-900">Salvage Store is Empty</h2>
                    <p className="mt-2 text-zinc-500">There are no items currently awaiting a salvage decision.</p>
                </div>
            )}
            
            <div className="space-y-4">
                {requests.map(req => (
                     <Card key={req.id} title={`${req.quantity} x ${req.partNumber}`} padding="p-0">
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-zinc-200">
                             <div><div className="text-zinc-500 text-xs">Description</div><div className="text-zinc-900 font-medium">{req.description}</div></div>
                             <div><div className="text-zinc-500 text-xs">Booked By</div><div className="text-zinc-900 font-medium">{req.createdBy}</div></div>
                             <div><div className="text-zinc-500 text-xs">Booked At</div><div className="text-zinc-900 font-medium">{new Date(req.createdAt).toLocaleDateString()}</div></div>
                             <div><div className="text-zinc-500 text-xs">Status</div><div>{getStatusBadge(req.status)}</div></div>
                        </div>
                        
                        <div className="p-4 text-sm text-zinc-700 border-b border-zinc-200">
                           <strong>Notes:</strong> {req.notes || "No notes provided."}
                        </div>

                        {req.photoUrl && (
                            <div className="p-4 border-b border-zinc-200 bg-white">
                                <div className="text-sm font-semibold text-zinc-800 mb-2">Photo</div>
                                <a
                                    href={req.photoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block"
                                >
                                    <img
                                        src={req.photoUrl}
                                        alt="Salvage"
                                        className="max-h-40 rounded-md border border-zinc-200 object-contain"
                                    />
                                </a>
                            </div>
                        )}

                        <div className="p-4 bg-zinc-50/50 flex justify-end items-center gap-3">
                            {req.status === WorkflowStatus.SALVAGE_AWAITING_DECISION && isManager && (
                                <>
                                    <button onClick={() => handleUpdate(req.id, WorkflowStatus.SALVAGE_TO_BE_SCRAPPED)} disabled={updatingId === req.id} className="px-3 py-1.5 text-sm bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">Mark for Scrap</button>
                                    <button onClick={() => handleUpdate(req.id, WorkflowStatus.SALVAGE_TO_BE_REPAIRED)} disabled={updatingId === req.id} className="px-3 py-1.5 text-sm bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600">Mark for Repair</button>
                                </>
                            )}
                             {req.status === WorkflowStatus.SALVAGE_TO_BE_REPAIRED && isManager && (
                                <button onClick={() => handleUpdate(req.id, WorkflowStatus.SALVAGE_REPAIR_CONFIRMED)} disabled={updatingId === req.id} className="px-3 py-1.5 text-sm bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600">Confirm Repair</button>
                            )}
                            {req.status === WorkflowStatus.SALVAGE_TO_BE_SCRAPPED && isManager && (
                                <button onClick={() => handleUpdate(req.id, WorkflowStatus.SALVAGE_SCRAP_CONFIRMED)} disabled={updatingId === req.id} className="px-3 py-1.5 text-sm bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">Confirm Scrapped</button>
                            )}
                            {(req.status === WorkflowStatus.SALVAGE_REPAIR_CONFIRMED || req.status === WorkflowStatus.SALVAGE_SCRAP_CONFIRMED) && (getMappedRole(user.role) === UserRole.StockController || isManager) && (
                                 <button onClick={() => handleUpdate(req.id, WorkflowStatus.SALVAGE_COMPLETE)} disabled={updatingId === req.id} className="px-3 py-1.5 text-sm bg-emerald-500 text-white font-semibold rounded-md hover:bg-emerald-600">Close Out</button>
                            )}
                        </div>
                     </Card>
                ))}
            </div>
        </div>
    );
};

export default SalvagePage;
