import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase/client';
import { getMappedRole, WorkflowRequest, User, WorkflowStatus, WorkflowItem, FormType, UserRole, Store, StoreType, StockItem, departmentToStoreMap } from '../../types';
import Card from './Card';
import CommentSection from './CommentSection';
import { sendApprovalWebhook, sendDenialWebhook } from '../../services/webhookService';
import { getNextStepInfo } from '../../utils/workflowSteps';

const normalizeAttachments = (req: WorkflowRequest) => {
    if (req.attachments && req.attachments.length > 0) {
        return req.attachments;
    }
    return req.attachmentUrl ? [{ id: 'legacy-attachment', url: req.attachmentUrl, fileName: 'Attachment' }] : [];
};

interface RequestsProps {
    user: User;
    openForm: (type: FormType, context?: WorkflowRequest | null) => void;
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

const Requests: React.FC<RequestsProps> = ({ user, openForm }) => {
    const queryClient = useQueryClient();
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionComment, setRejectionComment] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    const hasSiteAccess = (siteName?: string | null) => {
        if (getMappedRole(user.role) === UserRole.Admin) return true;
        const sites = user.sites || [];
        if (!siteName || sites.length === 0) return false;
        return sites.map(s => s.toLowerCase()).includes(siteName.toLowerCase());
    };

    const canApprove = useMemo(() => [
        UserRole.Admin,
        UserRole.OperationsManager,
        UserRole.StockController
    ].includes(user.role), [user.role]);

    const canManageIntake = useMemo(
        () => [UserRole.Admin, UserRole.StockController, UserRole.EquipmentManager].includes(user.role),
        [user.role]
    );

    const { data: requests = [], isLoading: loading, isError } = useQuery({
        queryKey: ['workflows', 'requests', user.id],
        queryFn: async () => {
            let requestsQuery = supabase
                .from('enprotec_workflows_view')
                .select('*')
                .in('currentStatus', [WorkflowStatus.REQUEST_SUBMITTED, WorkflowStatus.AWAITING_OPS_MANAGER, WorkflowStatus.STOCK_CONTROLLER_APPROVAL, WorkflowStatus.REJECTED_AT_DELIVERY, WorkflowStatus.DISPATCHED]);
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
    const error = isError ? 'Unable to load requests. Please try again.' : null;

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.projectCode.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [requests, searchTerm]);

    const awaitingOpsManager = useMemo(
        () => filteredRequests.filter(req => req.currentStatus === WorkflowStatus.REQUEST_SUBMITTED),
        [filteredRequests]
    );

    const awaitingStockController = useMemo(
        () => filteredRequests.filter(req => req.currentStatus === WorkflowStatus.STOCK_CONTROLLER_APPROVAL),
        [filteredRequests]
    );

    const returnWorkflows = useMemo(
        () => filteredRequests.filter(req => req.currentStatus === WorkflowStatus.REJECTED_AT_DELIVERY),
        [filteredRequests]
    );

    const awaitingEPOD = useMemo(
        () => filteredRequests.filter(req =>
            req.currentStatus === WorkflowStatus.DISPATCHED &&
            req.requester_id === user.id
        ),
        [filteredRequests, user.id]
    );

    const pendingCount = useMemo(
        () => requests.filter(req =>
            req.currentStatus === WorkflowStatus.REQUEST_SUBMITTED ||
            req.currentStatus === WorkflowStatus.STOCK_CONTROLLER_APPROVAL
        ).length,
        [requests]
    );

    const returnCount = useMemo(
        () => requests.filter(req => req.currentStatus === WorkflowStatus.REJECTED_AT_DELIVERY).length,
        [requests]
    );

    const epodCount = useMemo(
        () => requests.filter(req =>
            req.currentStatus === WorkflowStatus.DISPATCHED &&
            req.requester_id === user.id
        ).length,
        [requests, user.id]
    );

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
            // Correct workflow order:
            // Step 1: REQUEST_SUBMITTED -> STOCK_CONTROLLER_APPROVAL (Ops Manager approves)
            // Step 2: STOCK_CONTROLLER_APPROVAL -> AWAITING_EQUIP_MANAGER (Stock Controller approves)
            let newStatus: WorkflowStatus;

            if (requestToUpdate.currentStatus === WorkflowStatus.REQUEST_SUBMITTED) {
                newStatus = WorkflowStatus.STOCK_CONTROLLER_APPROVAL;
            } else if (requestToUpdate.currentStatus === WorkflowStatus.STOCK_CONTROLLER_APPROVAL) {
                newStatus = WorkflowStatus.AWAITING_EQUIP_MANAGER;
            } else {
                console.error("Unexpected current status:", requestToUpdate.currentStatus);
                setUpdatingId(null);
                return;
            }

            const { error } = await supabase
                .from('enprotec_workflow_requests')
                .update({ current_status: newStatus })
                .eq('id', requestId);

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            await sendApprovalWebhook('APPROVAL', requestToUpdate, newStatus, user);

            queryClient.invalidateQueries({ queryKey: ['workflows'] });
        } catch (err) {
            alert('Unable to approve this request. Please check console for details.');
            console.error('Approval error:', err);
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
            alert('Failed to decline request.');
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
                    <h1 className="text-2xl font-bold text-zinc-900">Incoming Stock Requests</h1>
                    <p className="text-zinc-500 mt-1">
                        {pendingCount === 0
                            ? 'No new requests awaiting review.'
                            : `${pendingCount} ${pendingCount === 1 ? 'request' : 'requests'} awaiting stock control review.`}
                        {returnCount > 0 && ` ${returnCount} ${returnCount === 1 ? 'rejected delivery' : 'rejected deliveries'} ready to book back into stock.`}
                        {epodCount > 0 && ` ${epodCount} ${epodCount === 1 ? 'delivery' : 'deliveries'} awaiting your confirmation.`}
                    </p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
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
                     <button
                        onClick={() => openForm('StockRequest')}
                        className="flex-shrink-0 px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors"
                    >
                        New Request
                    </button>
                </div>
            </div>
            
            {loading && <p className="text-zinc-500">Loading requests...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {actionError && <p className="text-red-600">{actionError}</p>}
            
            {!loading && !error && awaitingOpsManager.length === 0 && awaitingStockController.length === 0 && returnWorkflows.length === 0 && awaitingEPOD.length === 0 && (
                 <div className="text-center p-12 bg-white rounded-lg border border-zinc-200">
                    <h2 className="text-xl font-semibold text-zinc-900">{searchTerm ? 'No Results Found' : 'All Clear!'}</h2>
                    <p className="mt-2 text-zinc-500">
                        {searchTerm
                            ? 'Your search did not match any pending requests or returns.'
                            : 'There are no requests awaiting review, no rejected deliveries to process, and no deliveries awaiting your confirmation.'}
                    </p>
                </div>
            )}

            <div className="space-y-6">
                {awaitingOpsManager.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-900">Awaiting Operations Manager Approval</h2>
                        {awaitingOpsManager.map(req => {
                            const attachments = normalizeAttachments(req);
                            const nextStepInfo = getNextStepInfo(req.currentStatus);
                            const canApproveThisStep = getMappedRole(user.role) === UserRole.OperationsManager || getMappedRole(user.role) === UserRole.Admin;
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
                                                    <img src={att.url} alt={att.fileName || 'Attachment'} className="h-20 w-20 rounded-md object-cover border border-zinc-200 hover:ring-2 hover:ring-sky-500 transition-all" />
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
                                            placeholder="e.g., Insufficient stock, duplicate request..."
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
                                    {canApproveThisStep && (
                                        <>
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
                                                {updatingId === req.id ? '...' : 'Approve (Ops Mgr)'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </Card>
                        )})}
                    </div>
                )}

                {awaitingStockController.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-900">Awaiting Stock Controller Approval</h2>
                        {awaitingStockController.map(req => {
                    const attachments = normalizeAttachments(req);
                    const nextStepInfo = getNextStepInfo(req.currentStatus);
                    const canApproveThisStep = getMappedRole(user.role) === UserRole.StockController || getMappedRole(user.role) === UserRole.Admin;
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
                                            <img src={att.url} alt={att.fileName || 'Attachment'} className="h-20 w-20 rounded-md object-cover border border-zinc-200 hover:ring-2 hover:ring-sky-500 transition-all" />
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
                                    placeholder="e.g., Insufficient stock, duplicate request..."
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
                            {canApproveThisStep && (
                                <>
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
                                        {updatingId === req.id ? '...' : 'Approve (Stock Ctrl)'}
                                    </button>
                                </>
                            )}
                        </div>
                    </Card>
                        )})}
                    </div>
                )}

                {returnWorkflows.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-900">Rejected deliveries awaiting restock</h2>
                        {returnWorkflows.map(req => {
                            const attachments = normalizeAttachments(req);
                            const nextStepInfo = getNextStepInfo(req.currentStatus);
                            const bookToSalvage = async (item: WorkflowItem) => {
                                setActionError(null);
                                try {
                                    const store: StoreType = departmentToStoreMap[req.department as Store] || (req.department as unknown as StoreType);
                                    const { data, error } = await supabase
                                        .from('enprotec_stock_view')
                                        .select('*')
                                        .eq('partNumber', item.partNumber)
                                        .eq('store', store)
                                        .limit(1)
                                        .single();
                                    if (error || !data) throw new Error('Matching stock record not found for salvage.');
                                    openForm('SalvageBooking', { stockItem: data as StockItem, maxQuantity: item.quantityRequested, workflowId: req.id });
                                    } catch (err) {
                                    const msg = err instanceof Error ? err.message : 'Could not start salvage booking.';
                                    setActionError(msg);
                                    }
                                    };
                            return (
                            <Card key={req.id} title="" padding="p-0">
                                <div className="p-4 border-b border-zinc-200 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-zinc-900">Return for: {req.requestNumber}</h3>
                                        <p className="text-sm text-zinc-500 mt-1">
                                            Rejected by {req.requester} for site {req.projectCode}
                                        </p>
                                        <p className="text-sm text-zinc-700 mt-2">
                                            <strong className="text-zinc-900">Reason:</strong> {req.rejectionComment || 'No comment provided.'}
                                        </p>
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Original store: {req.department}
                                        </p>
                                        {nextStepInfo && (
                                            <p className="text-xs text-amber-600 mt-2 font-semibold">
                                                Next: {nextStepInfo.title} ({nextStepInfo.actor})
                                            </p>
                                        )}
                                    </div>
                                    {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 self-start md:self-center">
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
                                                <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty to return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200">
                                            {req.items.map(item => (
                                                <tr key={item.partNumber}>
                                                    <td className="py-2 px-4 font-mono text-zinc-800">{item.partNumber}</td>
                                                    <td className="py-2 px-4 text-zinc-700">{item.description}</td>
                                                <td className="py-2 px-4 text-center font-semibold text-zinc-900">{item.quantityRequested}</td>
                                                {canManageIntake && (
                                                    <td className="py-2 px-4 text-right space-x-2">
                                                        <button
                                                            onClick={() => openForm('ReturnIntake', req)}
                                                            className="px-3 py-1.5 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors"
                                                        >
                                                            Book Back into Stock
                                                        </button>
                                                        <button
                                                            onClick={() => bookToSalvage(item)}
                                                            className="px-3 py-1.5 bg-amber-500 text-white font-semibold rounded-md hover:bg-amber-600 transition-colors"
                                                        >
                                                            Book to Salvage
                                                        </button>
                                                    </td>
                                                )}
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

                                <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 flex justify-between items-center gap-3">
                                    <button onClick={() => toggleComments(req.id)} className="text-sm text-zinc-500 hover:text-sky-600 transition-colors font-medium">
                                        {expandedCommentId === req.id ? 'Hide Comments' : 'Show Comments'}
                                    </button>
                                </div>
                            </Card>
                        )})}
                    </div>
                )}

                {awaitingEPOD.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-zinc-900">Awaiting Your EPOD Confirmation</h2>
                        {awaitingEPOD.map(req => {
                            const attachments = normalizeAttachments(req);
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
                                                <div className="text-zinc-500 text-xs">Status</div>
                                                <div className="text-zinc-900 font-medium">Dispatched - Awaiting EPOD</div>
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
                                                    <img src={att.url} alt={att.fileName || 'Attachment'} className="h-20 w-20 rounded-md object-cover border border-zinc-200 hover:ring-2 hover:ring-sky-500 transition-all" />
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

                                <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 flex justify-end items-center gap-3">
                                    <button onClick={() => toggleComments(req.id)} className="mr-auto text-sm text-zinc-500 hover:text-sky-600 transition-colors font-medium">
                                        {expandedCommentId === req.id ? 'Hide Comments' : 'Show Comments'}
                                    </button>
                                    <button
                                        onClick={() => openForm('EPOD', req)}
                                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                                    >
                                        Confirm Delivery (EPOD)
                                    </button>
                                </div>
                            </Card>
                        )})}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Requests;
