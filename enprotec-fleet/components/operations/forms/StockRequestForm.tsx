import React, { useState, useEffect, useMemo } from 'react';
import Card from '../Card';
import { getMappedRole, User, Priority, WorkflowStatus, WorkflowRequest, Store, Site, UserRole } from '../../../types';
import { supabase } from '../../../supabase/client';
import Select from 'react-select';
import { Database } from '../../supabase/database.types';
import { sendApprovalWebhook } from '../../../services/webhookService';
import { stockService } from '../../../services/stockService';

type StockItemInsert = Database['public']['Tables']['enprotec_stock_items']['Insert'];
type WorkflowRequestInsert = Database['public']['Tables']['enprotec_workflow_requests']['Insert'];
type WorkflowItemInsert = Database['public']['Tables']['enprotec_workflow_items']['Insert'];
type WorkflowCommentInsert = Database['public']['Tables']['enprotec_workflow_comments']['Insert'];

const STOCK_ITEMS_ERROR_MESSAGE = 'Could not load stock items for the selected store.';


interface StockRequestFormProps {
    user: User;
    onSuccess: () => void;
    onCancel: () => void;
}

const customSelectStyles = {
    control: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: '#ffffff', // white
        borderColor: state.isFocused ? '#0ea5e9' : '#d4d4d8', // sky-500, zinc-300
        boxShadow: state.isFocused ? '0 0 0 1px #0ea5e9' : 'none',
        '&:hover': {
            borderColor: '#a1a1aa', // zinc-400
        },
    }),
    menu: (provided: any) => ({
        ...provided,
        backgroundColor: '#ffffff', // white
        border: '1px solid #e4e4e7', // zinc-200
    }),
    option: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: state.isSelected
            ? '#0ea5e9' // sky-500
            : state.isFocused
                ? '#f4f4f5' // zinc-100
                : '#ffffff', // white
        color: state.isSelected ? '#ffffff' : '#18181b', // white, zinc-900
        '&:active': {
            backgroundColor: '#0284c7', // sky-600
        },
    }),
    singleValue: (provided: any) => ({
        ...provided,
        color: '#18181b', // zinc-900
    }),
    input: (provided: any) => ({
        ...provided,
        color: '#18181b', // zinc-900
    }),
    placeholder: (provided: any) => ({
        ...provided,
        color: '#71717a', // zinc-500
    }),
};

const FormRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-center">{children}</div>
);

const FormLabel: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="font-medium text-zinc-700 text-sm">{children}</label>
);

const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400" />
);

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900" />
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400" />
);

const StockRequestForm: React.FC<StockRequestFormProps> = ({ user, onSuccess, onCancel }) => {
    const [department, setStore] = useState<Store | ''>('');
    const [destinationSite, setDestinationSite] = useState('');
    const [requiredDate, setRequiredDate] = useState('');
    const [priority, setPriority] = useState<Priority>(Priority.Medium);
    const [items, setItems] = useState([{ partNumber: '', quantity: '' }]);
    const [comment, setComment] = useState('');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [availableStockItems, setAvailableStockItems] = useState<{ value: string; label: string; quantityOnHand: number | null; }[]>([]);
    const [stockLoading, setStockLoading] = useState(false);

    const [allActiveSites, setAllActiveSites] = useState<Site[]>([]);
    const [sitesLoading, setSitesLoading] = useState(true);

    const userStores = user.departments || [];

    const visibleSites = useMemo(() => {
        // Admin has access to all sites
        if (getMappedRole(user.role) === UserRole.Admin) {
            return allActiveSites;
        }

        // All other users must have sites explicitly assigned
        const userSites = user.sites || [];

        // If user has no sites assigned, they cannot request from any site
        if (userSites.length === 0) {
            return [];
        }

        // Return only sites the user has been assigned
        return allActiveSites.filter(site => userSites.includes(site.name));
    }, [user, allActiveSites]);

    useEffect(() => {
        if (visibleSites.length === 1) {
            setDestinationSite(visibleSites[0].id);
        }
    }, [visibleSites]);


    useEffect(() => {
        const fetchSites = async () => {
            setSitesLoading(true);

            const sitesRes = await supabase
                .from('enprotec_sites')
                .select('id, name')
                .eq('status', 'Active')
                .order('name');

            if (sitesRes.error) {
                console.error("Failed to fetch sites", sitesRes.error);
                setError(prev => (prev ? `${prev} Could not load destination sites.` : "Could not load destination sites."));
            } else {
                setAllActiveSites((sitesRes.data as any[]) || []);
            }

            setSitesLoading(false);
        };

        fetchSites();
    }, []);

    useEffect(() => {
        if (!department) {
            setAvailableStockItems([]);
            setStockLoading(false);
            setError(prev => (prev === STOCK_ITEMS_ERROR_MESSAGE ? '' : prev));
            return;
        }

        const fetchStockItems = async () => {
            setStockLoading(true);
            setAvailableStockItems([]);

            const stockItemsRes = await supabase
                .from('enprotec_stock_view')
                .select('partNumber, description, quantityOnHand')
                .eq('store', department)
                .order('partNumber');

            if (stockItemsRes.error) {
                console.error("Failed to fetch stock items for store", stockItemsRes.error);
                setError(prev => (prev ? prev : STOCK_ITEMS_ERROR_MESSAGE));
            } else {
                const formattedStock = (stockItemsRes.data as any[]).map(item => ({
                    value: item.partNumber,
                    label: `${item.partNumber} (${item.description || 'No description'})`,
                    quantityOnHand: typeof item.quantityOnHand === 'number' ? item.quantityOnHand : null,
                }));
                setAvailableStockItems(formattedStock || []);
                setError(prev => (prev === STOCK_ITEMS_ERROR_MESSAGE ? '' : prev));
            }

            setStockLoading(false);
        };

        fetchStockItems();
    }, [department]);

    const handleItemChange = (index: number, field: 'partNumber' | 'quantity', value: string) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const getQuantityOnHandForPart = (partNumber: string) => {
        const option = availableStockItems.find(opt => opt.value === partNumber);
        return option?.quantityOnHand ?? null;
    };

    const handleAddItem = () => {
        setItems([...items, { partNumber: '', quantity: '' }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachmentFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 0. Handle file upload first
            let attachmentUrl: string | null = null;
            if (attachmentFile) {
                const fileExt = attachmentFile.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('Enprotec') // *** UPDATED BUCKET NAME ***
                    .upload(fileName, attachmentFile);

                if (uploadError) {
                    // Provide a more specific error message
                    throw new Error(`Attachment upload failed: ${uploadError.message}`);
                }

                const { data } = supabase.storage.from('Enprotec').getPublicUrl(fileName); // *** UPDATED BUCKET NAME ***
                attachmentUrl = data.publicUrl;
            }

            // 1. Validate items and get their IDs
            const partNumbers = items.map(i => i.partNumber).filter(Boolean);
            if (partNumbers.length === 0) {
                throw new Error("Please add at least one item to the request.");
            }
            if (!department) {
                throw new Error("Please select a store for this request.");
            }
            const { data: stockItems, error: stockError } = await supabase
                .from('enprotec_stock_items')
                .select('id, part_number')
                .in('part_number', partNumbers);

            if (stockError) throw stockError;
            if (!stockItems) throw new Error("Could not find stock items for validation.");

            if (stockItems.length !== partNumbers.length) {
                const foundNumbers = (stockItems as any[]).map(si => si.part_number);
                const missing = partNumbers.filter(pn => !foundNumbers.includes(pn));
                throw new Error(`Invalid part numbers: ${missing.join(', ')}. Please check and try again.`);
            }
            const partNumberToIdMap = new Map((stockItems as any[]).map(si => [si.part_number, si.id]));

            // 2. Create the main workflow request using the atomic service
            const requestNumber = `IR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

            const requestItems = items.map(item => ({
                stock_item_id: partNumberToIdMap.get(item.partNumber)!,
                quantity: parseInt(item.quantity, 10)
            }));

            const result = await stockService.createStockRequest({
                requesterId: user.id,
                requestNumber: requestNumber,
                siteId: destinationSite,
                department: department,
                priority: priority,
                attachmentUrl: attachmentUrl,
                items: requestItems,
                comment: comment.trim()
            });

            // 5. Send webhook notification for new submission
            const currentStatus = WorkflowStatus.REQUEST_SUBMITTED;
            const webhookRequestPayload: Pick<WorkflowRequest, 'id' | 'requestNumber' | 'currentStatus' | 'requester_id' | 'department'> = {
                id: (result as any).request_id, // The RPC returns request_id
                requestNumber: requestNumber,
                currentStatus: currentStatus,
                requester_id: user.id,
                department: department,
            };

            await sendApprovalWebhook(
                'APPROVAL',
                webhookRequestPayload,
                currentStatus,
                user,
                comment.trim() || `New request submitted by ${user.name}.`
            );

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    return (
        <Card title="New Internal Stock Request">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Section 1: Basic Information */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Request Details</legend>
                    <FormRow>
                        <FormLabel htmlFor="requesterName">Requester Name</FormLabel>
                        <FormInput id="requesterName" type="text" value={user.name} readOnly />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="department">Store</FormLabel>
                        <FormSelect id="department" value={department} onChange={e => setStore(e.target.value as Store)} required disabled={userStores.length === 0}>
                            <option value="">{userStores.length === 0 ? 'No stores assigned' : 'Select a store...'}</option>
                            {userStores.map(dep => (
                                <option key={dep} value={dep}>{dep}</option>
                            ))}
                        </FormSelect>
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="destinationSite">Destination Site / Project</FormLabel>
                        <FormSelect id="destinationSite" value={destinationSite} onChange={e => setDestinationSite(e.target.value)} required disabled={sitesLoading || visibleSites.length === 0}>
                            <option value="">{sitesLoading ? 'Loading sites...' : (visibleSites.length === 0 ? 'No sites assigned to you' : 'Select a site...')}</option>
                            {visibleSites.map(site => (
                                <option key={site.id} value={site.id}>
                                    {site.name}
                                </option>
                            ))}
                        </FormSelect>
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="requiredDate">Date Required</FormLabel>
                        <FormInput id="requiredDate" type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} required />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="priority">Priority</FormLabel>
                        <FormSelect id="priority" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                            {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                        </FormSelect>
                    </FormRow>
                </fieldset>

                {/* Section 2: Items Requested */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Items Requested</legend>
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={index} className="p-4 border border-zinc-200 rounded-md bg-zinc-50/50 space-y-4 relative">
                                {items.length > 1 && (
                                    <button type="button" onClick={() => handleRemoveItem(index)} className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-start">
                                    <FormLabel htmlFor={`partNumber${index}`}>Part Number</FormLabel>
                                    <div className="md:col-span-2">
                                        <Select
                                            id={`partNumber${index}`}
                                            options={availableStockItems}
                                            value={availableStockItems.find(opt => opt.value === item.partNumber) || null}
                                            onChange={(selectedOption) => handleItemChange(index, 'partNumber', selectedOption ? selectedOption.value : '')}
                                            isLoading={stockLoading}
                                            isDisabled={!department || stockLoading}
                                            placeholder={
                                                !department
                                                    ? 'Select a store to load parts...'
                                                    : stockLoading
                                                        ? 'Loading parts...'
                                                        : (availableStockItems.length === 0
                                                            ? 'No parts available for this store'
                                                            : 'Select or search for a part...')
                                            }
                                            styles={customSelectStyles}
                                            required
                                        />
                                        {item.partNumber && (
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Qty on Hand: {getQuantityOnHandForPart(item.partNumber) ?? 'N/A'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <FormRow>
                                    <FormLabel htmlFor={`quantity${index}`}>Quantity</FormLabel>
                                    <FormInput id={`quantity${index}`} type="number" min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} placeholder="e.g., 5" required />
                                </FormRow>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={handleAddItem} className="text-sm text-sky-600 hover:text-sky-500 font-semibold">+ Add another item</button>
                </fieldset>

                {/* Section: Attachment */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Attachment (Optional)</legend>
                    <FormRow>
                        <FormLabel htmlFor="attachment">Attach Picture</FormLabel>
                        <div className="md:col-span-2">
                            <input
                                id="attachment"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                            />
                            {attachmentFile && <p className="text-xs text-zinc-500 mt-2">Selected: {attachmentFile.name}</p>}
                        </div>
                    </FormRow>
                </fieldset>

                {/* Section 3: Comments */}
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Comments / Special Instructions</legend>
                    <FormRow>
                        <FormLabel htmlFor="comment">Comment (Optional)</FormLabel>
                        <FormTextarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            placeholder="Add any additional notes or instructions for this request..."
                        />
                    </FormRow>
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-200">
                    <button type="button" onClick={onCancel} className="px-6 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors">
                        {loading ? 'Submitting...' : 'Submit Request for Approval'}
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default StockRequestForm;
