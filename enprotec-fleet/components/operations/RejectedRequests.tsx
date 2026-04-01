import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../supabase/client';
import { getMappedRole, WorkflowRequest, WorkflowItem, User, WorkflowStatus, UserRole, StockItem, StoreType, FormType, departmentToStoreMap, Store } from '../../types';

interface RejectedRequestsProps {
    user: User;
    openForm?: (type: FormType, context?: any) => void;
}

const RejectedRequests: React.FC<RejectedRequestsProps> = ({ user, openForm }) => {
    const [requests, setRequests] = useState<WorkflowRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('enprotec_workflows_view')
                .select('*')
                .in('currentStatus', [WorkflowStatus.REQUEST_DECLINED, WorkflowStatus.REJECTED_AT_DELIVERY]);

            // Filter by department unless the user is an Admin
            if (getMappedRole(user.role) !== UserRole.Admin && user.departments && user.departments.length > 0) {
                query = query.in('department', user.departments);
            }

            const { data, error } = await query.order('createdAt', { ascending: false });

            if (error) throw error;
            setRequests((data as unknown as WorkflowRequest[]) || []);
        } catch (err) {
            setError('Unable to load rejected requests. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(req =>
            (req.requestNumber && req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.requester && req.requester.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.projectCode && req.projectCode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [requests, searchTerm]);

    const handleBookToSalvage = async (req: WorkflowRequest, item: WorkflowItem) => {
        if (!openForm) return;
        setActionError(null);
        try {
            const store: StoreType = departmentToStoreMap[req.department as Store] || (req.department as unknown as StoreType);
            const { data, error: fetchError } = await supabase
                .from('enprotec_stock_view')
                .select('*')
                .eq('partNumber', item.partNumber)
                .eq('store', store)
                .limit(1)
                .single();
            if (fetchError || !data) throw new Error('Matching stock record not found for salvage.');
            openForm('SalvageBooking', { stockItem: data as StockItem, maxQuantity: item.quantityRequested, workflowId: req.id });
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Could not start salvage booking.');
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Rejected Requests</h1>
                    <p className="text-zinc-500 mt-1">{filteredRequests.length} rejected requests found.</p>
                </div>
                <div className="w-full md:w-64 relative">
                    <input
                        type="text"
                        placeholder="Search rejected requests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                    />
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            {actionError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">{actionError}</p>}

            <div className="bg-white rounded-lg border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Request #</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Store</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Requester</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                            <td colSpan={7} className="text-center py-12 px-6 text-zinc-500">Loading rejected requests...</td>
                        </tr>
                      )}
                      {error && (
                         <tr>
                            <td colSpan={7} className="text-center py-12 px-6 text-red-600">{error}</td>
                        </tr>
                      )}
                      {!loading && !error && filteredRequests.length === 0 && (
                        <tr>
                            <td colSpan={7} className="text-center py-12 px-6 text-zinc-500">{searchTerm ? 'No results found' : 'No rejected requests found.'}</td>
                        </tr>
                      )}
                      {!loading && !error && filteredRequests.map((wf: WorkflowRequest) => (
                        <tr key={wf.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-zinc-900">{wf.requestNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-700">{wf.department}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-700">{wf.requester}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${wf.currentStatus === WorkflowStatus.REJECTED_AT_DELIVERY ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                              {wf.currentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-500">{new Date(wf.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-500 text-xs">{wf.rejectionComment || 'No reason provided.'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {wf.currentStatus === WorkflowStatus.REJECTED_AT_DELIVERY && openForm && wf.items?.map((item: WorkflowItem) => (
                              <button
                                key={item.partNumber}
                                onClick={() => handleBookToSalvage(wf, item)}
                                className="text-xs px-3 py-1.5 bg-amber-500 text-white font-semibold rounded-md hover:bg-amber-600 transition-colors"
                              >
                                Book to Salvage
                              </button>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
        </div>
    );
};

export default RejectedRequests;
