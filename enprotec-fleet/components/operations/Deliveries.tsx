import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase/client';
import { getMappedRole, WorkflowRequest, User, WorkflowStatus, WorkflowItem, FormType, UserRole } from '../../types';
import Card from './Card';
import CommentSection from './CommentSection';

interface DeliveriesProps {
    user: User;
    openForm: (type: FormType, context: WorkflowRequest) => void;
}

const DeliveryRequestCard: React.FC<{
    req: WorkflowRequest;
    onAction: (form: FormType, workflow: WorkflowRequest) => void;
    actionLabel: string;
    actionForm: FormType;
    user: User;
}> = ({ req, onAction, actionLabel, actionForm, user }) => {
    const [showComments, setShowComments] = useState(false);
    return (
        <Card key={req.id} title={req.requestNumber} padding="p-0">
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b border-zinc-200">
                <div><div className="text-zinc-500 text-xs">Requester</div><div className="text-zinc-900 font-medium">{req.requester}</div></div>
                <div><div className="text-zinc-500 text-xs">Project/Site</div><div className="text-zinc-900 font-medium">{req.projectCode}</div></div>
                <div><div className="text-zinc-500 text-xs">Store</div><div className="text-zinc-900 font-medium">{req.department}</div></div>
                <div><div className="text-zinc-500 text-xs">Priority</div><div className="text-zinc-900 font-medium">{req.priority}</div></div>
                <div><div className="text-zinc-500 text-xs">Driver</div><div className="text-zinc-900 font-medium">{req.driverName || 'Pending'}</div></div>
                <div><div className="text-zinc-500 text-xs">Vehicle Reg</div><div className="text-zinc-900 font-medium">{req.vehicleRegistration || 'Pending'}</div></div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-zinc-50">
                        <tr>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Part #</th>
                            <th className="py-2 px-4 text-left text-xs font-semibold text-zinc-500 uppercase">Description</th>
                            <th className="py-2 px-4 text-center text-xs font-semibold text-zinc-500 uppercase">Qty</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {req.items.map((item: WorkflowItem) => (
                            <tr key={item.partNumber}>
                                <td className="py-2 px-4 font-mono text-zinc-800">{item.partNumber}</td>
                                <td className="py-2 px-4 text-zinc-700">{item.description}</td>
                                <td className="py-2 px-4 text-center font-semibold text-zinc-900">{item.quantityRequested}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showComments && (
                <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                    <CommentSection workflowId={req.id} user={user} />
                </div>
            )}
            <div className="p-4 bg-zinc-50/50 border-t border-zinc-200 flex justify-between items-center gap-3">
                 <button onClick={() => setShowComments(s => !s)} className="text-sm text-zinc-500 hover:text-sky-600 transition-colors font-medium">
                    {showComments ? 'Hide Comments' : 'Show Comments'}
                </button>
                <button
                    onClick={() => onAction(actionForm, req)}
                    className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors"
                >
                    {actionLabel}
                </button>
            </div>
        </Card>
    );
};


const Deliveries: React.FC<DeliveriesProps> = ({ user, openForm }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: allDeliveries = [], isLoading: loading, isError } = useQuery({
        queryKey: ['workflows', 'deliveries', user.id],
        queryFn: async () => {
            let query = supabase
                .from('enprotec_workflows_view')
                .select('*')
                .in('currentStatus', [WorkflowStatus.PICKED_AND_LOADED, WorkflowStatus.DISPATCHED]);
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
    const error = isError ? 'Unable to load delivery requests. Please try again.' : null;

    const picked = allDeliveries.filter(r => r.currentStatus === WorkflowStatus.PICKED_AND_LOADED);
    const dispatched = allDeliveries.filter(r => r.currentStatus === WorkflowStatus.DISPATCHED);

    const filterRequests = (requests: WorkflowRequest[]) => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            (req.requestNumber && req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.requester && req.requester.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.projectCode && req.projectCode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    };

    const filteredPicked = useMemo(() => filterRequests(picked), [picked, searchTerm]);
    const filteredDispatched = useMemo(() => filterRequests(dispatched), [dispatched, searchTerm]);

    return (
        <div className="space-y-8">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h1 className="text-2xl font-bold text-zinc-900 self-start md:self-center">Deliveries</h1>
                 <div className="w-full md:w-64 relative">
                    <input 
                        type="text" 
                        placeholder="Search all deliveries..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                    />
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            {loading && <p className="text-zinc-500">Loading deliveries...</p>}
            {error && <p className="text-red-600">{error}</p>}

            {/* Section: Ready for Dispatch */}
            <section>
                <h2 className="text-xl font-bold text-zinc-900 mb-4">Ready for Dispatch ({filteredPicked.length})</h2>
                { !loading && filteredPicked.length === 0 && <p className="text-zinc-500 text-sm">{searchTerm ? 'No results found.' : 'No items are currently awaiting dispatch.'}</p> }
                <div className="space-y-4">
                    {filteredPicked.map(req => (
                        <DeliveryRequestCard
                            key={req.id}
                            req={req}
                            user={user}
                            onAction={openForm}
                            actionLabel="Sign Gate Release & Dispatch"
                            actionForm="GateRelease"
                        />
                    ))}
                </div>
            </section>

             {/* Section: In Transit */}
            <section>
                <h2 className="text-xl font-bold text-zinc-900 mb-4">In Transit ({filteredDispatched.length})</h2>
                 { !loading && filteredDispatched.length === 0 && <p className="text-zinc-500 text-sm">{searchTerm ? 'No results found.' : 'No items are currently in transit.'}</p> }
                <div className="space-y-4">
                     {filteredDispatched.map(req => (
                        <DeliveryRequestCard
                            key={req.id}
                            req={req}
                            user={user}
                            onAction={openForm}
                            actionLabel="Confirm Delivery (EPOD)"
                            actionForm="EPOD"
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Deliveries;
