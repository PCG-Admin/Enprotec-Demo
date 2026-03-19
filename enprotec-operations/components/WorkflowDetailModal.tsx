import React, { useMemo, useState, useEffect } from 'react';
import { getMappedRole, WorkflowRequest, Priority, User, UserRole, WorkflowStatus, WorkflowAttachment } from '../types';
import WorkflowStatusIndicator from './WorkflowStatusIndicator';
import { supabase } from '../supabase/client';
import CommentSection from './CommentSection';
import { sendApprovalWebhook, sendDenialWebhook } from '../services/webhookService';
import { getActorsForWorkflow, getActorDescription } from '../utils/workflowActors';

interface WorkflowDetailModalProps {
  workflow: WorkflowRequest;
  user: User;
  onClose: () => void;
  onUpdate: () => void;
}

const getPriorityChip = (priority: Priority) => {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded-full inline-block";
    switch (priority) {
        case Priority.Critical: return <span className={`${baseClasses} bg-red-100 text-red-800`}>Critical</span>;
        case Priority.High: return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>High</span>;
        case Priority.Medium: return <span className={`${baseClasses} bg-amber-100 text-amber-800`}>Medium</span>;
        case Priority.Low: return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Low</span>;
    }
};

const ActionButton: React.FC<{ onClick: () => void; disabled: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors"
    >
        {children}
    </button>
);

const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({ workflow, user, onClose, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actors, setActors] = useState<{ fullName: string; role: string }[]>([]);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const hasSiteAccess = useMemo(() => {
    // Admin has access to all sites
    if (getMappedRole(user.role) === UserRole.Admin) return true;
    const sites = user.sites || [];
    if (!workflow.projectCode || sites.length === 0) return false;
    return sites.map(s => s.toLowerCase()).includes(workflow.projectCode.toLowerCase());
  }, [user, workflow.projectCode]);
  const attachments: WorkflowAttachment[] = useMemo(() => {
    if (workflow.attachments && workflow.attachments.length > 0) {
        return workflow.attachments;
    }
    if (workflow.attachmentUrl) {
        return [{
            id: 'legacy-attachment',
            url: workflow.attachmentUrl,
            fileName: 'Attachment',
        }];
    }
    return [];
  }, [workflow.attachments, workflow.attachmentUrl]);

  useEffect(() => {
    const fetchActors = async () => {
      console.log('Fetching actors for:', {
        status: workflow.currentStatus,
        site: workflow.projectCode,
        requesterId: workflow.requester_id
      });
      const actorsList = await getActorsForWorkflow(
        workflow.currentStatus,
        workflow.projectCode,
        workflow.requester_id
      );
      console.log('Fetched actors:', actorsList);
      setActors(actorsList);
    };
    fetchActors();
  }, [workflow.currentStatus, workflow.projectCode, workflow.requester_id]);

  const handleStatusUpdate = async (newStatus: WorkflowStatus) => {
    setIsUpdating(true);
    setError(null);
    try {
        if (!hasSiteAccess) {
            setError('You are not allowed to action requests for this site.');
            setIsUpdating(false);
            return;
        }
        const { error } = await supabase
            .from('enprotec_workflow_requests')
            .update({ current_status: newStatus })
            .eq('id', workflow.id);
        if (error) throw error;

        await sendApprovalWebhook('APPROVAL', workflow, newStatus, user);

        onUpdate();
        onClose(); // Close modal to show updated workflow list
    } catch (err) {
        setError("Failed to update workflow status.");
        console.error(err);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleDecline = async () => {
    if (!rejectionComment.trim()) {
        setError("Please provide a reason for declining the request.");
        return;
    }
    setIsUpdating(true);
    setError(null);
    try {
        if (!hasSiteAccess) {
            setError('You are not allowed to action requests for this site.');
            setIsUpdating(false);
            return;
        }
        const newStatus = WorkflowStatus.REQUEST_DECLINED;
        const { error } = await supabase
            .from('enprotec_workflow_requests')
            .update({
                current_status: newStatus,
                rejection_comment: rejectionComment.trim()
            })
            .eq('id', workflow.id);
        if (error) throw error;

        await sendApprovalWebhook('DECLINE', workflow, newStatus, user, rejectionComment.trim());
        await sendDenialWebhook(workflow, rejectionComment.trim());

        setIsRejecting(false);
        setRejectionComment('');
        onUpdate();
        onClose(); // Close modal to show updated workflow list
    } catch (err) {
        setError("Failed to decline workflow.");
        console.error(err);
    } finally {
        setIsUpdating(false);
    }
  };

  const renderActions = () => {
    const { role } = user;
    const { currentStatus } = workflow;
    const isAdmin = getMappedRole(role) === UserRole.Admin;

    // STRICT ROLE CHECKS - Only correct role for each step (+ Admin override)
    switch (currentStatus) {
        case WorkflowStatus.REQUEST_SUBMITTED:
            // ONLY Ops Manager can approve/decline initial request
            if (getMappedRole(role) === UserRole.OperationsManager || isAdmin) {
                return (
                    <>
                        <button
                            onClick={() => setIsRejecting(true)}
                            disabled={isUpdating || isRejecting}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-zinc-300 transition-colors"
                        >
                            Decline
                        </button>
                        <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.STOCK_CONTROLLER_APPROVAL)} disabled={isUpdating || isRejecting}>Approve (Ops Manager)</ActionButton>
                    </>
                );
            }
            break;
        case WorkflowStatus.STOCK_CONTROLLER_APPROVAL:
            // ONLY Stock Controller can approve/decline after Ops Manager
            if (getMappedRole(role) === UserRole.StockController || isAdmin) {
                return (
                    <>
                        <button
                            onClick={() => setIsRejecting(true)}
                            disabled={isUpdating || isRejecting}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-zinc-300 transition-colors"
                        >
                            Decline
                        </button>
                        <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.AWAITING_EQUIP_MANAGER)} disabled={isUpdating || isRejecting}>Approve (Stock Controller)</ActionButton>
                    </>
                );
            }
            break;
        case WorkflowStatus.AWAITING_EQUIP_MANAGER:
            // ONLY Equipment Manager can approve/decline equipment
            if (getMappedRole(role) === UserRole.EquipmentManager || isAdmin) {
                return (
                    <>
                        <button
                            onClick={() => setIsRejecting(true)}
                            disabled={isUpdating || isRejecting}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-zinc-300 transition-colors"
                        >
                            Decline
                        </button>
                        <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.AWAITING_PICKING)} disabled={isUpdating || isRejecting}>Approve (Equip. Manager)</ActionButton>
                    </>
                );
            }
            break;
        case WorkflowStatus.AWAITING_PICKING:
            // ONLY Stock Controller or Storeman can mark as picked
            if (getMappedRole(role) === UserRole.StockController || getMappedRole(role) === UserRole.Storeman || isAdmin) {
                return <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.PICKED_AND_LOADED)} disabled={isUpdating}>Mark as Picked & Loaded</ActionButton>;
            }
            break;
        case WorkflowStatus.PICKED_AND_LOADED:
            // ONLY Security or Driver can dispatch
            if (getMappedRole(role) === UserRole.Security || getMappedRole(role) === UserRole.Driver || isAdmin) {
                return <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.DISPATCHED)} disabled={isUpdating}>Confirm Gate Release & Dispatch</ActionButton>;
            }
            break;
        case WorkflowStatus.DISPATCHED:
            // ONLY original requester can confirm/decline EPOD
            if (user.id === workflow.requester_id || isAdmin) {
                return <ActionButton onClick={() => handleStatusUpdate(WorkflowStatus.EPOD_CONFIRMED)} disabled={isUpdating}>Confirm Delivery (EPOD)</ActionButton>;
            }
            break;
        default:
            return null;
    }
    return null;
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 font-sans"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full m-4 overflow-hidden transform transition-all border border-zinc-200 flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent click inside from closing modal
      >
        <div className="p-6 border-b border-zinc-200 flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-zinc-900">{workflow.requestNumber}</h2>
                <p className="text-sm text-zinc-500">Project: {workflow.projectCode} &bull; Requested by: {workflow.requester}</p>
            </div>
             <button
                onClick={onClose}
                className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                aria-label="Close modal"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
        </div>

        <div className="p-6 space-y-6 bg-zinc-50 flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-md border border-zinc-200">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase">Priority</h4>
                    <div className="mt-1">{getPriorityChip(workflow.priority)}</div>
                </div>
                <div className="bg-white p-3 rounded-md border border-zinc-200">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase">Type</h4>
                    <p className="font-medium text-zinc-800">{workflow.type}</p>
                </div>
                 <div className="bg-white p-3 rounded-md border border-zinc-200">
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase">Created At</h4>
                    <p className="font-medium text-zinc-800">{new Date(workflow.createdAt).toLocaleString()}</p>
                </div>
            </div>

            {(workflow.driverName || workflow.vehicleRegistration) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-md border border-zinc-200">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase">Driver Name</h4>
                        <p className="font-medium text-zinc-800">{workflow.driverName || 'Pending'}</p>
                    </div>
                    <div className="bg-white p-3 rounded-md border border-zinc-200">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase">Vehicle Registration</h4>
                        <p className="font-medium text-zinc-800">{workflow.vehicleRegistration || 'Pending'}</p>
                    </div>
                </div>
            )}
            
            <div>
                <h3 className="text-md font-semibold text-zinc-800 mb-2">Workflow Progress</h3>
                <div className="p-4 bg-white rounded-md border border-zinc-200">
                    <WorkflowStatusIndicator steps={workflow.steps} currentStep={workflow.currentStatus} />
                </div>
            </div>

            {actors.length > 0 && (
                <div>
                    <h3 className="text-md font-semibold text-zinc-800 mb-2">Who Can Act on Current Step</h3>
                    <div className="p-4 bg-white rounded-md border border-zinc-200">
                        <p className="text-xs text-zinc-500 mb-3">Current Status: <span className="font-semibold text-zinc-700">{workflow.currentStatus}</span></p>
                        <p className="text-xs text-zinc-500 mb-2">Required Role: <span className="font-semibold text-zinc-700">{getActorDescription(workflow.currentStatus)}</span></p>
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-zinc-600 uppercase mb-1">Authorized Users for this Site:</p>
                            {actors.map((actor, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium text-zinc-800">{actor.fullName}</span>
                                    <span className="text-xs text-zinc-500">({actor.role})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-md font-semibold text-zinc-800 mb-2">Requested Items ({workflow.items.length})</h3>
                <div className="border border-zinc-200 rounded-md overflow-hidden">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-zinc-50">
                             <tr>
                                <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Part #</th>
                                <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Description</th>
                                <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                             {workflow.items.map(item => (
                                <tr key={item.partNumber}>
                                    <td className="py-2 px-4 whitespace-nowrap font-mono text-zinc-800">{item.partNumber}</td>
                                    <td className="py-2 px-4 whitespace-nowrap text-zinc-700">{item.description}</td>
                                    <td className="py-2 px-4 whitespace-nowrap text-center font-semibold text-zinc-900">{item.quantityRequested}</td>
                                </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {attachments.length > 0 && (
                <div>
                    <h3 className="text-md font-semibold text-zinc-800 mb-2">Attachments ({attachments.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attachments.map(att => {
                            const isImage = /\.(png|jpe?g|gif|bmp|webp)$/i.test(att.url);
                            return (
                                <a
                                    key={att.id}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="border border-zinc-200 rounded-md p-3 bg-white hover:border-sky-300 transition-colors"
                                >
                                    <p className="text-sm font-medium text-zinc-800 truncate">{att.fileName || 'Attachment'}</p>
                                    {att.uploadedAt && (
                                        <p className="text-xs text-zinc-500 mb-2">
                                            Uploaded {new Date(att.uploadedAt).toLocaleString()}
                                        </p>
                                    )}
                                    {isImage ? (
                                        <img src={att.url} alt={att.fileName ?? 'Attachment'} className="max-h-40 w-full object-contain rounded" />
                                    ) : (
                                        <div className="mt-2 text-xs text-sky-600">Click to download</div>
                                    )}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Comments Section */}
            <div>
                <h3 className="text-md font-semibold text-zinc-800 mb-2">Comments</h3>
                <CommentSection workflowId={workflow.id} user={user} />
            </div>

            {/* Rejection Comment Input */}
            {isRejecting && (
                <div className="p-4 bg-red-50 rounded-md border border-red-200">
                    <label htmlFor="rejectionComment" className="block text-sm font-medium text-zinc-700 mb-2">Reason for Declining (Required)</label>
                    <textarea
                        id="rejectionComment"
                        value={rejectionComment}
                        onChange={(e) => setRejectionComment(e.target.value)}
                        rows={3}
                        className="w-full p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 text-zinc-900"
                        placeholder="e.g., Insufficient stock, duplicate request..."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            onClick={() => {
                                setIsRejecting(false);
                                setRejectionComment('');
                                setError(null);
                            }}
                            className="px-3 py-1 text-sm bg-zinc-200 text-zinc-800 rounded hover:bg-zinc-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDecline}
                            disabled={isUpdating}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-zinc-300"
                        >
                            {isUpdating ? 'Declining...' : 'Confirm Decline'}
                        </button>
                    </div>
                </div>
            )}

             {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="p-4 bg-white border-t border-zinc-200 flex justify-end items-center gap-4 flex-shrink-0">
          {renderActions()}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDetailModal;
