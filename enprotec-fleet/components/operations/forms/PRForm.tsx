import React from 'react';
import Card from '../Card';
import { User } from '../../../types';

interface PRFormProps {
    user: User;
    onSuccess: () => void;
    onCancel: () => void;
}

const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-center">{children}</div>
);

const FormLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="font-medium text-zinc-300 text-sm">{children}</label>
);

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className="md:col-span-2 p-2 bg-zinc-700 border border-zinc-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-100 placeholder:text-zinc-400" />
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} rows={3} className="md:col-span-2 p-2 bg-zinc-700 border border-zinc-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-100 placeholder:text-zinc-400" />
);


const PRForm: React.FC<PRFormProps> = ({ user, onSuccess, onCancel }) => {
    return (
        <Card title="New Purchase Requisition (PR)">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                {/* Section 1: Basic Information */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2 mb-4 w-full">Basic Information</legend>
                    <FormRow>
                        <FormLabel htmlFor="requesterName">Requester Name</FormLabel>
                        <FormInput id="requesterName" type="text" defaultValue={user.name} readOnly />
                    </FormRow>
                     <FormRow>
                        <FormLabel htmlFor="projectCode">Project Code</FormLabel>
                        <FormInput id="projectCode" type="text" placeholder="e.g., PROJ-ALPHA" />
                    </FormRow>
                </fieldset>

                {/* Section 2: Items Requested */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2 mb-4 w-full">Items Requested</legend>
                     <div className="space-y-4">
                        {/* Item 1 */}
                        <div className="p-4 border border-zinc-700 rounded-md bg-zinc-900/50 space-y-4">
                            <FormRow>
                                <FormLabel htmlFor="partNumber1">Part Number</FormLabel>
                                <FormInput id="partNumber1" type="text" placeholder="e.g., OEM-1234" />
                            </FormRow>
                             <FormRow>
                                <FormLabel htmlFor="quantity1">Quantity</FormLabel>
                                <FormInput id="quantity1" type="number" placeholder="e.g., 5" />
                            </FormRow>
                        </div>
                     </div>
                     <button type="button" className="text-sm text-sky-400 hover:text-sky-300 font-semibold">+ Add another item</button>
                </fieldset>

                {/* Section 3: Justification */}
                 <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-100 border-b border-zinc-700 pb-2 mb-4 w-full">Justification & Notes</legend>
                    <FormRow>
                        <FormLabel htmlFor="justification">Justification</FormLabel>
                        <FormTextarea id="justification" placeholder="Explain why these items are needed..." />
                    </FormRow>
                </fieldset>

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-700">
                     <button type="button" onClick={onCancel} className="px-6 py-2 bg-zinc-600 text-white font-semibold rounded-md hover:bg-zinc-500 transition-colors">
                        Cancel
                    </button>
                     <button type="submit" className="px-6 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-400 transition-colors">
                        Submit Request
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default PRForm;