import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OpsSidebar from './OpsSidebar';
import OpsHeader from './OpsHeader';
import Dashboard from './Dashboard';
import WorkflowList from './WorkflowList';
import StockManagement from './StockManagement';
import Reports from './Reports';
import Users from './Users';
import ResetPassword from './ResetPassword';
import Requests from './Requests';
import Picking from './Picking';
import Deliveries from './Deliveries';
import EquipmentManager from './EquipmentManager';
import RejectedRequests from './RejectedRequests';
import Sites from './Sites';
import Departments from './Departments';
import StockReceipts from './StockReceipts';
import MyDeliveries from './MyDeliveries';
import SalvagePage from './SalvagePage';
import InspectionReport from './InspectionReport';
import MyInspections from './MyInspections';
import StockReports from './StockReports';
import PRForm from './forms/PRForm';
import GateReleaseForm from './forms/GateReleaseForm';
import StockRequestForm from './forms/StockRequestForm';
import EPODForm from './forms/EPODForm';
import StockIntakeForm from './forms/StockIntakeForm';
import SalvageBookingForm from './forms/SalvageBookingForm';
import { View, FormType, User, UserRole, WorkflowRequest, StockItem, getMappedRole } from '../../types';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ─── Role-based view permissions ──────────────────────────────────────────────
const viewPermissions: Partial<Record<UserRole, View[]>> = {
  [UserRole.Admin]: ['Dashboard', 'Workflows', 'StockReceipts', 'Requests', 'EquipmentManager', 'RejectedRequests', 'Picking', 'Deliveries', 'MyDeliveries', 'InspectionReport', 'MyInspections', 'Salvage', 'Stock', 'Sites', 'Stores', 'Users', 'Reports', 'StockReports'],
  [UserRole.OperationsManager]: ['Dashboard', 'Workflows', 'StockReceipts', 'Requests', 'EquipmentManager', 'RejectedRequests', 'Picking', 'Deliveries', 'MyDeliveries', 'InspectionReport', 'MyInspections', 'Salvage', 'Stock', 'Sites', 'Reports'],
  [UserRole.EquipmentManager]: ['Dashboard', 'Workflows', 'StockReceipts', 'Requests', 'EquipmentManager', 'RejectedRequests', 'InspectionReport', 'MyInspections', 'Salvage', 'Stock', 'Reports'],
  [UserRole.StockController]: ['Dashboard', 'Workflows', 'StockReceipts', 'Requests', 'RejectedRequests', 'Picking', 'InspectionReport', 'MyInspections', 'Salvage', 'Stock', 'StockReports'],
  [UserRole.Storeman]: ['Dashboard', 'Workflows', 'Stock', 'Picking'],
  [UserRole.SiteManager]: ['Dashboard', 'Workflows', 'Requests', 'MyDeliveries', 'Deliveries', 'InspectionReport', 'MyInspections', 'Stock'],
  [UserRole.ProjectManager]: ['Dashboard', 'Workflows', 'Requests', 'MyDeliveries', 'Deliveries', 'InspectionReport', 'MyInspections', 'Stock'],
  [UserRole.Driver]: ['Dashboard', 'Workflows', 'Deliveries', 'InspectionReport', 'MyInspections'],
  [UserRole.Security]: ['Dashboard', 'Workflows', 'Deliveries'],
};

const getDefaultView = (role: string): View => {
  const mapped = getMappedRole(role as UserRole);
  const allowed = viewPermissions[mapped] ?? ['Dashboard'];
  return allowed.includes('Dashboard') ? 'Dashboard' : allowed[0] ?? 'Dashboard';
};

const canAccessView = (role: string, view: View): boolean => {
  return viewPermissions[getMappedRole(role as UserRole)]?.includes(view) ?? false;
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  user: User;
  onSwitchToFleet?: () => void;
  onLogout: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const OperationsModule: React.FC<Props> = ({ user, onSwitchToFleet, onLogout }) => {
  const [currentView, setCurrentView] = useState<View>(() => getDefaultView(user.role));
  const [activeForm, setActiveForm] = useState<{ type: FormType; context?: any } | null>(null);
  const [showInspectionToast, setShowInspectionToast] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigateTo = (view: View) => {
    if (view !== 'MyInspections') setShowInspectionToast(false);
    setCurrentView(view);
  };

  const openForm = (type: FormType, context?: any) => setActiveForm({ type, context });
  const closeForm = () => setActiveForm(null);

  const handleInspectionSuccess = () => {
    setShowInspectionToast(true);
    setCurrentView('MyInspections');
  };

  const renderView = () => {
    if (!canAccessView(user.role, currentView)) {
      return <Dashboard openForm={openForm} user={user} navigateTo={navigateTo} />;
    }
    switch (currentView) {
      case 'Dashboard':       return <Dashboard openForm={openForm} user={user} navigateTo={navigateTo} />;
      case 'Workflows':       return <WorkflowList user={user} />;
      case 'StockReceipts':   return <StockReceipts openForm={openForm} user={user} />;
      case 'Requests':        return <Requests user={user} openForm={openForm} />;
      case 'EquipmentManager': return <EquipmentManager user={user} />;
      case 'RejectedRequests': return <RejectedRequests user={user} />;
      case 'Picking':         return <Picking user={user} />;
      case 'Deliveries':      return <Deliveries user={user} openForm={openForm} />;
      case 'MyDeliveries':    return <MyDeliveries user={user} />;
      case 'Salvage':         return <SalvagePage user={user} />;
      case 'Stock':           return <StockManagement user={user} openForm={openForm} />;
      case 'Sites':           return <Sites />;
      case 'Stores':          return <Departments />;
      case 'Reports':         return <Reports user={user} />;
      case 'StockReports':    return <StockReports user={user} />;
      case 'Users':           return <Users />;
      case 'InspectionReport': return <InspectionReport user={user} onSuccess={handleInspectionSuccess} />;
      case 'MyInspections':   return (
        <MyInspections
          user={user}
          showSuccessToast={showInspectionToast}
          onDismissToast={() => setShowInspectionToast(false)}
          onCreateNew={() => navigateTo('InspectionReport')}
        />
      );
      default: return <Dashboard openForm={openForm} user={user} navigateTo={navigateTo} />;
    }
  };

  const renderFormModal = () => {
    if (!activeForm) return null;
    const formProps = { user, onSuccess: closeForm, onCancel: closeForm };
    switch (activeForm.type) {
      case 'StockRequest':   return <StockRequestForm {...formProps} />;
      case 'StockIntake':    return <StockIntakeForm {...formProps} />;
      case 'GateRelease':    return <GateReleaseForm {...formProps} workflow={activeForm.context as WorkflowRequest} />;
      case 'EPOD':           return <EPODForm {...formProps} workflow={activeForm.context as WorkflowRequest} />;
      case 'SalvageBooking': {
        const ctx = activeForm.context as StockItem | { stockItem: StockItem; maxQuantity?: number; workflowId?: string };
        if ((ctx as any)?.stockItem) {
          const { stockItem, maxQuantity, workflowId } = ctx as { stockItem: StockItem; maxQuantity?: number; workflowId?: string };
          return <SalvageBookingForm {...formProps} stockItem={stockItem} maxQuantity={maxQuantity} workflowId={workflowId} />;
        }
        return <SalvageBookingForm {...formProps} stockItem={ctx as StockItem} />;
      }
      case 'ReturnIntake':   return <StockIntakeForm {...formProps} returnWorkflow={activeForm.context as WorkflowRequest} />;
      case 'PR':             return <PRForm {...formProps} />;
      default:               return null;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-zinc-100 font-sans overflow-hidden">
        <OpsSidebar
          user={user}
          currentView={currentView}
          setCurrentView={navigateTo}
          collapsed={isSidebarCollapsed}
          onToggle={() => setSidebarCollapsed(prev => !prev)}
          viewPermissions={viewPermissions}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <OpsHeader
            user={user}
            onLogout={onLogout}
            onSwitchToFleet={onSwitchToFleet}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-100 p-4 md:p-8">
            {renderView()}
          </main>
          {activeForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
              <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-lg">
                {renderFormModal()}
              </div>
            </div>
          )}
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default OperationsModule;
