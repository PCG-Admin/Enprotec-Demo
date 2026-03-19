import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { getMappedRole, StockItem, StoreType, FormType, User, Store, departmentToStoreMap, UserRole, Department } from '../../types';
import { fetchActiveDepartments } from '../../services/departmentService';

interface StockManagementProps {
    openForm: (type: FormType, context?: any) => void;
    user: User;
}

interface MovementRow {
    id: string;
    movementType: string;
    quantityDelta: number;
    store: StoreType;
    createdAt: string;
    siteName?: string | null;
    actionedBy?: string | null;
    requestNumber?: string | null;
    note?: string | null;
}

const getStoreBadge = (store: StoreType) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full inline-block";

    // Color mapping for known stores
    const colorMap: Record<string, string> = {
        'OEM': 'bg-sky-100 text-sky-800',
        'Operations': 'bg-indigo-100 text-indigo-800',
        'Projects': 'bg-rose-100 text-rose-800',
        'SalvageYard': 'bg-amber-100 text-amber-800',
        'Satellite': 'bg-purple-100 text-purple-800',
    };

    // Use mapped color or default for new stores
    const colorClass = colorMap[store] || 'bg-zinc-100 text-zinc-800';
    return <span className={`${baseClasses} ${colorClass}`}>{store}</span>;
}

const StockManagement: React.FC<StockManagementProps> = ({ openForm, user }) => {
    const [stock, setStock] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeStore, setActiveStore] = useState<StoreType | 'All'>('All');
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [totalCount, setTotalCount] = useState(0);
    const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
    const [history, setHistory] = useState<MovementRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const historyRef = useRef<HTMLDivElement | null>(null);
    const [availableStores, setAvailableStores] = useState<Department[]>([]);
    const [storesLoading, setStoresLoading] = useState(true);

    const canReceiveStock = useMemo(
        () =>
            [UserRole.Admin, UserRole.StockController, UserRole.EquipmentManager].includes(
                user.role
            ),
        [user.role]
    );

    // Fetch available stores from database
    useEffect(() => {
        const loadStores = async () => {
            setStoresLoading(true);
            try {
                const departments = await fetchActiveDepartments();
                setAvailableStores(departments);
            } catch (err) {
                console.error('Failed to load stores:', err);
                // Fallback to empty array - will use enum if needed
                setAvailableStores([]);
            } finally {
                setStoresLoading(false);
            }
        };
        loadStores();
    }, []);

    const visibleStores = useMemo(() => {
        // If stores haven't loaded yet from database, use enum fallback
        if (availableStores.length === 0) {
            if (getMappedRole(user.role) === 'Admin' || !user.departments || user.departments.length === 0) {
                return Object.values(StoreType);
            }
            const stores = user.departments.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);
            return [...new Set(stores)];
        }

        // Use database stores
        if (getMappedRole(user.role) === 'Admin' || !user.departments || user.departments.length === 0) {
            return availableStores.map(dept => dept.code as StoreType);
        }

        // Filter to user's assigned departments
        const userDeptCodes = user.departments;
        const filtered = availableStores
            .filter(dept => userDeptCodes.includes(dept.code))
            .map(dept => dept.code as StoreType);
        return [...new Set(filtered)];
    }, [user, availableStores]);

    // Create a mapping from store code to store name
    const storeCodeToName = useMemo(() => {
        const mapping: Record<string, string> = {};
        availableStores.forEach(dept => {
            mapping[dept.code] = dept.name;
        });
        return mapping;
    }, [availableStores]);
    
    const fetchStock = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (visibleStores.length === 0) {
                setStock([]);
                setTotalCount(0);
                return;
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('enprotec_stock_view')
                .select('*', { count: 'exact' })
                .order('partNumber', { ascending: true })
                .range(from, to);

            if (activeStore === 'All') {
                query = query.in('store', visibleStores);
            } else {
                query = query.eq('store', activeStore);
            }

            if (debouncedSearch) {
                const term = `%${debouncedSearch}%`;
                query = query.or(`partNumber.ilike.${term},description.ilike.${term}`);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            setStock((data as any) || []);
            setTotalCount(count || 0);
        } catch (err) {
            setError('Failed to fetch stock data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [activeStore, debouncedSearch, page, pageSize, visibleStores]);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [activeStore, debouncedSearch]);

    useEffect(() => {
        fetchStock();
    }, [fetchStock]);

    const isLowStock = (item: StockItem) => item.quantityOnHand < item.minStockLevel;
    
    const tabs: (StoreType | 'All')[] = ['All', ...visibleStores.sort()];
    const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
    
    useEffect(() => {
        // If the current active store is not in the visible tabs, reset to 'All'
        if (!tabs.includes(activeStore)) {
            setActiveStore('All');
        }
    }, [tabs, activeStore]);


    const filteredStock = useMemo(() => {
        return stock;
    }, [stock]);

    const loadHistory = async (item: StockItem) => {
        setHistoryItem(item);
        setHistory([]);
        setHistoryError(null);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('enprotec_stock_movements_view')
                .select('id, movementType, quantityDelta, store, createdAt, siteName, actionedBy, requestNumber, note')
                .eq('partNumber', item.partNumber)
                .eq('store', item.store)
                .order('createdAt', { ascending: false })
                .limit(50);

            if (error) throw error;
            setHistory((data as MovementRow[]) || []);
        } catch (err) {
            console.error(err);
            setHistoryError('Could not load movement history for this item.');
        } finally {
            setHistoryLoading(false);
        }
    };

    const closeHistory = () => {
        setHistoryItem(null);
        setHistory([]);
        setHistoryError(null);
    };

    const renderDelta = (qty: number) => {
        const sign = qty > 0 ? '+' : '';
        const color = qty < 0 ? 'text-red-700' : 'text-emerald-700';
        return <span className={`font-semibold ${color}`}>{`${sign}${qty}`}</span>;
    };

    useEffect(() => {
        if (historyItem && historyRef.current) {
            historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [historyItem]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-zinc-900 self-start md:self-center">Stores & Inventory</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-full md:w-64 relative">
                        <input
                            type="text"
                            placeholder="Search in this store..."
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
                            Receive Stock
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200">
                <div className="border-b border-zinc-200">
                    <nav className="flex flex-wrap space-x-1 p-1.5">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveStore(tab)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    activeStore === tab
                                    ? 'bg-sky-500 text-white'
                                    : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                            >
                                {tab === 'All' ? 'All Stores' : (storeCodeToName[tab] || tab)}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="overflow-x-auto w-full">
                    <table className="min-w-[1100px] w-full table-fixed text-sm">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-40">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-64">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-32">Store</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider w-28">Qty on Hand</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider w-28">Min Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-56">Location</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider w-32">Status</th>
                                <th className="px-6 py-3 w-40 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                             {loading && (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 px-6 text-zinc-500">Loading inventory...</td>
                                </tr>
                              )}
                              {error && (
                                 <tr>
                                    <td colSpan={8} className="text-center py-12 px-6 text-red-600">{error}</td>
                                </tr>
                              )}
                            {!loading && !error && filteredStock.map((item: StockItem) => (
                                <tr key={item.id} className={`border-b border-zinc-200 ${isLowStock(item) ? 'bg-red-50' : ''} hover:bg-zinc-50 transition-colors`}>
                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-zinc-900 truncate">{item.partNumber}</td>
                                    <td className="px-6 py-4 text-zinc-700 truncate">{item.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStoreBadge(item.store)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center font-semibold text-zinc-900">{item.quantityOnHand}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-zinc-500">{item.minStockLevel}</td>
                                    <td className="px-6 py-4 text-zinc-700 truncate">{item.location}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {isLowStock(item) ? (
                                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Low Stock</span>
                                        ) : (
                                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">OK</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => loadHistory(item)}
                                            className="text-sm text-sky-600 hover:text-sky-700 font-semibold"
                                        >
                                            View history
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {filteredStock.length === 0 && !loading && (
                        <div className="text-center py-12 px-6">
                            <p className="text-zinc-500">No stock items match your criteria.</p>
                        </div>
                    )}
                    {filteredStock.length > 0 && (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-t border-zinc-200 text-sm text-zinc-700">
                            <div>
                                Showing {(page - 1) * pageSize + 1}-
                                {Math.min(page * pageSize, totalCount)} of {totalCount} items
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 rounded-md border border-zinc-300 text-zinc-700 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed bg-white hover:bg-zinc-50"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-zinc-500">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1 rounded-md border border-zinc-300 text-zinc-700 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed bg-white hover:bg-zinc-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {historyItem && (
                <div
                    className="fixed inset-0 z-40 flex items-start md:items-center justify-center bg-black/40 px-4 py-8"
                    onClick={closeHistory}
                >
                    <div
                        ref={historyRef}
                        className="w-full max-w-5xl bg-white rounded-lg border border-zinc-200 shadow-xl max-h-[90vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
                            <div>
                                <p className="text-xs uppercase text-zinc-500">Movement History</p>
                                <h3 className="text-lg font-semibold text-zinc-900">
                                    {historyItem.partNumber} - {historyItem.description}
                                </h3>
                                <p className="text-sm text-zinc-500">Store: {historyItem.store}</p>
                            </div>
                            <button onClick={closeHistory} className="text-sm text-zinc-600 hover:text-zinc-800">Close</button>
                        </div>
                        <div className="p-6 space-y-3">
                            {historyLoading ? (
                                <p className="text-sm text-zinc-500">Loading history...</p>
                            ) : historyError ? (
                                <p className="text-sm text-red-600">{historyError}</p>
                            ) : history.length === 0 ? (
                                <p className="text-sm text-zinc-500">No movements recorded for this item yet.</p>
                            ) : (
                                <div className="overflow-auto max-h-[60vh]">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-zinc-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left">Date</th>
                                                <th className="px-4 py-2 text-left">Type</th>
                                                <th className="px-4 py-2 text-center">Qty</th>
                                                <th className="px-4 py-2 text-left">Site</th>
                                                <th className="px-4 py-2 text-left">Store</th>
                                                <th className="px-4 py-2 text-left">Actioned By</th>
                                                <th className="px-4 py-2 text-left">Request #</th>
                                                <th className="px-4 py-2 text-left">Note</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200">
                                            {history.map(move => (
                                                <tr key={move.id} className="hover:bg-zinc-50">
                                                    <td className="px-4 py-2 whitespace-nowrap">{new Date(move.createdAt).toLocaleString()}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{move.movementType}</td>
                                                    <td className="px-4 py-2 text-center">{renderDelta(move.quantityDelta)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{move.siteName || '--'}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{move.store}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{move.actionedBy || '--'}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{move.requestNumber || '--'}</td>
                                                    <td className="px-4 py-2">{move.note || ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManagement;
