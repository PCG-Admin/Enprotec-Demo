import React from 'react';
import { FormType, User, WorkflowRequest, View, UserRole } from '../types';
import PRForm from './forms/PRForm';
import GateReleaseForm from './forms/GateReleaseForm';
import StockRequestForm from './forms/StockRequestForm';
import EPODForm from './forms/EPODForm';
import StockIntakeForm from './forms/StockIntakeForm';
import SalvageBookingForm from './forms/SalvageBookingForm';
import FormsIcon from './icons/FormsIcon';

interface FormsProps {
    user: User;
    activeForm: FormType | null;
    setActiveForm: (form: FormType | null) => void;
    navigateTo: (view: View) => void;
    workflow: WorkflowRequest | null;
}

const Forms: React.FC<FormsProps> = ({ user, activeForm, setActiveForm, navigateTo, workflow }) => {
    const canReceiveStock = [UserRole.Admin, UserRole.StockController, UserRole.EquipmentManager].includes(user.role);

    const renderRestrictedMessage = () => (
        <div className="p-12 text-center bg-white border border-zinc-200 rounded-lg space-y-3">
            <h2 className="text-xl font-semibold text-zinc-900">Access Restricted</h2>
            <p className="text-sm text-zinc-500">
                Only Admin, Stock Controller, or Equipment Manager roles can process stock intake.
            </p>
            <button
                onClick={() => setActiveForm(null)}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
            >
                Close
            </button>
        </div>
    );

    const renderForm = () => {
        const handleSuccess = (formType: FormType, navigateBackTo: View | null = null) => {
            alert(`${formType.replace(/([A-Z])/g, ' $1').trim()} submitted successfully!`);
            setActiveForm(null);
            if (navigateBackTo) {
                navigateTo(navigateBackTo);
            }
        };

        const handleCancel = () => setActiveForm(null);

        switch (activeForm) {
            case 'PR':
                return <PRForm user={user} onSuccess={() => handleSuccess('PR')} onCancel={handleCancel} />;
            case 'GateRelease':
                return <GateReleaseForm user={user} workflow={workflow} onSuccess={() => handleSuccess('GateRelease', 'Deliveries')} onCancel={handleCancel} />;
            case 'StockRequest':
                return <StockRequestForm user={user} onSuccess={() => handleSuccess('StockRequest')} onCancel={handleCancel} />;
            case 'EPOD':
                return <EPODForm user={user} workflow={workflow} onSuccess={() => handleSuccess('EPOD', 'Deliveries')} onCancel={handleCancel} />;
            case 'StockIntake':
                if (!canReceiveStock) return renderRestrictedMessage();
                return <StockIntakeForm user={user} onSuccess={() => handleSuccess('StockIntake')} onCancel={handleCancel} />;
            case 'ReturnIntake':
                if (!canReceiveStock) return renderRestrictedMessage();
                 return <StockIntakeForm user={user} onSuccess={() => handleSuccess('StockIntake', 'Requests')} onCancel={handleCancel} returnWorkflow={workflow} />;
            case 'SalvageBooking':
                 // This form needs a stock item context, not a workflow context.
                 // This would be handled differently in a real app, but for now we'll assume context is managed outside.
                return <SalvageBookingForm user={user} onSuccess={() => handleSuccess('SalvageBooking', 'Stores')} onCancel={() => navigateTo('Stores')} stockItem={null} />;
            default:
                return (
                    <div className="text-center p-12 bg-zinc-800 rounded-lg border border-zinc-700">
                        <div className="mx-auto bg-zinc-700 rounded-full h-16 w-16 flex items-center justify-center">
                            <FormsIcon className="w-8 h-8 text-zinc-400" />
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-zinc-100">Forms Hub</h2>
                        <p className="mt-2 text-zinc-400">
                            Select a form to begin, or use a "Quick Action" from the dashboard.
                        </p>
                         <div className="mt-6 flex flex-wrap justify-center gap-4">
                            {canReceiveStock && (
                                <button onClick={() => setActiveForm('StockIntake')} className="px-4 py-2 bg-zinc-700 text-zinc-200 font-semibold rounded-md hover:bg-zinc-600 transition-colors">Receive New Stock</button>
                            )}
                            <button onClick={() => setActiveForm('StockRequest')} className="px-4 py-2 bg-zinc-700 text-zinc-200 font-semibold rounded-md hover:bg-zinc-600 transition-colors">New Stock Request</button>
                            <button onClick={() => setActiveForm('GateRelease')} className="px-4 py-2 bg-zinc-700 text-zinc-200 font-semibold rounded-md hover:bg-zinc-600 transition-colors">New Gate Release</button>
                            <button onClick={() => setActiveForm('EPOD')} className="px-4 py-2 bg-zinc-700 text-zinc-200 font-semibold rounded-md hover:bg-zinc-600 transition-colors">Submit EPOD</button>
                        </div>
                    </div>
                );
        }
    };

    return <div className="space-y-6">{renderForm()}</div>;
};

export default Forms;
