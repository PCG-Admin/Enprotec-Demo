import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card from '../Card';
import { getMappedRole, StoreType, User, WorkflowRequest, UserRole, Store, departmentToStoreMap, WorkflowStatus, Department } from '../../../types';
import { supabase } from '../../../supabase/client';
import { Database } from '../../supabase/database.types';
import Select from 'react-select';
import { stockService } from '../../../services/stockService';
import { fetchActiveDepartments } from '../../../services/departmentService';

type StockItemRow = Database['public']['Tables']['enprotec_stock_items']['Row'];
type InventoryRow = Database['public']['Tables']['enprotec_inventory']['Row'];


interface StockIntakeFormProps {
    user: User;
    onSuccess: () => void;
    onCancel: () => void;
    returnWorkflow?: WorkflowRequest | null;
}

type IntakeType = 'existing' | 'new' | 'return';

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
    <input {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400 disabled:bg-zinc-100" />
);

const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 disabled:bg-zinc-100" />
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400 disabled:bg-zinc-100" />
);

const StockIntakeForm: React.FC<StockIntakeFormProps> = ({ user, onSuccess, onCancel, returnWorkflow }) => {
    const [intakeType, setIntakeType] = useState<IntakeType>(returnWorkflow ? 'return' : 'existing');


    const [selectedStockItemId, setSelectedStockItemId] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [description, setDescription] = useState('');
    const [minStockLevel, setMinStockLevel] = useState('0');

    const [quantity, setQuantity] = useState('');
    const [store, setStore] = useState<StoreType | ''>(returnWorkflow ? StoreType.Operations : '');
    const [location, setLocation] = useState('');
    const [deliveryNotePO, setDeliveryNotePO] = useState('');
    const [comments, setComments] = useState('');
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
    const [attachmentInputKey, setAttachmentInputKey] = useState(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableStores, setAvailableStores] = useState<Department[]>([]);

    const isReturnMode = intakeType === 'return';

    // Fetch available stores from database
    useEffect(() => {
        const loadStores = async () => {
            try {
                const departments = await fetchActiveDepartments();
                setAvailableStores(departments);
            } catch (err) {
                console.error('Failed to load stores:', err);
                setAvailableStores([]);
            }
        };
        loadStores();
    }, []);

    const visibleStores = useMemo(() => {
        // If stores haven't loaded yet from database, use enum fallback
        if (availableStores.length === 0) {
            if (getMappedRole(user.role) === UserRole.Admin || !user.departments || user.departments.length === 0) {
                return Object.values(StoreType);
            }
            return user.departments.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);
        }

        // Use database stores
        if (getMappedRole(user.role) === UserRole.Admin || !user.departments || user.departments.length === 0) {
            return availableStores.map(dept => dept.code as StoreType);
        }

        // Filter to user's assigned departments
        const userDeptCodes = user.departments || [];
        const filtered = availableStores
            .filter(dept => userDeptCodes.includes(dept.code as Store))
            .map(dept => dept.code as StoreType);
        return [...new Set(filtered)];
    }, [user, availableStores]);

    useEffect(() => {
        if (visibleStores.length === 1 && !isReturnMode) {
            setStore(visibleStores[0]);
        }
    }, [visibleStores]);

    useEffect(() => {
        if (intakeType === 'return' && attachmentFile) {
            setAttachmentFile(null);
            setAttachmentInputKey((prev) => prev + 1);
        }
    }, [intakeType, attachmentFile]);

    const { data: availableStockItems = [], isLoading: stockLoading, isError: stockItemsError } = useQuery({
        queryKey: ['stock', 'items-dropdown'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('enprotec_stock_items')
                .select('id, part_number, description, min_stock_level')
                .order('part_number');
            if (error) throw error;
            return (data || []) as StockItemRow[];
        },
        staleTime: 5 * 60_000,
    });

    const stockOptions = useMemo(() =>
        availableStockItems.map(item => ({
            value: item.id,
            label: `${item.part_number} - ${item.description}`
        })),
        [availableStockItems]
    );

    // Pre-fill fields when opening as a return
    useEffect(() => {
        if (!returnWorkflow || availableStockItems.length === 0) return;
        const firstItem = returnWorkflow.items[0];
        if (!firstItem) return;
        const returnedStockItem = availableStockItems.find(s => s.part_number === firstItem.partNumber);
        if (returnedStockItem) {
            setSelectedStockItemId(returnedStockItem.id);
            setQuantity(String(returnWorkflow.items.reduce((sum, item) => sum + item.quantityRequested, 0)));
            setDeliveryNotePO(`RETURN from ${returnWorkflow.requestNumber}`);
            setComments(`Rejected by ${returnWorkflow.requester}: ${returnWorkflow.rejectionComment}`);
            setLocation('Awaiting placement');
        }
    }, [availableStockItems, returnWorkflow]);

    useEffect(() => {
        if (intakeType === 'existing' || intakeType === 'return') {
            const selectedItem = availableStockItems.find(item => item.id === selectedStockItemId);
            if (selectedItem) {
                setPartNumber(selectedItem.part_number);
                setDescription(selectedItem.description || '');
                setMinStockLevel(String(selectedItem.min_stock_level));
            }
        } else if (intakeType === 'new') {
            setSelectedStockItemId('');
            setPartNumber('');
            setDescription('');
            setMinStockLevel('0');
        }
    }, [intakeType, selectedStockItemId, availableStockItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!store) {
            setError("Please select a store.");
            return;
        }
        setLoading(true);
        setError('');

        try {
            let attachmentUrl: string | null = null;
            let stockItemId: string;

            if (intakeType === 'existing' || intakeType === 'return') {
                if (!selectedStockItemId) throw new Error("Please select an existing part.");
                stockItemId = selectedStockItemId;
            } else { // New part
                const { data: existingPart, error: fetchError } = await supabase
                    .from('enprotec_stock_items')
                    .select('id')
                    .eq('part_number', partNumber)
                    .maybeSingle();

                if (fetchError) throw fetchError;
                if (existingPart) throw new Error(`Part number "${partNumber}" already exists in the system. Use the 'Existing Part' option instead.`);

                const { data: newStockItem, error: insertError } = await supabase
                    .from('enprotec_stock_items')
                    .insert({
                        part_number: partNumber,
                        description: description,
                        min_stock_level: parseInt(minStockLevel, 10),
                    })
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                if (!newStockItem) throw new Error("Could not create new stock item.");
                stockItemId = newStockItem.id;
            }

            const quantityReceived = parseInt(quantity, 10);

            if (attachmentFile && !isReturnMode) {
                const fileExt = attachmentFile.name.split('.').pop() || 'jpg';
                const filePath = `stock-receipts/${user.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('Enprotec')
                    .upload(filePath, attachmentFile, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: attachmentFile.type || 'image/jpeg',
                    });

                if (uploadError) {
                    throw new Error(`Attachment upload failed: ${uploadError.message}`);
                }

                const { data: publicData } = supabase.storage.from('Enprotec').getPublicUrl(filePath);
                attachmentUrl = publicData.publicUrl;
            }

            // Use the new atomic service
            await stockService.processStockIntake({
                stockItemId: stockItemId,
                quantity: quantityReceived,
                store: store,
                location: location,
                receivedById: user.id,
                deliveryNote: deliveryNotePO,
                comments: comments,
                attachmentUrl: attachmentUrl,
                isReturn: isReturnMode,
                returnWorkflowId: returnWorkflow?.id
            });

            setAttachmentFile(null);
            setAttachmentInputKey((prev) => prev + 1);
            onSuccess();

        } catch (err) {
            console.error('Stock intake error:', err);

            // Provide user-friendly error messages
            let errorMessage = 'Unable to process stock intake. Please try again.';

            if (err instanceof Error) {
                // Check for specific error types
                if (err.message.includes('process_stock_intake')) {
                    errorMessage = 'Stock intake system is currently unavailable. Please contact your administrator.';
                } else if (err.message.includes('already exists')) {
                    errorMessage = err.message; // Show the specific part number conflict
                } else if (err.message.includes('upload failed')) {
                    errorMessage = 'File upload failed. Please check your file and try again.';
                } else if (err.message.includes('not found')) {
                    errorMessage = 'The selected item could not be found. Please refresh and try again.';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const renderPartFields = () => {
        if (intakeType === 'existing' || isReturnMode) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 items-center">
                    <FormLabel htmlFor="partNumberSelect">Part</FormLabel>
                    <div className="md:col-span-2">
                        <Select
                            id="partNumberSelect"
                            options={stockOptions}
                            value={stockOptions.find(opt => opt.value === selectedStockItemId) || null}
                            onChange={(selectedOption) => setSelectedStockItemId(selectedOption ? selectedOption.value : '')}
                            isLoading={stockLoading}
                            isDisabled={stockLoading || isReturnMode}
                            placeholder={stockLoading ? 'Loading stock...' : 'Select or search for a part...'}
                            styles={customSelectStyles}
                            required
                        />
                    </div>
                </div>
            );
        }

        // New Part Fields
        return (
            <>
                <FormRow>
                    <FormLabel htmlFor="partNumber">Part Number</FormLabel>
                    <FormInput id="partNumber" type="text" value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="e.g., OEM-5566" required />
                </FormRow>
                <FormRow>
                    <FormLabel htmlFor="description">Description</FormLabel>
                    <FormInput id="description" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Secondary Gearbox Assembly" required />
                </FormRow>
                <FormRow>
                    <FormLabel htmlFor="minStockLevel">Minimum Stock Level</FormLabel>
                    <FormInput id="minStockLevel" type="number" min="0" value={minStockLevel} onChange={e => setMinStockLevel(e.target.value)} placeholder="Default: 0" required />
                </FormRow>
            </>
        );
    };

    return (
        <Card title={isReturnMode ? "Book Return into Stock" : "Receive New Stock / Stock Intake"}>
            <form className="space-y-6" onSubmit={handleSubmit}>
                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Receipt Details</legend>
                    {!isReturnMode && (
                        <FormRow>
                            <FormLabel htmlFor="intakeType">Intake Type</FormLabel>
                            <div className="md:col-span-2 flex items-center space-x-4 p-1 bg-zinc-200 rounded-md">
                                <button
                                    type="button"
                                    onClick={() => setIntakeType('existing')}
                                    className={`flex-1 py-1.5 text-sm font-semibold rounded ${intakeType === 'existing' ? 'bg-sky-500 text-white' : 'text-zinc-700 hover:bg-zinc-300'}`}
                                >
                                    Existing Part
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntakeType('new')}
                                    className={`flex-1 py-1.5 text-sm font-semibold rounded ${intakeType === 'new' ? 'bg-sky-500 text-white' : 'text-zinc-700 hover:bg-zinc-300'}`}
                                >
                                    New Part
                                </button>
                            </div>
                        </FormRow>
                    )}
                    <FormRow>
                        <FormLabel htmlFor="deliveryNotePO">Delivery Note / PO #</FormLabel>
                        <FormInput id="deliveryNotePO" type="text" value={deliveryNotePO} onChange={e => setDeliveryNotePO(e.target.value)} placeholder="e.g., DN-12345 or PO-67890" required disabled={isReturnMode} />
                    </FormRow>
                    {!isReturnMode && (
                        <FormRow>
                            <FormLabel htmlFor="receipt-attachment">Receipt Attachment (Optional)</FormLabel>
                            <div className="md:col-span-2 flex flex-col gap-2">
                                <input
                                    key={attachmentInputKey}
                                    id="receipt-attachment"
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                        if (event.target.files && event.target.files[0]) {
                                            setAttachmentFile(event.target.files[0]);
                                        } else {
                                            setAttachmentFile(null);
                                        }
                                    }}
                                    className="w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100 disabled:file:bg-zinc-200"
                                    disabled={loading}
                                />
                                {attachmentFile ? (
                                    <div className="flex min-w-0 items-center gap-3 text-xs text-zinc-500">
                                        <span className="truncate">{attachmentFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAttachmentFile(null);
                                                setAttachmentInputKey((prev) => prev + 1);
                                            }}
                                            className="font-semibold text-sky-600 hover:text-sky-500 disabled:text-sky-300"
                                            disabled={loading}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-xs text-zinc-400">Add a photo of the delivery note or received goods (optional).</span>
                                )}
                            </div>
                        </FormRow>
                    )}
                </fieldset>

                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Item Details</legend>
                    {renderPartFields()}
                    <FormRow>
                        <FormLabel htmlFor="quantity">Quantity Received</FormLabel>
                        <FormInput id="quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="e.g., 10" required disabled={isReturnMode} />
                    </FormRow>
                </fieldset>

                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Storage & Notes</legend>
                    <FormRow>
                        <FormLabel htmlFor="store">Assign to Store</FormLabel>
                        <FormSelect id="store" value={store} onChange={e => setStore(e.target.value as StoreType)} required disabled={isReturnMode || visibleStores.length === 1}>
                            <option value="">{visibleStores.length === 0 ? 'No stores available' : 'Select a store...'}</option>
                            {visibleStores.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </FormSelect>
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="location">Location in Store</FormLabel>
                        <FormInput id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., Aisle 5, Bin C3" required disabled={isReturnMode} />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="comments">Comments / Notes</FormLabel>
                        <FormTextarea id="comments" value={comments} onChange={e => setComments(e.target.value)} placeholder="e.g., Box was damaged, partial delivery, etc." disabled={isReturnMode} />
                    </FormRow>
                </fieldset>

                <fieldset className="space-y-4">
                    <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Confirmation</legend>
                    <FormRow>
                        <FormLabel htmlFor="receivedBy">Received By</FormLabel>
                        <FormInput id="receivedBy" type="text" value={user.name} readOnly />
                    </FormRow>
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-200">
                    <button type="button" onClick={onCancel} className="px-6 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300 transition-colors">
                        {loading ? 'Processing...' : (isReturnMode ? 'Confirm Return to Stock' : 'Add to Inventory')}
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default StockIntakeForm;
