import React, { useState } from 'react';
import Card from '../Card';
import { User, StockItem, WorkflowStatus, StoreType, storeToStoreMap } from '../../../types';
import { supabase } from '../../../supabase/client';

interface SalvageBookingFormProps {
    user: User;
    stockItem: StockItem | null;
    maxQuantity?: number;
    workflowId?: string;
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
    <input {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400 disabled:bg-zinc-100" />
);

const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea {...props} className="md:col-span-2 p-2 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900 placeholder:text-zinc-400" />
);


const SalvageBookingForm: React.FC<SalvageBookingFormProps> = ({ user, stockItem, maxQuantity, workflowId, onSuccess, onCancel }) => {
    const [quantity, setQuantity] = useState(() => (maxQuantity && maxQuantity > 0 ? String(maxQuantity) : ''));
    const [notes, setNotes] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!stockItem) {
        return <Card title="Error"><p>No stock item selected for salvage booking.</p></Card>;
    }
    
    const allowedMax = Math.min(
        stockItem.quantityOnHand,
        Number.isFinite(maxQuantity ?? Infinity) ? (maxQuantity as number) : stockItem.quantityOnHand
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const salvageQuantity = parseInt(quantity, 10);
        if (isNaN(salvageQuantity) || salvageQuantity <= 0 || salvageQuantity > allowedMax) {
            setError(`Please enter a valid quantity between 1 and ${allowedMax}.`);
            return;
        }
        
        setLoading(true);
        setError('');

        try {
            let photoUrl: string | null = null;
            if (photoFile) {
                const safeName = photoFile.name.replace(/\s+/g, '-');
                const filePath = `salvage/${stockItem.id}/${Date.now()}-${safeName}`;
                const { error: uploadError } = await supabase.storage
                    .from('Enprotec')
                    .upload(filePath, photoFile);
                if (uploadError) {
                    throw new Error(`Photo upload failed: ${uploadError.message}`);
                }
                const { data } = supabase.storage.from('Enprotec').getPublicUrl(filePath);
                photoUrl = data.publicUrl;
            }

            // Look up the underlying stock item for this inventory record
            const { data: originalInventory, error: inventoryLookupError } = await supabase
                .from('enprotec_inventory')
                .select('stock_item_id, site_id')
                .eq('id', stockItem.id)
                .single();
            if (inventoryLookupError) throw inventoryLookupError;

            const stockItemId = originalInventory?.stock_item_id;
            if (!stockItemId) {
                throw new Error('Unable to locate the linked stock item for this inventory record.');
            }
            const siteId = originalInventory?.site_id ?? null;

            // Step 1: Create the salvage request record
            const { error: salvageError } = await supabase.from('enprotec_salvage_requests').insert({
                stock_item_id: stockItemId,
                quantity: salvageQuantity,
                status: WorkflowStatus.SALVAGE_AWAITING_DECISION,
                notes: photoUrl ? `${notes ? notes + '\n' : ''}Photo: ${photoUrl}` : notes,
                created_by_id: user.id,
                source_department: storeToStoreMap[stockItem.store],
            });
            if (salvageError) throw salvageError;

            if (workflowId) {
                await supabase
                    .from('enprotec_workflow_requests')
                    .update({ current_status: WorkflowStatus.SALVAGE_COMPLETE })
                    .eq('id', workflowId);
            }

            // Log movement: transfer out of original store and into SalvageYard
            const movements = [
                {
                    stock_item_id: stockItemId,
                    store: stockItem.store,
                    movement_type: 'transfer_out',
                    quantity: salvageQuantity,
                    site_id: siteId,
                    user_id: user.id,
                    note: 'Booked to salvage'
                },
                {
                    stock_item_id: stockItemId,
                    store: StoreType.SalvageYard,
                    movement_type: 'transfer_in',
                    quantity: salvageQuantity,
                    site_id: siteId,
                    user_id: user.id,
                    note: 'Booked to salvage'
                },
            ];
            const { error: movementError } = await supabase.from('enprotec_stock_movements').insert(movements);
            if (movementError) throw movementError;

            // Step 2: Deduct quantity from the original store
            const newOriginalQuantity = stockItem.quantityOnHand - salvageQuantity;
            const { error: updateError } = await supabase.from('enprotec_inventory').update({ quantity_on_hand: newOriginalQuantity }).eq('id', stockItem.id);
            if (updateError) throw updateError;
            
            // Step 3: Add or update quantity in the Salvage Store
            const { data: salvageInventory, error: fetchError } = await supabase.from('enprotec_inventory')
                .select('id, quantity_on_hand')
                .eq('stock_item_id', stockItemId)
                .eq('store', StoreType.SalvageYard)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (salvageInventory) {
                // Update existing record in Salvage Store
                const newSalvageQuantity = (salvageInventory as any).quantity_on_hand + salvageQuantity;
                const { error: updateSalvageError } = await supabase.from('enprotec_inventory').update({ quantity_on_hand: newSalvageQuantity }).eq('id', (salvageInventory as any).id);
                if (updateSalvageError) throw updateSalvageError;
            } else {
                // Create new record in Salvage Store
                const { error: insertSalvageError } = await supabase.from('enprotec_inventory').insert({
                    stock_item_id: stockItemId,
                    store: StoreType.SalvageYard,
                    quantity_on_hand: salvageQuantity,
                    location: 'Salvage Area',
                    site_id: siteId
                });
                if (insertSalvageError) throw insertSalvageError;
            }

            onSuccess();
        } catch(err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Book Item to Salvage Store">
            <form className="space-y-6" onSubmit={handleSubmit}>
                <fieldset className="space-y-4">
                     <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Item Details</legend>
                    <FormRow>
                        <FormLabel htmlFor="partNumber">Part Number</FormLabel>
                        <FormInput id="partNumber" type="text" value={stockItem.partNumber} readOnly />
                    </FormRow>
                     <FormRow>
                        <FormLabel htmlFor="description">Description</FormLabel>
                        <FormInput id="description" type="text" value={stockItem.description} readOnly />
                    </FormRow>
                     <FormRow>
                        <FormLabel htmlFor="currentStore">Current Store</FormLabel>
                        <FormInput id="currentStore" type="text" value={stockItem.store} readOnly />
                    </FormRow>
                </fieldset>
                
                 <fieldset className="space-y-4">
                     <legend className="text-lg font-semibold text-zinc-900 border-b border-zinc-200 pb-2 mb-4 w-full">Salvage Details</legend>
                     <FormRow>
                        <FormLabel htmlFor="quantity">Quantity to Salvage</FormLabel>
                        <FormInput 
                            id="quantity" 
                            type="number" 
                            value={quantity}
                            readOnly
                            max={allowedMax}
                            min="1"
                            placeholder={`Max: ${allowedMax}`}
                            required 
                        />
                    </FormRow>
                    <FormRow>
                       <FormLabel htmlFor="notes">Reason / Notes</FormLabel>
                       <FormTextarea
                           id="notes"
                           value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="e.g., Damaged during transit, obsolete model..."
                        />
                    </FormRow>
                    <FormRow>
                        <FormLabel htmlFor="photo">Add Photo</FormLabel>
                        <div className="md:col-span-2">
                            <input
                                id="photo"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                                className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                            />
                            {photoFile && <p className="text-xs text-zinc-500 mt-2">Selected: {photoFile.name}</p>}
                        </div>
                    </FormRow>
                </fieldset>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end items-center gap-3 pt-4 border-t border-zinc-200">
                    <button type="button" onClick={onCancel} className="px-6 py-2 bg-zinc-200 text-zinc-800 font-semibold rounded-md hover:bg-zinc-300 transition-colors">
                        Cancel
                    </button>
                     <button type="submit" disabled={loading} className="px-6 py-2 bg-amber-500 text-white font-semibold rounded-md hover:bg-amber-600 disabled:bg-zinc-300 transition-colors">
                        {loading ? 'Processing...' : 'Confirm Booking'}
                    </button>
                </div>
            </form>
        </Card>
    );
};

export default SalvageBookingForm;
