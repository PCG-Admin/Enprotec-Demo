// FIX: Replaced placeholder content with a functional React component.
import React, { useEffect, useState, FormEvent } from 'react';
import { supabase } from '../supabase/client';
import { Site, SiteStatus } from '../types';

const getStatusBadge = (status: SiteStatus) => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full";
    switch (status) {
        case SiteStatus.Active:
            return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Active</span>;
        case SiteStatus.Frozen:
            return <span className={`${baseClasses} bg-zinc-100 text-zinc-800`}>Frozen</span>;
        default:
            return null;
    }
};

const Sites: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteStatus, setNewSiteStatus] = useState<SiteStatus>(SiteStatus.Active);
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
    const [togglingSiteId, setTogglingSiteId] = useState<string | null>(null);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [editName, setEditName] = useState('');
    const [editStatus, setEditStatus] = useState<SiteStatus>(SiteStatus.Active);
    const [editError, setEditError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const fetchSites = async () => {
        setLoading(true);
        setError(null);
        setActionError(null);
        try {
            const { data, error: fetchError } = await supabase.from('enprotec_sites').select('*').order('name');
            if (fetchError) {
                throw fetchError;
            }
            const safeData = (data as Site[]) ?? [];
            setSites([...safeData].sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            setError('Failed to fetch sites.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const startEditingSite = (site: Site) => {
        if (isFormOpen) {
            resetForm();
            setIsFormOpen(false);
        }
        setEditingSite(site);
        setEditName(site.name);
        setEditStatus(site.status);
        setEditError(null);
        setActionError(null);
    };

    const cancelEditing = () => {
        setEditingSite(null);
        setEditName('');
        setEditStatus(SiteStatus.Active);
        setEditError(null);
    };

    const handleUpdateSite = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingSite) return;

        const trimmedName = editName.trim();
        if (!trimmedName) {
            setEditError('Site name is required.');
            return;
        }

        setIsEditing(true);
        setEditError(null);
        setActionError(null);

        try {
            const { data, error: updateError } = await supabase
                .from('enprotec_sites')
                .update({ name: trimmedName, status: editStatus })
                .eq('id', editingSite.id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            if (data) {
                const updatedSite = data as Site;
                setSites((prev) => {
                    const next = prev.map((existing) =>
                        existing.id === updatedSite.id ? updatedSite : existing
                    );
                    return next.sort((a, b) => a.name.localeCompare(b.name));
                });
                cancelEditing();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update site.';
            setEditError(message);
            console.error(err);
        } finally {
            setIsEditing(false);
        }
    };

    const handleToggleStatus = async (site: Site) => {
        const nextStatus = site.status === SiteStatus.Active ? SiteStatus.Frozen : SiteStatus.Active;
        setTogglingSiteId(site.id);
        setActionError(null);

        try {
            const { data, error: statusError } = await supabase
                .from('enprotec_sites')
                .update({ status: nextStatus })
                .eq('id', site.id)
                .select()
                .single();

            if (statusError) {
                throw statusError;
            }

            if (data) {
                const updatedSite = data as Site;
                setSites((prev) => {
                    const next = prev.map((existing) =>
                        existing.id === updatedSite.id ? updatedSite : existing
                    );
                    return next.sort((a, b) => a.name.localeCompare(b.name));
                });

                if (editingSite?.id === site.id) {
                    setEditingSite(updatedSite);
                    setEditStatus(updatedSite.status);
                }
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Failed to update site status.';
            setActionError(message);
            console.error(err);
        } finally {
            setTogglingSiteId(null);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const resetForm = () => {
        setNewSiteName('');
        setNewSiteStatus(SiteStatus.Active);
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

    const handleAddSite = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = newSiteName.trim();

        if (!trimmedName) {
            setFormError('Site name is required.');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);
        setActionError(null);

        try {
            const { data, error: insertError } = await supabase
                .from('enprotec_sites')
                .insert({ name: trimmedName, status: newSiteStatus })
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            if (data) {
                setSites((prev) => [...prev, data as Site].sort((a, b) => a.name.localeCompare(b.name)));
                resetForm();
                setIsFormOpen(false);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to add site.';
            setFormError(message);
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSite = async (site: Site) => {
        const confirmDelete = window.confirm(`Delete ${site.name}? This cannot be undone.`);
        if (!confirmDelete) {
            return;
        }

        setDeletingSiteId(site.id);
        setActionError(null);

        try {
            const { error: deleteErr } = await supabase.from('enprotec_sites').delete().eq('id', site.id);
            if (deleteErr) {
                throw deleteErr;
            }

            setSites((prev) => prev.filter((existing) => existing.id !== site.id));
            if (editingSite?.id === site.id) {
                cancelEditing();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete site.';
            setActionError(message);
            console.error(err);
        } finally {
            setDeletingSiteId(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">Sites</h1>
            <div className="bg-white rounded-lg border border-zinc-200">
                <div className="px-6 py-4 border-b border-zinc-200 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-zinc-900">Site Directory</h2>
                    <button
                        onClick={handleToggleForm}
                        className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        type="button"
                    >
                        {isFormOpen ? 'Close Form' : 'Add Site'}
                    </button>
                </div>
                {isFormOpen && (
                    <div className="px-6 py-4 border-b border-zinc-200 bg-emerald-50/40">
                        <form className="space-y-4" onSubmit={handleAddSite}>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col">
                                    <label htmlFor="site-name" className="text-sm font-medium text-zinc-700">
                                        Site Name
                                    </label>
                                    <input
                                        id="site-name"
                                        type="text"
                                        value={newSiteName}
                                        onChange={(event) => {
                                            setNewSiteName(event.target.value);
                                            if (formError) {
                                                setFormError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                        placeholder="e.g. Site A"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="site-status" className="text-sm font-medium text-zinc-700">
                                        Status
                                    </label>
                                    <select
                                        id="site-status"
                                        value={newSiteStatus}
                                        onChange={(event) => setNewSiteStatus(event.target.value as SiteStatus)}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                        disabled={isSubmitting}
                                    >
                                        <option value={SiteStatus.Active}>Active</option>
                                        <option value={SiteStatus.Frozen}>Frozen</option>
                                    </select>
                                </div>
                            </div>
                            {formError && (
                                <p className="text-sm text-red-600">
                                    {formError}
                                </p>
                            )}
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Site'}
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
                {editingSite && (
                    <div className="px-6 py-4 border-b border-zinc-200 bg-sky-50/40">
                        <form className="space-y-4" onSubmit={handleUpdateSite}>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-semibold text-sky-900">
                                    Editing: {editingSite.name}
                                </h3>
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
                                    <label htmlFor="edit-site-name" className="text-sm font-medium text-zinc-700">
                                        Site Name
                                    </label>
                                    <input
                                        id="edit-site-name"
                                        type="text"
                                        value={editName}
                                        onChange={(event) => {
                                            setEditName(event.target.value);
                                            if (editError) {
                                                setEditError(null);
                                            }
                                        }}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                        placeholder="Update site name"
                                        disabled={isEditing}
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="edit-site-status" className="text-sm font-medium text-zinc-700">
                                        Status
                                    </label>
                                    <select
                                        id="edit-site-status"
                                        value={editStatus}
                                        onChange={(event) => setEditStatus(event.target.value as SiteStatus)}
                                        className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                        disabled={isEditing}
                                    >
                                        <option value={SiteStatus.Active}>Active</option>
                                        <option value={SiteStatus.Frozen}>Frozen</option>
                                    </select>
                                </div>
                            </div>
                            {editError && (
                                <p className="text-sm text-red-600">
                                    {editError}
                                </p>
                            )}
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Site Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={3} className="text-center py-12 px-6 text-zinc-500">Loading sites...</td>
                                </tr>
                            )}
                            {error && (
                                <tr>
                                    <td colSpan={3} className="text-center py-12 px-6 text-red-600">{error}</td>
                                </tr>
                            )}
                            {!loading && !error && sites.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center py-12 px-6 text-zinc-500">No sites found.</td>
                                </tr>
                            )}
                            {!loading && !error && sites.map((site) => (
                                <tr key={site.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-zinc-900">{site.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(site.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => startEditingSite(site)}
                                                className="text-sm font-semibold text-zinc-600 hover:text-zinc-900 disabled:text-zinc-300"
                                                disabled={isEditing || togglingSiteId === site.id || deletingSiteId === site.id}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(site)}
                                                className="text-sm font-semibold text-sky-600 hover:text-sky-500 disabled:text-sky-300"
                                                disabled={togglingSiteId === site.id || deletingSiteId === site.id}
                                            >
                                                {togglingSiteId === site.id
                                                    ? site.status === SiteStatus.Active
                                                        ? 'Freezing...'
                                                        : 'Activating...'
                                                    : site.status === SiteStatus.Active
                                                        ? 'Freeze'
                                                        : 'Activate'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSite(site)}
                                                className="text-sm font-semibold text-red-600 hover:text-red-500 disabled:text-red-300"
                                                disabled={deletingSiteId === site.id}
                                            >
                                                {deletingSiteId === site.id ? 'Deleting...' : 'Delete'}
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

export default Sites;
