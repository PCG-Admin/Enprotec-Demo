import { supabase } from '../supabase/client';
import { StoreType, Priority, Store } from '../types';

export interface StockIntakeParams {
    stockItemId: string;
    quantity: number;
    store: StoreType;
    location: string;
    receivedById: string;
    deliveryNote: string;
    comments: string;
    attachmentUrl: string | null;
    isReturn?: boolean;
    returnWorkflowId?: string | null;
}

export interface StockRequestItem {
    stock_item_id: string;
    quantity: number;
}

export interface CreateRequestParams {
    requesterId: string;
    requestNumber: string;
    siteId: string;
    department: Store;
    priority: Priority;
    attachmentUrl: string | null;
    items: StockRequestItem[];
    comment: string;
}

interface RPCResponse {
    success: boolean;
    error?: string;
    [key: string]: any;
}

/**
 * Sanitizes database errors to prevent exposing internal details to users
 */
const sanitizeError = (error: any, operation: string): Error => {
    // Log the full error for debugging
    console.error(`[${operation}] Database error:`, error);

    // Check for common database errors and provide user-friendly messages
    if (error?.message) {
        const msg = error.message.toLowerCase();

        // Column/table errors
        if (msg.includes('column') && msg.includes('does not exist')) {
            return new Error('System configuration error. Please contact your administrator.');
        }

        // Unique constraint violations
        if (msg.includes('duplicate') || msg.includes('unique constraint')) {
            return new Error('This item already exists. Please check your input.');
        }

        // Foreign key violations
        if (msg.includes('foreign key') || msg.includes('violates')) {
            return new Error('Invalid reference. Please refresh and try again.');
        }

        // Permission errors
        if (msg.includes('permission') || msg.includes('denied')) {
            return new Error('You do not have permission to perform this action.');
        }

        // Network/connection errors
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('connection')) {
            return new Error('Connection error. Please check your internet and try again.');
        }
    }

    // Generic fallback message
    return new Error(`Unable to complete ${operation}. Please try again or contact support.`);
};

export const stockService = {
    /**
     * Process a stock intake (receipt) atomically using a Database RPC function.
     * This prevents race conditions when updating inventory quantities.
     */
    async processStockIntake(params: StockIntakeParams) {
        try {
            const { data, error } = await (supabase.rpc as any)('process_stock_intake', {
                p_stock_item_id: params.stockItemId,
                p_quantity: params.quantity,
                p_store: params.store,
                p_location: params.location,
                p_received_by_id: params.receivedById,
                p_delivery_note: params.deliveryNote,
                p_comments: params.comments,
                p_attachment_url: params.attachmentUrl,
                p_is_return: params.isReturn || false,
                p_return_workflow_id: params.returnWorkflowId || null
            });

            if (error) {
                throw sanitizeError(error, 'stock intake');
            }

            // The RPC returns a JSON object with { success: boolean, error?: string }
            const result = data as RPCResponse;
            if (result && !result.success) {
                throw new Error(result.error || 'Stock intake failed. Please try again.');
            }

            return result;
        } catch (err) {
            // If error is already sanitized, rethrow it
            if (err instanceof Error && err.message.startsWith('Unable to complete') ||
                err instanceof Error && !err.message.includes('column') && !err.message.includes('relation')) {
                throw err;
            }
            // Otherwise sanitize it
            throw sanitizeError(err, 'stock intake');
        }
    },

    /**
     * Create a new stock request atomically.
     */
    async createStockRequest(params: CreateRequestParams) {
        try {
            const { data, error } = await (supabase.rpc as any)('process_stock_request', {
                p_requester_id: params.requesterId,
                p_request_number: params.requestNumber,
                p_site_id: params.siteId,
                p_department: params.department,
                p_priority: params.priority,
                p_items: params.items,
                p_attachment_url: params.attachmentUrl,
                p_comment: params.comment
            });

            if (error) {
                throw sanitizeError(error, 'stock request');
            }

            const result = data as RPCResponse;
            if (result && !result.success) {
                throw new Error(result.error || 'Unable to create stock request. Please try again.');
            }

            return result;
        } catch (err) {
            // If error is already sanitized, rethrow it
            if (err instanceof Error && err.message.startsWith('Unable to complete') ||
                err instanceof Error && !err.message.includes('column') && !err.message.includes('relation')) {
                throw err;
            }
            // Otherwise sanitize it
            throw sanitizeError(err, 'stock request');
        }
    }
};
