import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase/client';
import { getMappedRole, WorkflowRequest, User, WorkflowStatus, WorkflowItem, StoreType, UserRole, Store, departmentToStoreMap } from '../../types';
import Card from './Card';
import CommentSection from './CommentSection';
import { sendApprovalWebhook, sendDenialWebhook } from '../../services/webhookService';
import { getNextStepInfo } from '../../utils/workflowSteps';

interface EquipmentManagerProps {
    user: User;
}

const RequestItemRow: React.FC<{ item: WorkflowItem }> = ({ item }) => {
    const isStockLow = item.quantityOnHand !== undefined && item.quantityRequested > item.quantityOnHand;
    return (
        <tr className={isStockLow ? 'bg-amber-50' : ''}>
            <td className="py-2 px-4 whitespace-nowrap font-mono text-zinc-800">{item.partNumber}</td>
            <td className="py-2 px-4 whitespace-nowrap text-zinc-700">{item.description}</td>
            <td className="py-2 px-4 whitespace-nowrap text-center font-semibold text-zinc-900">{item.quantityRequested}</td>
            <td className={`py-2 px-4 whitespace-nowrap text-center font-semibold ${isStockLow ? 'text-amber-600' : 'text-zinc-900'}`}>
                {item.quantityOnHand ?? 'N/A'}
                {isStockLow && <span className="ml-2 text-xs">(Insufficient Stock)</span>}
            </td>
        </tr>
    );
};

const EquipmentManager: React.FC<EquipmentManagerProps> = ({ user }) => {
    const queryClient = useQueryClient();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionComment, setRejectionComment] = useState('');

    const hasSiteAccess = (siteName?: string | null) => {
        if (getMappedRole(user.role) === UserRole.Admin) return true;
        const sites = user.sites || [];
        if (!siteName || sites.length === 0) return false;
        return sites.map(s => s.toLowerCase()).includes(siteName.toLowerCase());
    };

    const { data: requests = [], isLoading: loading, isError } = useQuery({
        queryKey: ['workflows', 'equipment', user.id],
        queryFn: async () => {
            let requestsQuery = supabase
                .from('enprotec_workflows_view')
                .select('*')
                .eq('currentStatus', WorkflowStatus.AWAITING_EQUIP_MANAGER);
            if (getMappedRole(user.role) !== UserRole.Admin && user.departments && user.departments.length > 0) {
                requestsQuery = requestsQuery.in('department', user.departments);
            }
            if (getMappedRole(user.role) !== UserRole.Admin && user.sites && user.sites.length > 0) {
                requestsQuery = requestsQuery.in('projectCode', user.sites);
            }
            const { data, error } = await requestsQuery.order('createdAt', { ascending: true });
            if (error) throw error;
            return (data as unknown as WorkflowRequest[]) || [];
        },
        staleTime: 30_000,
    });
    const error = isError ? 'Unable to load approval requests. Please try again.' : null;

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.projectCode.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [requests, searchTerm]);

    const handleApprove = async (requestId: string) => {
        setUpdatingId(requestId);
        const requestToUpdate = requests.find(r => r.id === requestId);
        if (!requestToUpdate) {
            console.error("Could not find request to approve.");
            setUpdatingId(null);
            return;
        }
        if (!hasSiteAccess(requestToUpdate.projectCode)) {
            alert('You are not allowed to approve requests for this site.');
            setUpdatingId(null);
            return;
        }

        try {
            const newStatus = WorkflowStatus.AWAITING_PICKING;
            const { error } = await supabase
                .from('enprotec_workflow_requests')
                .update({ current_status: newStatus })
                .eq('id', requestId);
            
            if (error) throw error;
            
            await sendApprovalWebhook('APPROVAL', requestToUpdate, newStatus, user);

            queryClient.invalidateQueries({ queryKey: ['workflows'] });
        } catch (err) {
            alert('Unable to approve this request. Please try again.');
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDecline = async (requestId: string) => {
        if (!rejectionComment.trim()) {
            alert("Please provide a reason for declining the request.");
            return;
        }
        setUpdatingId(requestId);
        const requestToUpdate = requests.find(r => r.id === requestId);
        if (!requestToUpdate) {
            console.error("Could not find request to decline.");
            setUpdatingId(null);
            return;
        }
        if (!hasSiteAccess(requestToUpdate.projectCode)) {
            alert('You are not allowed to decline requests for this site.');
            setUpdatingId(null);
            return;
        }
        
        try {
            const newStatus = WorkflowStatus.REQUEST_DECLINED;
            const { error } = await supabase
                .from('enprotec_workflow_requests')
                .update({ 
                    current_status: newStatus,
                    rejection_comment: rejectionComment.trim() 
                })
                .eq('id', requestId);

            if (error) throw error;
            
            await sendApprovalWebhook('DECLINE', requestToUpdate, newStatus, user, rejectionComment.trim());
            await sendDenialWebhook(requestToUpdate, rejectionComment.trim());

            setRejectingId(null);
            setRejectionComment('');
            queryClient.invalidateQueries({ queryKey: ['workflows'] });
        } catch (err) {
            alert('Unable to decline this request. Please try again.');
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
                    <h1 className="text-2xl font-bold text-zinc-900">Equipment Manager Approvals</h1>
                    <p className="text-zinc-500 mt-1">{filteredRequests.length} requests awaiting your final approval.</p>
                </div>
                 <div className="w-full md:w-64 relative">
                    <input 
                        type="text" 
                        placeholder="Search requests..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                    />
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
            
            {loading && <p className="text-zinc-500">Loading requests...</p>}
            {error && <p className="text-red-600">{error}</p>}
            
            {!loading && !error && filteredRequests.length === 0 && (
                 <div className="text-center p-12 bg-white rounded-lg border border-zinc-200">
                    <h2 className="text-xl font-semibold text-zinc-900">{searchTerm ? 'No Results Found' : 'All Clear!'}</h2>
                    <p className="mt-2 text-zinc-500">{searchTerm ? 'Your search did not match any requests.' : 'There are no requests awaiting your approval.'}</p>
                </div>
            )}
            
            <div className="space-y-4">
                {filteredRequests.map(req => {
                    const attachments = req.attachments && req.attachments.length > 0
                        ? req.attachments
                        : (req.attachmentUrl
                            ? [{ id: 'legacy-attachment', url: req.attachmentUrl, fileName: 'Attachment' }]
                            : []);
                    const nextStepInfo = getNextStepInfo(req.currentStatus);
                    return (
                    <Card key={req.id} title="" padding="p-0">
                        <div className="flex justify-between items-start p-4 border-b border-zinc-200">
                            <div className="flex-grow">
                                <h3 className="font-bold text-lg text-zinc-900">{req.requestNumber}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2 text-sm mt-2">
                                    <div><div className="text-zinc-500 text-xs">Requester</div><div className="text-zinc-900 font-medium">{req.requester}</div></div>
                                    <div><div className="text-zinc-500 text-xs">Project/Site</div><div className="text-zinc-900 font-medium">{req.projectCode}</div></div>
                                    <div><div className="text-zinc-500 text-xs">Store</div><div className="text-zinc-900 font-medium">{req.department}</div></div>
                                    <div><div className="text-zinc-500 text-xs">Priority</div><div className="text-zinc-900 font-medium">{req.priority}</div></div>
                                    <div>
                                        <div className="text-zinc-500 text-xs">Next Step</div>
                                        <div className="text-zinc-900 font-medium">
                                            {nextStepInfo ? nextStepInfo.title : 'N/A'}
                                        </div>
                                        {nextStepInfo?.actor && (
                                            <p className="text-xs text-zinc-500">{nextStepInfo.actor}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {attachments.length > 0 && (
                                <div className="ml-4 flex-shrink-0 flex flex-wrap gap-2 justify-end">
                                    {attachments.map(att => (
                                        <a
                                            key={att.id}
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0"
                                            title={att.fileName || 'View attachment'}
                                        >
                                            <img
                                                src={att.url}
                                                alt={att.fileName || 'Attachment'}
                                                className="h-20 w-20 rounded-md object-cover border border-zinc-200 hover:ring-2 hover:ring-sky-500 transition-all"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                         <div className="overflow-x-auto">
                            <table className="min-w-full bg-white text-sm">
                                <thead className="bg-zinc-50">
                                     <tr>
                                        <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Part #</th>
                                        <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Description</th>
                                        <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty Requested</th>
                                        <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty on Hand (Store)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200">
                                     {req.items.map(item => <RequestItemRow key={item.partNumber} item={item} />)}
                                </tbody>
                            </table>
                        </div>

                        {expandedCommentId === req.id && (
                            <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                                <CommentSection workflowId={req.id} user={user} />
                            </div>
                        )}
                        
                        {rejectingId === req.id && (
                            <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                                <label htmlFor={`rejectionComment-${req.id}`} className="block text-sm font-medium text-zinc-700 mb-2">Reason for Declining (Required)</label>
                                <textarea
                                    id={`rejectionComment-${req.id}`}
                                    value={rejectionComment}
                                    onChange={(e) => setRejectionComment(e.target.value)}
                                    rows={3}
                                    className="w-full p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500"
                                    placeholder="e.g., Insufficient stock, incorrect part..."
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => setRejectingId(null)} className="px-3 py-1 text-sm bg-zinc-200 text-zinc-800 rounded hover:bg-zinc-300">Cancel</button>
                                    <button onClick={() => handleDecline(req.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Confirm Decline</button>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 flex justify-end items-center gap-3">
                            <button onClick={() => toggleComments(req.id)} className="mr-auto text-sm text-zinc-500 hover:text-sky-600 transition-colors font-medium">
                                {expandedCommentId === req.id ? 'Hide Comments' : 'Show Comments'}
                            </button>
                            <button
                                onClick={() => setRejectingId(req.id)}
                                disabled={updatingId === req.id || rejectingId === req.id}
                                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-zinc-300 transition-colors"
                            >
                                Decline
                            </button>
                            <button
                                onClick={() => handleApprove(req.id)}
                                disabled={updatingId === req.id || rejectingId === req.id}
                                className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors"
                            >
                                {updatingId === req.id ? '...' : 'Approve for Picking'}
                            </button>
                        </div>
                    </Card>
                )})}
            </div>
        </div>
    );
};

export default EquipmentManager;
