import React, { useEffect, useState, FormEvent } from 'react';
import { Department } from '../../types';
import {
    fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} from '../../services/departmentService';

type StoreStatus = 'Active' | 'Frozen';

const getStatusBadge = (status: StoreStatus) => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full";
    switch (status) {
        case 'Active':
            return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Active</span>;
        case 'Frozen':
            return <span className={`${baseClasses} bg-zinc-100 text-zinc-800`}>Frozen</span>;
        default:
            return null;
    }
};

const Stores: React.FC = () => {
    const [stores, setStores] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreCode, setNewStoreCode] = useState('');
    const [newStoreDescription, setNewStoreDescription] = useState('');
    const [newStoreStatus, setNewStoreStatus] = useState<StoreStatus>('Active');
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deletingStoreCode, setDeletingStoreCode] = useState<string | null>(null);
    const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);
    const [editingStore, setEditingStore] = useState<Department | null>(null);
    const [editName, setEditName] = useState('');
    const [editCode, setEditCode] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<StoreStatus>('Active');
    const [editError, setEditError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const loadStores = async () => {
        setLoading(true);
        setError(null);
        setActionError(null);
        try {
            const data = await fetchDepartments();
            setStores(data);
        } catch (err) {
            setError('Unable to load departments. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const startEditingStore = (store: Department) => {
        if (isFormOpen) {
            resetForm();
            setIsFormOpen(false);
        }
        setEditingStore(store);
        setEditName(store.name);
        setEditCode(store.code);
        setEditDescription(store.description || '');
        setEditStatus(store.status);
        setEditError(null);
        setActionError(null);
    };

    const cancelEditing = () => {
        setEditingStore(null);
        setEditName('');
        setEditCode('');
        setEditDescription('');
        setEditStatus('Active');
        setEditError(null);
    };

    const validateCode = (code: string): string | null => {
        if (!code.trim()) {
            return 'Store code is required.';
        }
        if (/\s/.test(code)) {
            return 'Store code cannot contain spaces.';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(code)) {
            return 'Store code can only contain letters, numbers, and underscores.';
        }
        return null;
    };

    const handleUpdateStore = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingStore) return;

        const trimmedName = editName.trim();
        const trimmedCode = editCode.trim();
        const trimmedDescription = editDescription.trim();

        if (!trimmedName) {
            setEditError('Store name is required.');
            return;
        }

        const codeError = validateCode(trimmedCode);
        if (codeError) {
            setEditError(codeError);
            return;
        }

        setIsEditing(true);
        setEditError(null);
        setActionError(null);

        try {
            const updated = await updateDepartment(editingStore.id, {
                name: trimmedName,
                code: trimmedCode,
                description: trimmedDescription || null,
                status: editStatus,
            });

            setStores((prev) =>
                prev
                    .map((d) => (d.id === updated.id ? updated : d))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
            cancelEditing();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to update department. Please try again.';
            setEditError(message);
            console.error(err);
        } finally {
            setIsEditing(false);
        }
    };

    const handleToggleStatus = async (store: Department) => {
        const nextStatus: StoreStatus = store.status === 'Active' ? 'Frozen' : 'Active';
        setTogglingStoreId(store.id);
        setActionError(null);

        try {
            const updated = await updateDepartment(store.id, { status: nextStatus });

            setStores((prev) =>
                prev
                    .map((d) => (d.id === updated.id ? updated : d))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );

            if (editingStore?.id === store.id) {
                setEditingStore(updated);
                setEditStatus(updated.status);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to update department status. Please try again.';
            setActionError(message);
            console.error(err);
        } finally {
            setTogglingStoreId(null);
        }
    };

    useEffect(() => {
        loadStores();
    }, []);

    const resetForm = () => {
        setNewStoreName('');
        setNewStoreCode('');
        setNewStoreDescription('');
        setNewStoreStatus('Active');
        setFormError(null);
    };

    const handleToggleForm = () => {
        setIsFormOpen((isOpen) => {
            if (isOpen) {
                resetForm();
            }
            return !isOpen;
        });
    };

    const handleAddStore = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newStoreName.trim();
        const trimmedCode = newStoreCode.trim();
        const trimmedDescription = newStoreDescription.trim();

        if (!trimmedName) {
            setFormError('Store name is required.');
            return;
        }

        const codeError = validateCode(trimmedCode);
        if (codeError) {
            setFormError(codeError);
            return;
        }

        setIsSubmitting(true);
        setFormError(null);
        setActionError(null);

        try {
            const newStore = await createDepartment(trimmedName, trimmedCode, trimmedDescription || null);
            setStores((prev) => [...prev, newStore].sort((a, b) => a.name.localeCompare(b.name)));
            resetForm();
            setIsFormOpen(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to add department. Please try again.';
            setFormError(message);
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStore = async (store: Department) => {
        const confirmDelete = window.confirm(
            `Delete ${store.name}? This cannot be undone.\n\nNote: You cannot delete departments that are assigned to users or referenced in workflows.`
        );
        if (!confirmDelete) {
            return;
        }

        setDeletingStoreCode(store.code);
        setActionError(null);

        try {
            await deleteDepartment(store.code);
            setStores((prev) => prev.filter((d) => d.code !== store.code));
            if (editingStore?.code === store.code) {
                cancelEditing();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to delete department. Please try again.';
            setActionError(message);
            console.error(err);
        } finally {
            setDeletingStoreCode(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">Stores</h1>
            <div className="bg-white rounded-lg border border-zinc-200">
                <div className="px-6 py-4 border-b border-zinc-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-zinc-900">Store Directory</h2>
                    <button
                        onClick={handleToggleForm}
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        type="button"
                    >
                        {isFormOpen ? 'Close Form' : 'Add Store'}
                    </button>
                </div>
                {isFormOpen && (
                    <div className="px-6 py-4 border-b border-zinc-200 bg-emerald-50/40">
                        <form className="space-y-4" onSubmit={handleAddStore}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col">
                                    <label htmlFor="store-name" className="text-sm font-medium text-zinc-700">
                                        Store Name *
                                    </label>
                                    <input
                                        id="store-name"
                                        type="text"
                                        value={newStoreName}
                                        onChange={(event) => {
                                            setNewStoreName(event.target.value);
                                            if (formError) {
                                                setFormError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                        placeholder="e.g. Operations"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="store-code" className="text-sm font-medium text-zinc-700">
                                        Store Code *
                                    </label>
                                    <input
                                        id="store-code"
                                        type="text"
                                        value={newStoreCode}
                                        onChange={(event) => {
                                            setNewStoreCode(event.target.value);
                                            if (formError) {
                                                setFormError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                        placeholder="e.g. Operations (no spaces)"
                                        disabled={isSubmitting}
                                    />
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Unique code with no spaces (letters, numbers, underscores only)
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="store-description" className="text-sm font-medium text-zinc-700">
                                    Description (Optional)
                                </label>
                                <textarea
                                    id="store-description"
                                    value={newStoreDescription}
                                    onChange={(event) => setNewStoreDescription(event.target.value)}
                                    className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    placeholder="Brief description of this store"
                                    rows={2}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="store-status" className="text-sm font-medium text-zinc-700">
                                    Status
                                </label>
                                <select
                                    id="store-status"
                                    value={newStoreStatus}
                                    onChange={(event) => setNewStoreStatus(event.target.value as StoreStatus)}
                                    className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                    disabled={isSubmitting}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Frozen">Frozen</option>
                                </select>
                            </div>
                            {formError && <p className="text-sm text-red-600">{formError}</p>}
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Store'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleToggleForm}
                                    className="text-sm font-semibold text-zinc-600 hover:text-zinc-800"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {editingStore && (
                    <div className="px-6 py-4 border-b border-zinc-200 bg-sky-50/40">
                        <form className="space-y-4" onSubmit={handleUpdateStore}>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-semibold text-sky-900">Editing: {editingStore.name}</h3>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="text-xs font-semibold text-sky-700 hover:text-sky-900 disabled:text-sky-300"
                                    disabled={isEditing}
                                >
                                    Close editor
                                </button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col">
                                    <label htmlFor="edit-store-name" className="text-sm font-medium text-zinc-700">
                                        Store Name *
                                    </label>
                                    <input
                                        id="edit-store-name"
                                        type="text"
                                        value={editName}
                                        onChange={(event) => {
                                            setEditName(event.target.value);
                                            if (editError) {
                                                setEditError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                        placeholder="Update store name"
                                        disabled={isEditing}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="edit-store-code" className="text-sm font-medium text-zinc-700">
                                        Store Code *
                                    </label>
                                    <input
                                        id="edit-store-code"
                                        type="text"
                                        value={editCode}
                                        onChange={(event) => {
                                            setEditCode(event.target.value);
                                            if (editError) {
                                                setEditError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-zinc-100 disabled:text-zinc-500"
                                        placeholder="Update store code"
                                        disabled={isEditing || ['OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite'].includes(editingStore?.code || '')}
                                        title={['OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite'].includes(editingStore?.code || '') ? 'Cannot modify code for core system stores' : ''}
                                    />
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {['OEM', 'Operations', 'Projects', 'SalvageYard', 'Satellite'].includes(editingStore?.code || '')
                                            ? '⚠️ Code locked - core system store'
                                            : 'Unique code with no spaces (letters, numbers, underscores only)'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="edit-store-description" className="text-sm font-medium text-zinc-700">
                                    Description
                                </label>
                                <textarea
                                    id="edit-store-description"
                                    value={editDescription}
                                    onChange={(event) => setEditDescription(event.target.value)}
                                    className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                    placeholder="Brief description of this store"
                                    rows={2}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="flex flex-col">
                                <label htmlFor="edit-store-status" className="text-sm font-medium text-zinc-700">
                                    Status
                                </label>
                                <select
                                    id="edit-store-status"
                                    value={editStatus}
                                    onChange={(event) => setEditStatus(event.target.value as StoreStatus)}
                                    className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                    disabled={isEditing}
                                >
                                    <option value="Active">Active</option>
                                    <option value="Frozen">Frozen</option>
                                </select>
                            </div>
                            {editError && <p className="text-sm text-red-600">{editError}</p>}
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-300"
                                    disabled={isEditing}
                                >
                                    {isEditing ? 'Updating...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="text-sm font-semibold text-zinc-600 hover:text-zinc-800 disabled:text-zinc-300"
                                    disabled={isEditing}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {actionError && (
                    <div className="px-6 py-3 text-sm text-red-600 border-b border-zinc-200 bg-red-50">
                        {actionError}
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Code
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Description
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 px-6 text-zinc-500">
                                        Loading stores...
                                    </td>
                                </tr>
                            )}
                            {error && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 px-6 text-red-600">
                                        {error}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && stores.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 px-6 text-zinc-500">
                                        No stores found.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                !error &&
                                stores.map((store) => (
                                    <tr
                                        key={store.id}
                                        className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-zinc-900">
                                            {store.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-zinc-600">
                                            {store.code}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 text-sm">
                                            {store.description || <span className="text-zinc-400 italic">No description</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(store.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => startEditingStore(store)}
                                                    className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 disabled:text-zinc-300"
                                                    disabled={
                                                        isEditing ||
                                                        togglingStoreId === store.id ||
                                                        deletingStoreCode === store.code
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(store)}
                                                    className="text-sm font-semibold text-sky-600 hover:text-sky-500 disabled:text-sky-300"
                                                    disabled={togglingStoreId === store.id || deletingStoreCode === store.code}
                                                >
                                                    {togglingStoreId === store.id
                                                        ? store.status === 'Active'
                                                            ? 'Freezing...'
                                                            : 'Activating...'
                                                        : store.status === 'Active'
                                                        ? 'Freeze'
                                                        : 'Activate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteStore(store)}
                                                    className="text-sm font-semibold text-red-600 hover:text-red-500 disabled:text-red-300"
                                                    disabled={deletingStoreCode === store.code}
                                                >
                                                    {deletingStoreCode === store.code ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Stores;
