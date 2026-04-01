import React, { useEffect, useState } from 'react';
import Card from '../Card';
import { User, WorkflowRequest, WorkflowStatus } from '../../../types';
import { supabase } from '../../../supabase/client';
import { sendApprovalWebhook } from '../../../services/webhookService';
import SignaturePad from '../SignaturePad';

interface EPODFormProps {
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

const EPODForm: React.FC<EPODFormProps> = ({ user, workflow, onSuccess, onCancel }) => {
    const [recipientName, setRecipientName] = useState('');
    const [recipientSignature, setRecipientSignature] = useState<string | null>(null);
    const [deliveryPhoto, setDeliveryPhoto] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const draftKey = workflow ? `enprotec:epodDraft:${workflow.id}` : null;

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
            const parsed = JSON.parse(raw) as { recipientName?: string; recipientSignature?: string | null };
            if (parsed.recipientName) setRecipientName(parsed.recipientName);
            if (parsed.recipientSignature !== undefined) setRecipientSignature(parsed.recipientSignature);
        } catch (err) {
            console.warn('Failed to load EPOD draft', err);
        }
    };

    const saveDraft = () => {
        if (!draftKey || typeof window === 'undefined') return;
        const payload = {
            recipientName,
            recipientSignature,
            savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
        alert('Draft saved. You can reopen this form to continue.');
    };

    useEffect(() => {
        setRecipientName('');
        setRecipientSignature(null);
        setDeliveryPhoto(null);
        loadDraft();
    }, [workflow]);

    const dataUrlToBlob = (dataUrl: string): Blob => {
        const [header, base64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    };

    const uploadSignature = async () => {
        if (!workflow || !recipientSignature) return null;
        const blob = dataUrlToBlob(recipientSignature);
        const path = `signatures/epod/${workflow.id}/recipient-signature.png`;
        const { error: uploadError } = await supabase.storage
            .from('Enprotec')
            .upload(path, blob, { contentType: 'image/png', upsert: true });
        if (uploadError) {
            throw new Error(uploadError.message);
        }
        const { data } = supabase.storage.from('Enprotec').getPublicUrl(path);
        return { url: data.publicUrl, fileName: 'recipient-signature.png' };
    };

    const uploadPhoto = async () => {
        if (!workflow || !deliveryPhoto) return null;
        const safeName = deliveryPhoto.name.replace(/\s+/g, '-');
        const path = `deliveries/${workflow.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
            .from('Enprotec')
            .upload(path, deliveryPhoto, { cacheControl: '3600', upsert: true });
        if (uploadError) {
            throw new Error(`Failed to upload ${deliveryPhoto.name}: ${uploadError.message}`);
        }
        const { data } = supabase.storage.from('Enprotec').getPublicUrl(path);
        return { url: data.publicUrl, fileName: deliveryPhoto.name };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!workflow) {
            setError("No associated workflow request found.");
            return;
        }
        if (!recipientSignature) {
            setError('Please capture the recipient signature before confirming.');
            return;
        }

        setLoading(true);

        try {
            const uploads: { url: string; fileName: string }[] = [];
            const photo = await uploadPhoto();
            if (photo) uploads.push(photo);
            const signature = await uploadSignature();
            if (signature) uploads.push(signature);

            const newStatus = WorkflowStatus.EPOD_CONFIRMED;
            const { error: updateError } = await supabase
                .from('enprotec_workflow_requests')
                .update({ current_status: newStatus })
                .eq('id', workflow.id);

            if (updateError) throw updateError;
            
            if (uploads.length > 0) {
                const { error: attachmentError } = await supabase
                    .from('enprotec_workflow_attachments')
                    .insert(
                        uploads.map(doc => ({
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
                `Delivery confirmed by recipient: ${recipientName}.`
            );
            
            setRecipientSignature(null);
            setDeliveryPhoto(null);
            clearDraft();
            onSuccess();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during confirmation.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Electronic Proof of Delivery (EPOD)">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Section 1: Delivery Information */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Delivery Confirmation</legend>
                    <FormRow>
                        <FormLabel htmlFor="workflowNumber">Internal Request #</FormLabel>
                        <FormInput id="workflowNumber" type="text" value={workflow?.requestNumber || ''} readOnly />
                    </FormRow>
                    <div className="md:col-span-3">
                        <p className="text-sm font-medium text-zinc-700">Items Delivered:</p>
                        <ul className="text-sm list-disc list-inside text-zinc-600">
                            {workflow?.items.map(item => (
                                <li key={item.partNumber}>{item.quantityRequested} x {item.description} ({item.partNumber})</li>
                            ))}
                        </ul>
                    </div>
                </fieldset>

                {/* Section 2: Condition Assessment */}
                 <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Condition Assessment</legend>
                    <FormRow>
                        <FormLabel htmlFor="condition">Items Condition</FormLabel>
                        <div className="md:col-span-2 flex items-center space-x-6">
                            <label className="flex items-center">
                                <input type="radio" name="condition" value="good" className="h-4 w-4 text-sky-600 bg-zinc-100 border-zinc-300 focus:ring-sky-500" defaultChecked />
                                <span className="ml-2 text-zinc-800">All Good</span>
                            </label>
                             <label className="flex items-center">
                                <input type="radio" name="condition" value="damaged" className="h-4 w-4 text-sky-600 bg-zinc-100 border-zinc-300 focus:ring-sky-500" />
                                <span className="ml-2 text-zinc-800">Damaged / Discrepancy</span>
                            </label>
                        </div>
                    </FormRow>
                </fieldset>

                {/* Section 3: Recipient Confirmation */}
                 <fieldset className="space-y-4">
                     <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Recipient Confirmation</legend>
                    <FormRow>
                        <FormLabel htmlFor="recipientName">Recipient Name</FormLabel>
                        <FormInput id="recipientName" type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Enter full name of recipient" required />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="deliveryPhoto">Attach Proof Photo</FormLabel>
                        <input
                            id="deliveryPhoto"
                            type="file"
                            accept="image/*"
                            onChange={e => setDeliveryPhoto(e.target.files?.[0] ?? null)}
                            className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400 file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                        />
                    </FormRow>
                    {deliveryPhoto && (
                        <p className="text-xs text-zinc-500 md:col-span-3">Selected: {deliveryPhoto.name}</p>
                    )}
                    <SignaturePad
                        label="Recipient Signature"
                        value={recipientSignature}
                        onChange={setRecipientSignature}
                        disabled={loading}
                        height={140}
                    />
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
                        {loading ? 'Confirming...' : 'Confirm Delivery'}
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default EPODForm;
