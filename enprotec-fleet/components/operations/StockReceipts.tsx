import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { getMappedRole, StockReceipt, FormType, User, UserRole, departmentToStoreMap, Store, StoreType } from '../../types';

interface StockReceiptsProps {
    openForm: (type: FormType) => void;
    user: User;
}

const StockReceipts: React.FC<StockReceiptsProps> = ({ openForm, user }) => {
    const [receipts, setReceipts] = useState<StockReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const canReceiveStock = useMemo(
        () =>
            [UserRole.Admin, UserRole.StockController, UserRole.EquipmentManager].includes(
                user.role
            ),
        [user.role]
    );

    const fetchReceipts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('enprotec_stock_receipts_view')
                .select('*');

            if (getMappedRole(user.role) !== UserRole.Admin && user.departments && user.departments.length > 0) {
                const visibleStores = user.departments.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);
                if (visibleStores.length > 0) {
                    query = query.in('store', visibleStores);
                }
            }
            
            const { data, error } = await query.order('receivedAt', { ascending: false });
            
            if (error) throw error;
            setReceipts((data as any[]) || []);
        } catch (err) {
            setError('Failed to fetch stock receipts.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchReceipts();
    }, [fetchReceipts]);

    useEffect(() => {
        if (!previewUrl) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPreviewUrl(null);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [previewUrl]);

    const filteredReceipts = useMemo(() => {
        if (!searchTerm) return receipts;
        const term = searchTerm.toLowerCase();
        return receipts.filter(r => {
            const attachmentUrl =
                (r.attachmentUrl ?? (r as any).attachment_url ?? '').toString().toLowerCase();
            return (
                (r.partNumber && r.partNumber.toLowerCase().includes(term)) ||
                (r.description && r.description.toLowerCase().includes(term)) ||
                (r.deliveryNotePO && r.deliveryNotePO.toLowerCase().includes(term)) ||
                (r.receivedBy && r.receivedBy.toLowerCase().includes(term)) ||
                (!!attachmentUrl && attachmentUrl.includes(term))
            );
        });
    }, [receipts, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Stock Receipts History</h1>
                    <p className="text-zinc-500 mt-1">{filteredReceipts.length} receipt(s) found.</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-full md:w-64 relative">
                        <input
                            type="text"
                            placeholder="Search receipts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    {canReceiveStock && (
                        <button
                            onClick={() => openForm('StockIntake')}
                            className="flex-shrink-0 px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors"
                        >
                            New Receipt
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Qty Received</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Received By</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider">Attachment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Delivery Note / PO #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Comments</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={8} className="text-center py-12 px-6 text-zinc-500">Loading receipts...</td></tr>
                            )}
                            {error && (
                                <tr><td colSpan={8} className="text-center py-12 px-6 text-red-600">{error}</td></tr>
                            )}
                            {!loading && !error && filteredReceipts.length === 0 && (
                                <tr><td colSpan={8} className="text-center py-12 px-6 text-zinc-500">{searchTerm ? 'No results found.' : 'No stock receipts recorded yet.'}</td></tr>
                            )}
                            {!loading && !error && filteredReceipts.map((receipt) => {
                                const attachmentUrl = (receipt.attachmentUrl ?? (receipt as any).attachment_url ?? '').trim();
                                const hasAttachment = attachmentUrl.length > 0;
                                return (
                                    <tr key={receipt.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-zinc-500">{new Date(receipt.receivedAt).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-zinc-900">{receipt.partNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-zinc-700">{receipt.description}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center font-semibold text-sky-600">{receipt.quantityReceived}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-zinc-700">{receipt.receivedBy}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {hasAttachment ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewUrl(attachmentUrl)}
                                                    className="text-sky-600 hover:text-sky-500 font-semibold"
                                                >
                                                    View
                                                </button>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-zinc-700">{receipt.deliveryNotePO}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-zinc-500 text-xs">{receipt.comments}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {previewUrl && (
                <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setPreviewUrl(null)}
                >
                    <div
                        className="relative max-h-full w-full max-w-3xl rounded-lg bg-white shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewUrl(null)}
                            className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-zinc-500 shadow hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            aria-label="Close preview"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 4.21a.75.75 0 011.06 0L10 7.91l3.71-3.7a.75.75 0 111.06 1.06L11.06 9l3.71 3.71a.75.75 0 11-1.06 1.06L10 10.06l-3.71 3.71a.75.75 0 11-1.06-1.06L8.94 9 5.23 5.29a.75.75 0 010-1.06z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-lg">
                            <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
                                <h2 className="text-sm font-semibold text-zinc-800">Receipt Attachment</h2>
                                <p className="text-xs text-zinc-500">Image opens in a new tab if you need a closer look.</p>
                            </div>
                            <div className="flex-1 overflow-auto bg-black/5 p-4">
                                <img
                                    src={previewUrl}
                                    alt="Receipt attachment preview"
                                    className="mx-auto max-h-[70vh] w-full rounded-md object-contain bg-white"
                                />
                            </div>
                            <div className="border-t border-zinc-200 bg-white px-6 py-3 text-right">
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-500"
                                >
                                    Open Full Image
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockReceipts;
