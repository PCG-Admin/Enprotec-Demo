import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from './Card';
import { supabase } from '../../supabase/client';
import WorkflowStatusIndicator from './WorkflowStatusIndicator';
import { getMappedRole, Priority, WorkflowRequest, View, FormType, WorkflowStatus, StockItem, User, UserRole, departmentToStoreMap, Store } from '../../types';
import ClipboardListIcon from './icons/ClipboardListIcon';
import ClockIcon from './icons/ClockIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import TrendingUpIcon from './icons/TrendingUpIcon';
import WorkflowDetailModal from './WorkflowDetailModal';

interface DashboardProps {
    openForm: (type: FormType) => void;
    navigateTo: (view: View) => void;
    user: User;
}

const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; change?: string; changeType?: 'increase' | 'decrease' }> = ({ title, value, icon, change, changeType }) => {
    const changeColor = changeType === 'increase' ? 'text-emerald-600' : 'text-red-600';
    return (
        <div className="bg-white p-5 rounded-lg border border-zinc-200">
            <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-zinc-500">{title}</h4>
                <div className="text-zinc-400">{icon}</div>
            </div>
            <p className="text-3xl font-bold text-zinc-900 mt-2">{value}</p>
            {change && <p className={`text-xs mt-1 ${changeColor}`}>{change}</p>}
        </div>
    );
};

const getPriorityChip = (priority: Priority) => {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded-full inline-block";
    switch (priority) {
        case Priority.Critical: return <span className={`${baseClasses} bg-red-100 text-red-800`}>Critical</span>;
        case Priority.High: return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>High</span>;
        case Priority.Medium: return <span className={`${baseClasses} bg-amber-100 text-amber-800`}>Medium</span>;
        case Priority.Low: return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Low</span>;
    }
};

const Dashboard: React.FC<DashboardProps> = ({ openForm, navigateTo, user }) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRequest | null>(null);
  const queryClient = useQueryClient();

  const isAdmin = getMappedRole(user.role) === UserRole.Admin;
  const userStores = user.departments || [];
  const visibleStores = userStores.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);

  const { data: workflows = [], isLoading: workflowsLoading, isError: workflowsError } = useQuery({
    queryKey: ['workflows', 'dashboard', user.id],
    queryFn: async () => {
      let query = supabase.from('enprotec_workflows_view').select('*')
        .order('createdAt', { ascending: false })
        .limit(10);
      if (!isAdmin && userStores.length > 0) {
        query = query.in('department', userStores);
      }
      if (!isAdmin && user.sites && user.sites.length > 0) {
        query = query.in('projectCode', user.sites);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as WorkflowRequest[]) || [];
    },
    staleTime: 30_000,
  });

  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['stock', 'dashboard', user.id],
    queryFn: async () => {
      let query = supabase.from('enprotec_stock_view').select('*').limit(200);
      if (!isAdmin && visibleStores.length > 0) {
        query = query.in('store', visibleStores);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as StockItem[]) || [];
    },
    staleTime: 60_000,
  });

  const loading = workflowsLoading || stockLoading;
  const error = workflowsError ? "Failed to fetch dashboard data. Please try again later." : null;

  if (loading) return <div className="text-center p-8 text-zinc-500">Loading Dashboard...</div>;
  if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

  const activeRequests = workflows.length;
  const pendingApprovals = workflows.filter(w =>
    w.currentStatus === WorkflowStatus.REQUEST_SUBMITTED ||
    w.currentStatus === WorkflowStatus.AWAITING_OPS_MANAGER ||
    w.currentStatus === WorkflowStatus.AWAITING_EQUIP_MANAGER
  ).length;
  const criticalStock = stock.filter(s => s.quantityOnHand < s.minStockLevel).length;

  const canRequestStock = [
    UserRole.Admin,
    UserRole.OperationsManager,
    UserRole.SiteManager,
    UserRole.ProjectManager,
    UserRole.StockController,
  ].includes(user.role);

  const newRequestButton = canRequestStock ? (
    <button
        onClick={() => openForm('StockRequest')}
        className="px-4 py-2 text-sm bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors"
    >
        New Stock Request
    </button>
  ) : null;

  return (
    <>
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Active Requests" value={activeRequests} icon={<ClipboardListIcon />} />
        <MetricCard title="Pending Approvals" value={pendingApprovals} icon={<ClockIcon />} />
        <MetricCard title="Critical Stock" value={criticalStock} icon={<AlertTriangleIcon />} />
        <MetricCard title="Workflow Efficiency" value="92.5%" icon={<TrendingUpIcon />} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Workflows */}
        <div className="lg:col-span-3">
            <Card title="Recent Workflow Activity" padding="p-0" icon={newRequestButton}>
                <div className="divide-y divide-zinc-200">
                    {workflows.slice(0, 5).map((wf: WorkflowRequest) => (
                        <div key={wf.id} className="p-6 hover:bg-zinc-50 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedWorkflow(wf)}
                                        className="font-bold text-sky-600 hover:underline focus:outline-none"
                                    >
                                        {wf.requestNumber}
                                    </button>
                                    <p className="text-sm text-zinc-500">
                                        Requested by {wf.requester} for {wf.projectCode}
                                    </p>
                                </div>
                                {getPriorityChip(wf.priority)}
                            </div>
                             <WorkflowStatusIndicator
                                steps={wf.steps}
                                currentStep={wf.currentStatus}
                            />
                        </div>
                    ))}
                     {workflows.length === 0 && <div className="p-6 text-center text-zinc-500">No recent workflow activity.</div>}
                </div>
            </Card>
        </div>
      </div>
    </div>
      {selectedWorkflow && (
        <WorkflowDetailModal
            user={user}
            workflow={selectedWorkflow}
            onClose={() => setSelectedWorkflow(null)}
            onUpdate={() => {
                setSelectedWorkflow(null);
                queryClient.invalidateQueries({ queryKey: ['workflows'] });
            }}
        />
      )}
    </>
  );
};

export default Dashboard;
