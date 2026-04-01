import React, { useState, useEffect } from 'react';
import Card from '../Card';
import { User, WorkflowRequest, WorkflowStatus } from '../../../types';
import { supabase } from '../../../supabase/client';
import CommentSection from '../CommentSection';
import { sendApprovalWebhook, sendDispatchWebhook } from '../../../services/webhookService';
import SignaturePad from '../SignaturePad';

interface GateReleaseFormProps {
    user: User;
    workflow: WorkflowRequest | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-center">{children}</div>
);

const FormLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="font-medium text-zinc-700 text-sm">{children}</label>
);

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400" />
);

const GateReleaseForm: React.FC<GateReleaseFormProps> = ({ user, workflow, onSuccess, onCancel }) => {
    const [driverName, setDriverName] = useState('');
    const [vehicleReg, setVehicleReg] = useState('');
    const [documents, setDocuments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [driverSignature, setDriverSignature] = useState<string | null>(null);
    const [gateSignature, setGateSignature] = useState<string | null>(null);
    const draftKey = workflow ? `enprotec:gateReleaseDraft:${workflow.id}` : null;

    const clearDraft = () => {
        if (!draftKey) return;
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(draftKey);
        }
    };

    const loadDraft = () => {
        if (!draftKey || typeof window === 'undefined') return;
        const raw = window.localStorage.getItem(draftKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as {
                driverName?: string;
                vehicleReg?: string;
                driverSignature?: string | null;
                gateSignature?: string | null;
            };
            if (parsed.driverName) setDriverName(parsed.driverName);
            if (parsed.vehicleReg) setVehicleReg(parsed.vehicleReg);
            if (parsed.driverSignature !== undefined) setDriverSignature(parsed.driverSignature);
            if (parsed.gateSignature !== undefined) setGateSignature(parsed.gateSignature);
        } catch (err) {
            console.warn('Failed to load draft gate release form', err);
        }
    };

    const saveDraft = () => {
        if (!draftKey || typeof window === 'undefined') return;
        const payload = {
            driverName,
            vehicleReg,
            driverSignature,
            gateSignature,
            savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
        alert('Draft saved. You can reopen this form to continue.');
    };

    useEffect(() => {
        if (workflow) {
            setDriverName(workflow.driverName || '');
            setVehicleReg(workflow.vehicleRegistration || '');
        } else {
            setDriverName('');
            setVehicleReg('');
        }
        setDocuments([]);
        setDriverSignature(null);
        setGateSignature(null);
        loadDraft();
    }, [workflow]);

    const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        setDocuments(files);
    };

    const dataUrlToBlob = (dataUrl: string): Blob => {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    };

    const uploadSignature = async (fileName: string, dataUrl: string) => {
        if (!workflow) throw new Error('No workflow available for signature upload.');
        const blob = dataUrlToBlob(dataUrl);
        const path = `signatures/gate-release/${workflow.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage
            .from('Enprotec')
            .upload(path, blob, { contentType: 'image/png', upsert: true });

        if (uploadError) {
            throw new Error(uploadError.message);
        }

        const { data } = supabase.storage.from('Enprotec').getPublicUrl(path);
        return { url: data.publicUrl, fileName };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!workflow) {
            setError("No associated workflow request found.");
            return;
        }
        const trimmedDriver = driverName.trim();
        const trimmedReg = vehicleReg.trim();
        if (!trimmedDriver || !trimmedReg) {
            setError('Please provide both driver name and vehicle registration.');
            return;
        }
        if (!driverSignature || !gateSignature) {
            setError('Please capture both driver and gate/security signatures.');
            return;
        }

        setLoading(true);

        try {
            const uploadedDocs: { url: string; fileName: string }[] = [];
            for (const [index, doc] of documents.entries()) {
                const safeName = doc.name.replace(/\s+/g, '-');
                const filePath = `deliveries/${workflow.id}/${Date.now()}-${index}-${safeName}`;
                const { error: uploadError } = await supabase.storage
                    .from('Enprotec')
                    .upload(filePath, doc);
                if (uploadError) {
                    throw new Error(`Failed to upload ${doc.name}: ${uploadError.message}`);
                }
                const { data } = supabase.storage.from('Enprotec').getPublicUrl(filePath);
                uploadedDocs.push({ url: data.publicUrl, fileName: doc.name });
            }

            const signatureUploads = [
                await uploadSignature('driver-signature.png', driverSignature),
                await uploadSignature('security-signature.png', gateSignature),
            ];

            const newStatus = WorkflowStatus.DISPATCHED;
            const { error: updateError } = await supabase
                .from('enprotec_workflow_requests')
                .update({
                    current_status: newStatus,
                    driver_name: trimmedDriver,
                    vehicle_registration: trimmedReg,
                })
                .eq('id', workflow.id);

            if (updateError) throw updateError;

            const attachments = [...uploadedDocs, ...signatureUploads];

            if (attachments.length > 0) {
                const { error: attachmentError } = await supabase
                    .from('enprotec_workflow_attachments')
                    .insert(
                        attachments.map(doc => ({
                            workflow_request_id: workflow.id,
                            attachment_url: doc.url,
                            file_name: doc.fileName,
                        }))
                    );
                if (attachmentError) throw attachmentError;
            }

            await sendApprovalWebhook(
                'APPROVAL',
                workflow,
                newStatus,
                user,
                `Dispatched by ${trimmedDriver} in vehicle ${trimmedReg}.`
            );

            // Send dispatch notification webhook
            await sendDispatchWebhook(
                { ...workflow, driverName: trimmedDriver, vehicleRegistration: trimmedReg },
                user
            );

            setDocuments([]);
            setDriverSignature(null);
            setGateSignature(null);
            clearDraft();
            onSuccess();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during dispatch.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="New Gate Release / Dispatch Form">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Section 1: Vehicle & Driver Information */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Dispatch Information</legend>
                    <FormRow>
                        <FormLabel htmlFor="destinationSite">Destination Site / Project</FormLabel>
                        <FormInput id="destinationSite" type="text" value={workflow?.projectCode || ''} readOnly />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="driverName">Driver Name</FormLabel>
                        <FormInput id="driverName" type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Enter driver's full name" required />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="vehicleReg">Vehicle Registration</FormLabel>
                        <FormInput id="vehicleReg" type="text" value={vehicleReg} onChange={e => setVehicleReg(e.target.value)} placeholder="e.g., AB12 CDE" required />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="delivery-docs">Delivery Documents</FormLabel>
                        <div className="md:col-span-2">
                            <input
                                id="delivery-docs"
                                type="file"
                                multiple
                                onChange={handleDocumentChange}
                                className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                                accept=".pdf,image/*"
                            />
                            {documents.length > 0 && (
                                <ul className="mt-2 text-xs text-zinc-500 list-disc list-inside space-y-1">
                                    {documents.map(file => (
                                        <li key={file.name}>{file.name}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </FormRow>
                </fieldset>

                {/* Section 2: Items Being Released */}
                 <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Items Being Released</legend>
                    <div className="p-4 border border-zinc-200 rounded-md bg-zinc-50/50 space-y-2">
                         <FormRow>
                            <FormLabel htmlFor="workflowNumber">Internal Request #</FormLabel>
                            <FormInput id="workflowNumber" type="text" value={workflow?.requestNumber || ''} readOnly />
                        </FormRow>
                        <div className="md:col-span-3">
                            <ul className="text-sm list-disc list-inside text-zinc-700">
                                {workflow?.items.map(item => (
                                    <li key={item.partNumber}>{item.quantityRequested} x {item.description} ({item.partNumber})</li>
                                ))}
                            </ul>
                        </div>
                     </div>
                </fieldset>
                
                 {/* Section: Comments */}
                {workflow && (
                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Comments & History</legend>
                        <CommentSection workflowId={workflow.id} user={user} />
                    </fieldset>
                )}


                {/* Section 3: Authorization */}
                 <fieldset className="space-y-4">
                     <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Authorization Signatures</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SignaturePad
                            label="Driver Signature"
                            value={driverSignature}
                            onChange={setDriverSignature}
                            disabled={loading}
                            height={140}
                        />
                        <SignaturePad
                            label="Gate/Security Signature"
                            value={gateSignature}
                            onChange={setGateSignature}
                            disabled={loading}
                            height={140}
                        />
                    </div>
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-200">
                    <button
                        type="button"
                        onClick={saveDraft}
                        disabled={loading || !workflow}
                        className="px-4 py-2 bg-white border border-zinc-300 text-zinc-800 font-semibold rounded-md hover:bg-zinc-50 disabled:bg-zinc-200 transition-colors"
                    >
                        Save Draft
                    </button>
                    <button type="button" onClick={onCancel} className="px-6 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 transition-colors">
                        Cancel
                    </button>
                     <button type="submit" disabled={loading || !workflow} className="px-6 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors">
                        {loading ? 'Dispatching...' : 'Dispatch Items'}
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default GateReleaseForm;
