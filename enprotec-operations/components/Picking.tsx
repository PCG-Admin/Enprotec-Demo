import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase/client';
import { getMappedRole, WorkflowRequest, User, WorkflowStatus, WorkflowItem, UserRole } from '../types';
import Card from './Card';
import CommentSection from './CommentSection';
import { sendApprovalWebhook } from '../services/webhookService';

interface PickingProps {
    user: User;
}

const Picking: React.FC<PickingProps> = ({ user }) => {
    const queryClient = useQueryClient();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);

    const { data: requests = [], isLoading: loading, isError } = useQuery({
        queryKey: ['workflows', 'picking', user.id],
        queryFn: async () => {
            let query = supabase
                .from('enprotec_workflows_view')
                .select('*')
                .eq('currentStatus', WorkflowStatus.AWAITING_PICKING);
            if (getMappedRole(user.role) !== UserRole.Admin && user.departments && user.departments.length > 0) {
                query = query.in('department', user.departments);
            }
            if (getMappedRole(user.role) !== UserRole.Admin && user.sites && user.sites.length > 0) {
                query = query.in('projectCode', user.sites);
            }
            const { data, error } = await query.order('createdAt', { ascending: true });
            if (error) throw error;
            return (data as unknown as WorkflowRequest[]) || [];
        },
        staleTime: 30_000,
    });
    const error = isError ? 'Unable to load picking requests. Please try again.' : null;
    
    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            (req.requestNumber && req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.requester && req.requester.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.projectCode && req.projectCode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [requests, searchTerm]);

    const handleAction = async (requestId: string, newStatus: WorkflowStatus) => {
        setUpdatingId(requestId);
        const requestToUpdate = requests.find(r => r.id === requestId);
        if (!requestToUpdate) {
            console.error("Could not find request to update.");
            setUpdatingId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('enprotec_workflow_requests')
                .update({ current_status: newStatus })
                .eq('id', requestId);
            
            if (error) throw error;
            
            await sendApprovalWebhook('APPROVAL', requestToUpdate, newStatus, user);

            queryClient.invalidateQueries({ queryKey: ['workflows'] });
        } catch (err) {
            alert('Unable to update request status. Please try again.');
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };
    
    const toggleComments = (requestId: string) => {
        setExpandedCommentId(currentId => currentId === requestId ? null : requestId);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Picking Requests</h1>
                    <p className="text-zinc-500 mt-1">{filteredRequests.length} requests ready for picking.</p>
                </div>
                 <div className="w-full md:w-64 relative">
                    <input 
                        type="text" 
                        placeholder="Search picking list..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                    />
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
            
            {loading && <p className="text-zinc-500">Loading picking list...</p>}
            {error && <p className="text-red-600">{error}</p>}
            
            {!loading && !error && filteredRequests.length === 0 && (
                 <div className="text-center p-12 bg-white rounded-lg border border-zinc-200">
                    <h2 className="text-xl font-semibold text-zinc-900">{searchTerm ? 'No Results Found' : 'Picking List is Clear!'}</h2>
                    <p className="mt-2 text-zinc-500">{searchTerm ? 'Your search did not match any requests.' : 'There are no approved requests waiting to be picked.'}</p>
                </div>
            )}
            
            <div className="space-y-4">
                {filteredRequests.map(req => (
                    <Card key={req.id} title={req.requestNumber} padding="p-0">
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-zinc-200">
                            <div><div className="text-zinc-500 text-xs">Requester</div><div className="text-zinc-900 font-medium">{req.requester}</div></div>
                            <div><div className="text-zinc-500 text-xs">Project/Site</div><div className="text-zinc-900 font-medium">{req.projectCode}</div></div>
                            <div><div className="text-zinc-500 text-xs">Store</div><div className="text-zinc-900 font-medium">{req.department}</div></div>
                            <div><div className="text-zinc-500 text-xs">Priority</div><div className="text-zinc-900 font-medium">{req.priority}</div></div>
                        </div>

                         <div className="overflow-x-auto">
                            <table className="min-w-full bg-white text-sm">
                                <thead className="bg-zinc-50">
                                     <tr>
                                        <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Part #</th>
                                        <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Description</th>
                                        <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty to Pick</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200">
                                    {req.items.map((item: WorkflowItem) => (
                                        <tr key={item.partNumber}>
                                            <td className="py-2 px-4 whitespace-nowrap font-mono text-zinc-800">{item.partNumber}</td>
                                            <td className="py-2 px-4 whitespace-nowrap text-zinc-700">{item.description}</td>
                                            <td className="py-2 px-4 whitespace-nowrap text-center font-semibold text-zinc-900">{item.quantityRequested}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {expandedCommentId === req.id && (
                            <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                                <CommentSection workflowId={req.id} user={user} />
                            </div>
                        )}

                        <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 flex justify-end items-center gap-3">
                            <button onClick={() => toggleComments(req.id)} className="mr-auto text-sm text-zinc-500 hover:text-sky-600 transition-colors font-medium">
                                {expandedCommentId === req.id ? 'Hide Comments' : 'Show Comments'}
                            </button>
                            <button
                                onClick={() => handleAction(req.id, WorkflowStatus.PICKED_AND_LOADED)}
                                disabled={updatingId === req.id}
                                className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors"
                            >
                                {updatingId === req.id ? 'Processing...' : 'Mark as Picked & Loaded'}
                            </button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Picking;