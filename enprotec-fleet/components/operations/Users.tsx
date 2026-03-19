import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase/client';
import { User, UserRole, UserStatus, Store, Department } from '../../types';
import UserEditModal from './UserEditModal';
import { createUserViaFunction, updateUserProfile, deleteUserViaFunction } from '../../services/userAdmin';
import { mapRawUserToUser } from '../../services/userProfile';
import { fetchDepartments } from '../../services/departmentService';

const getRoleBadge = (role: UserRole) => {
    const baseClasses = "px-2.5 py-1 text-xs font-medium rounded-full inline-block border";
    switch (role) {
        case UserRole.Admin: return <span className={`${baseClasses} bg-red-100 text-red-800 border-red-200`}>Admin</span>
        case UserRole.OperationsManager: return <span className={`${baseClasses} bg-indigo-100 text-indigo-800 border-indigo-200`}>Ops Manager</span>
        case UserRole.EquipmentManager: return <span className={`${baseClasses} bg-purple-100 text-purple-800 border-purple-200`}>Equip. Manager</span>
        case UserRole.StockController: return <span className={`${baseClasses} bg-sky-100 text-sky-800 border-sky-200`}>Stock Controller</span>
        case UserRole.Storeman: return <span className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200`}>Storeman</span>
        case UserRole.SiteManager: return <span className={`${baseClasses} bg-amber-100 text-amber-800 border-amber-200`}>Site Manager</span>
        case UserRole.ProjectManager: return <span className={`${baseClasses} bg-cyan-100 text-cyan-800 border-cyan-200`}>Project Manager</span>
        case UserRole.Driver: return <span className={`${baseClasses} bg-teal-100 text-teal-800 border-teal-200`}>Driver</span>
        case UserRole.Security: return <span className={`${baseClasses} bg-zinc-100 text-zinc-800 border-zinc-200`}>Security</span>
        default: return <span className={`${baseClasses} bg-zinc-100 text-zinc-700 border-zinc-300`}>{role}</span>;
    }
}

const getStatusBadge = (status: UserStatus) => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full";
    switch (status) {
        case UserStatus.Active: return <span className={`${baseClasses} bg-emerald-100 text-emerald-800`}>Active</span>
        case UserStatus.Inactive: return <span className={`${baseClasses} bg-zinc-100 text-zinc-800`}>Inactive</span>
        default: return null;
    }
}

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            console.info('[Supabase] fetching user directory');
            const { data, error } = await supabase.from('enprotec_users').select('*');
            if (error) throw error;
            console.info('[Supabase] fetched user directory count', data?.length ?? 0);
            const mapped = (data as any[] | null)
                ?.map(mapRawUserToUser)
                .filter((u): u is User => Boolean(u));
            setUsers(mapped ?? []);
        } catch (err) {
            setError('Failed to fetch users.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        loadDepartments();
    }, []);

    const loadDepartments = async () => {
        try {
            const depts = await fetchDepartments();
            setDepartments(depts);
        } catch (err) {
            console.error('Failed to load departments:', err);
        }
    };

    const getDepartmentName = (code: string): string => {
        const dept = departments.find(d => d.code === code);
        return dept ? dept.name : code;
    };

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        return users.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleAddNewUser = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (userToSave: Partial<User> & { password?: string }) => {
        if (userToSave.id) {
            const { id, password, ...updates } = userToSave;
            const { error: errorMessage } = await updateUserProfile(id, updates);
            if (errorMessage) {
                alert('Failed to update user.');
                console.error(errorMessage);
            }
        } else {
            const { name, email, role, sites, password, departments } = userToSave;
            if (!password) {
                alert("Password is required for new users.");
                return;
            }

            const { error, user: createdUser } = await createUserViaFunction({
                name: name!,
                email: email!,
                password,
                role: role!,
                sites: sites ?? [],
                departments: departments ?? [],
                status: UserStatus.Active,
            });

            if (error) {
                alert(error);
                console.error(error);
            } else if (!createdUser) {
                alert('Supabase did not return the created user.');
            }
        }
        setIsModalOpen(false);
        fetchUsers();
    };

    const toggleUserStatus = async (user: User) => {
        const newStatus = user.status === UserStatus.Active ? UserStatus.Inactive : UserStatus.Active;

        const { error } = await supabase
            .from('enprotec_users')
            .update({ status: newStatus })
            .eq('id', user.id);

        if (error) {
            alert('Failed to update user status.');
            console.error(error);
        } else {
            fetchUsers();
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;

        setIsDeleting(true);
        try {
            const { error } = await deleteUserViaFunction(deletingUser.id);

            if (error) {
                alert(`Failed to delete user: ${error}`);
                console.error('Delete user error:', error);
            } else {
                setDeletingUser(null);
                fetchUsers();
            }
        } catch (err) {
            alert('Failed to delete user. Please try again.');
            console.error('Delete user exception:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-bold text-zinc-900 self-start md:self-center">Users & Roles</h1>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-full md:w-64 relative">
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 pl-10 bg-white border border-zinc-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-zinc-900"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <button
                            onClick={handleAddNewUser}
                            className="flex-shrink-0 px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors"
                        >
                            Add New User
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-zinc-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-zinc-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assigned Sites</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Assigned Stores</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={6} className="text-center py-12 px-6 text-zinc-500">Loading users...</td></tr>
                                )}
                                {error && (
                                    <tr><td colSpan={6} className="text-center py-12 px-6 text-red-600">{error}</td></tr>
                                )}
                                {!loading && !error && filteredUsers.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-12 px-6 text-zinc-500">{searchTerm ? 'No users match your search.' : 'No users found.'}</td></tr>
                                )}
                                {!loading && !error && filteredUsers.map((user) => (
                                    <tr key={user.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-zinc-900">{user.name}</div>
                                            <div className="text-zinc-500">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.sites && user.sites.length > 0 ? (
                                                    user.sites.map(site => (
                                                        <span key={site} className="inline-block bg-zinc-100 text-zinc-700 rounded-full px-2 py-0.5 text-xs font-medium border border-zinc-200">
                                                            {site}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-zinc-400 text-xs">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.departments && user.departments.length > 0 ? (
                                                    user.departments.map(deptCode => (
                                                        <span key={deptCode} className="inline-block bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 text-xs font-medium border border-sky-200">
                                                            {getDepartmentName(deptCode)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-zinc-400 text-xs">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-4">
                                            <button
                                                onClick={() => toggleUserStatus(user)}
                                                className="text-zinc-500 hover:text-zinc-800 font-medium"
                                                title={user.status === UserStatus.Active ? 'Deactivate User' : 'Activate User'}
                                            >
                                                {user.status === UserStatus.Active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="text-sky-600 hover:text-sky-500 font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => setDeletingUser(user)}
                                                className="text-red-600 hover:text-red-500 font-medium"
                                                title="Delete User"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <UserEditModal
                    user={editingUser}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveUser}
                />
            )}
            {deletingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-zinc-900 mb-3">Delete User</h3>
                        <p className="text-zinc-700 mb-2">
                            Are you sure you want to delete this user? This action cannot be undone.
                        </p>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3 mb-4">
                            <div className="font-semibold text-zinc-900">{deletingUser.name}</div>
                            <div className="text-sm text-zinc-600">{deletingUser.email}</div>
                            <div className="text-sm text-zinc-600 mt-1">{deletingUser.role}</div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeletingUser(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Users;
