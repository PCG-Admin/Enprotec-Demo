import * as React from 'react';
import {
  Plus, Edit2, Trash2, X, Search, MapPin,
  Shield, ToggleLeft, ToggleRight, Loader2, AlertCircle,
} from 'lucide-react';
import type { User } from '../../types';
import { UserRole } from '../../types';
import type { ProfileRow, SiteRow, AuditRow, UserStatus } from '../../supabase/database.types';
import { getProfiles, updateProfile, setUserStatus } from '../../supabase/services/profiles.service';
import { createFleetUser, deleteFleetUser } from '../../supabase/services/auth.service';
import { getSites, createSite, updateSite, deleteSite } from '../../supabase/services/sites.service';
import { getAuditLog, logAction } from '../../supabase/services/audit.service';

const TABS = ['Users', 'Sites', 'Settings', 'Audit Log'];

const ACTION_COLORS: Record<string, string> = {
  Created:  'bg-green-100 text-green-700',
  Added:    'bg-green-100 text-green-700',
  Updated:  'bg-blue-100 text-blue-700',
  Uploaded: 'bg-blue-100 text-blue-700',
  Deleted:  'bg-red-100 text-red-700',
  Login:    'bg-gray-100 text-gray-600',
};

const ROLES = [
  'Admin', 'Operations Manager', 'Equipment Manager', 'Stock Controller',
  'Storeman', 'Site Manager', 'Project Manager', 'Driver', 'Security',
];

interface AdministrationProps {
  currentUser: User;
}

const Administration: React.FC<AdministrationProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = React.useState(0);

  // ── Users state ──────────────────────────────────────────────────────────
  const [profiles, setProfiles]         = React.useState<ProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [usersError, setUsersError]     = React.useState<string | null>(null);
  const [searchUser, setSearchUser]     = React.useState('');
  const [showUserModal, setShowUserModal]   = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<ProfileRow | null>(null);
  const [userForm, setUserForm] = React.useState({ name: '', email: '', password: '', role: 'Driver' });
  const [userSaving, setUserSaving]     = React.useState(false);
  const [userSaveErr, setUserSaveErr]   = React.useState<string | null>(null);

  // ── Sites state ──────────────────────────────────────────────────────────
  const [sites, setSites]               = React.useState<SiteRow[]>([]);
  const [sitesLoading, setSitesLoading] = React.useState(true);
  const [sitesError, setSitesError]     = React.useState<string | null>(null);
  const [searchSite, setSearchSite]     = React.useState('');
  const [showSiteModal, setShowSiteModal]   = React.useState(false);
  const [editingSite, setEditingSite]       = React.useState<SiteRow | null>(null);
  const [siteForm, setSiteForm] = React.useState({ name: '' });
  const [siteSaving, setSiteSaving]     = React.useState(false);
  const [siteSaveErr, setSiteSaveErr]   = React.useState<string | null>(null);

  // ── Audit state ──────────────────────────────────────────────────────────
  const [auditLog, setAuditLog]           = React.useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading]   = React.useState(false);
  const [auditLoaded, setAuditLoaded]     = React.useState(false);
  const [auditSearch, setAuditSearch]     = React.useState('');
  const [auditModule, setAuditModule]     = React.useState('All');
  const [auditAction, setAuditAction]     = React.useState('All');

  // ── Settings state (persisted to localStorage) ────────────────────────────
  const [settings, setSettings] = React.useState(() => {
    try {
      const saved = localStorage.getItem('enprotec_settings');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      companyName: 'WMS/FMS',
      companyEmail:        '',
      companyPhone:        '',
      companyAddress:      '',
      companyWebsite:      '',
      officeLabel:         '',
      poBox:               '',
      directors:           '',
      companyReg:          '',
      vatNumber:           '',
      notifyOverdue:       true,
      notifyLicenseExpiry: true,
      notifyCostThreshold: false,
      costThreshold:       '50000',
      defaultFrequency:    'Monthly',
      licenseWarnDays30:   true,
      licenseWarnDays14:   true,
      licenseWarnDays7:    true,
    };
  });
  const [settingsSaved, setSettingsSaved] = React.useState(false);

  // Auto-save settings to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('enprotec_settings', JSON.stringify(settings));
  }, [settings]);

  const saveSettings = () => {
    localStorage.setItem('enprotec_settings', JSON.stringify(settings));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  // ── Load data ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    getProfiles()
      .then(p => setProfiles(p))
      .catch(e => setUsersError(e.message ?? 'Failed to load users'))
      .finally(() => setUsersLoading(false));

    getSites()
      .then(s => setSites(s))
      .catch(e => setSitesError(e.message ?? 'Failed to load sites'))
      .finally(() => setSitesLoading(false));
  }, []);

  // Load audit log lazily when tab is opened
  React.useEffect(() => {
    if (activeTab === 3 && !auditLoaded) {
      setAuditLoading(true);
      getAuditLog(100)
        .then(a => { setAuditLog(a); setAuditLoaded(true); })
        .catch(() => {})
        .finally(() => setAuditLoading(false));
    }
  }, [activeTab, auditLoaded]);

  // Access guard
  if (currentUser.role !== UserRole.Admin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-lg font-medium text-gray-900">Access Restricted</p>
          <p className="text-gray-500 mt-1">Administration is available to Admins only.</p>
        </div>
      </div>
    );
  }

  // ── User helpers ─────────────────────────────────────────────────────────
  const filteredUsers = profiles.filter(u =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const openUserModal = (profile?: ProfileRow) => {
    setUserSaveErr(null);
    setEditingProfile(profile ?? null);
    setUserForm(profile
      ? { name: profile.name, email: profile.email, password: '', role: profile.role as UserRole }
      : { name: '', email: '', password: '', role: 'Driver' }
    );
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email) return;
    setUserSaving(true);
    setUserSaveErr(null);
    try {
      if (editingProfile) {
        const updated = await updateProfile(editingProfile.id, { name: userForm.name, role: userForm.role as any });
        setProfiles(p => p.map(u => u.id === editingProfile.id ? updated : u));
        logAction(currentUser.id, currentUser.name, 'Updated', 'Administration', `Updated user "${userForm.name}" role to ${userForm.role}`);
      } else {
        if (!userForm.password || userForm.password.length < 6) {
          setUserSaveErr('Password must be at least 6 characters.');
          setUserSaving(false);
          return;
        }
        const { error } = await createFleetUser(userForm.email, userForm.password, userForm.name, userForm.role);
        if (error) { setUserSaveErr(error); setUserSaving(false); return; }
        // Reload profiles to get the new user
        const fresh = await getProfiles();
        setProfiles(fresh);
        logAction(currentUser.id, currentUser.name, 'Created', 'Administration', `Created user "${userForm.name}" (${userForm.email}) as ${userForm.role}`);
      }
      setShowUserModal(false);
    } catch (e: any) {
      setUserSaveErr(e.message ?? 'Save failed');
    } finally {
      setUserSaving(false);
    }
  };

  const toggleUserStatus = async (profile: ProfileRow) => {
    const next: UserStatus = profile.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await setUserStatus(profile.id, next);
      setProfiles(p => p.map(u => u.id === profile.id ? { ...u, status: next } : u));
    } catch (e: any) {
      alert('Failed to update status: ' + e.message);
    }
  };

  const handleDeleteUser = async (profile: ProfileRow) => {
    if (profile.id === currentUser.id) {
      alert('You cannot delete your own account.');
      return;
    }
    if (!confirm(`Delete user "${profile.name}" (${profile.email})? This cannot be undone.`)) return;
    const { error } = await deleteFleetUser(profile.id);
    if (error) { alert('Delete failed: ' + error); return; }
    setProfiles(p => p.filter(u => u.id !== profile.id));
    logAction(currentUser.id, currentUser.name, 'Deleted', 'Administration', `Deleted user "${profile.name}" (${profile.email})`);
  };

  // ── Site helpers ─────────────────────────────────────────────────────────
  const filteredSites = sites.filter(s =>
    s.name.toLowerCase().includes(searchSite.toLowerCase())
  );

  const openSiteModal = (site?: SiteRow) => {
    setSiteSaveErr(null);
    setEditingSite(site ?? null);
    setSiteForm(site
      ? { name: site.name }
      : { name: '' }
    );
    setShowSiteModal(true);
  };

  const saveSite = async () => {
    if (!siteForm.name) return;
    // Prevent duplicate site names
    const nameExists = sites.some(s => s.name.toLowerCase() === siteForm.name.toLowerCase() && s.id !== editingSite?.id);
    if (nameExists) { setSiteSaveErr(`A site named "${siteForm.name}" already exists.`); return; }
    setSiteSaving(true);
    setSiteSaveErr(null);
    try {
      if (editingSite) {
        const updated = await updateSite(editingSite.id, { name: siteForm.name });
        setSites(p => p.map(s => s.id === editingSite.id ? updated : s));
        logAction(currentUser.id, currentUser.name, 'Updated', 'Administration', `Updated site "${siteForm.name}"`);
      } else {
        const created = await createSite({ name: siteForm.name });
        setSites(p => [...p, created]);
        logAction(currentUser.id, currentUser.name, 'Created', 'Administration', `Created site "${siteForm.name}"`);
      }
      setShowSiteModal(false);
    } catch (e: any) {
      setSiteSaveErr(e.message ?? 'Save failed');
    } finally {
      setSiteSaving(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm('Delete this site? Vehicles assigned to it will be unlinked.')) return;
    try {
      await deleteSite(id);
      setSites(p => p.filter(s => s.id !== id));
      logAction(currentUser.id, currentUser.name, 'Deleted', 'Administration', `Deleted site ${id}`);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  // ── Role badge ────────────────────────────────────────────────────────────
  const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
    const cfg: Record<string, string> = {
      'Admin':           'bg-purple-100 text-purple-800',
      'Fleet Coordinator': 'bg-blue-100 text-blue-800',
      'Driver':          'bg-gray-100 text-gray-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg[role] ?? 'bg-gray-100 text-gray-700'}`}>{role}</span>;
  };

  // ── Toggle switch ─────────────────────────────────────────────────────────
  const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
    <button onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Administration</h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Users Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{profiles.length} registered users</p>
            <button onClick={() => openUserModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm">
              <Plus className="h-4 w-4 mr-1.5" />Add User
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search users…" value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500">Loading users…</span>
            </div>
          ) : usersError ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />{usersError}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{user.email}</td>
                      <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>{user.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openUserModal(user)} className="text-blue-600 hover:text-blue-800" title="Edit role / name">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleUserStatus(user)}
                            title={user.status === 'Active' ? 'Deactivate' : 'Activate'}
                            className={user.status === 'Active' ? 'text-gray-400 hover:text-gray-600' : 'text-green-500 hover:text-green-700'}>
                            {user.status === 'Active' ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                          </button>
                          {user.id !== currentUser.id && (
                            <button onClick={() => handleDeleteUser(user)} className="text-red-500 hover:text-red-700" title="Delete user">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sites Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{sites.length} sites configured</p>
            <button onClick={() => openSiteModal()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm">
              <Plus className="h-4 w-4 mr-1.5" />Add Site
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search sites…" value={searchSite}
              onChange={e => setSearchSite(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          {sitesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500">Loading sites…</span>
            </div>
          ) : sitesError ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />{sitesError}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSites.map(site => (
                <div key={site.id} className="bg-white rounded-lg shadow p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center mt-0.5">
                        <MapPin className="h-3 w-3 mr-1" />{site.status}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      site.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>{site.status}</span>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openSiteModal(site)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
                      <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                    </button>
                    <button onClick={() => handleDeleteSite(site.id)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                    </button>
                  </div>
                </div>
              ))}
              {filteredSites.length === 0 && (
                <p className="col-span-3 text-center text-gray-400 text-sm py-8">No sites found.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ──────────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div className="max-w-2xl space-y-6">

          {/* Company Details */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Company Details</h3>
            <p className="text-xs text-gray-500">These appear on every inspection PDF report.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'companyName',    label: 'Company Name',    type: 'text'  },
                { key: 'officeLabel',    label: 'Office Label',    type: 'text',  placeholder: 'e.g. South African Head Office' },
                { key: 'companyEmail',   label: 'Email Address',   type: 'email' },
                { key: 'companyPhone',   label: 'Phone Number',    type: 'tel'   },
                { key: 'companyWebsite', label: 'Website',         type: 'text'  },
                { key: 'companyReg',     label: 'Company Reg No.', type: 'text'  },
                { key: 'vatNumber',      label: 'VAT Number',      type: 'text'  },
              ] as { key: keyof typeof settings; label: string; type: string; placeholder?: string }[]).map(({ key, label, type, placeholder }) => (
                <div key={String(key)}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={settings[key] as string}
                    placeholder={placeholder ?? ''}
                    onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={settings.companyAddress}
                onChange={e => setSettings(p => ({ ...p, companyAddress: e.target.value }))}
                placeholder="e.g. 13 Insimbi St, Industria, Middelburg, 1050"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PO Box</label>
              <input type="text" value={settings.poBox ?? ''}
                onChange={e => setSettings(p => ({ ...p, poBox: e.target.value }))}
                placeholder="e.g. PO Box 14945, Mineralia, Middelburg, 1050"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Directors</label>
              <input type="text" value={settings.directors ?? ''}
                onChange={e => setSettings(p => ({ ...p, directors: e.target.value }))}
                placeholder="e.g. JR Fourie (Managing) | BN Ditsepu (Executive)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Inspection Frequency</label>
              <select value={settings.defaultFrequency}
                onChange={e => setSettings(p => ({ ...p, defaultFrequency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
            <div className="space-y-3">
              {([
                { key: 'notifyOverdue',       label: 'Overdue inspection alerts',    desc: 'Show alert when an inspection is past its due date' },
                { key: 'notifyLicenseExpiry', label: 'License expiry reminders',     desc: 'Show warnings when licenses are nearing expiry' },
                { key: 'notifyCostThreshold', label: 'Monthly cost threshold alerts', desc: 'Alert when vehicle costs exceed a set monthly limit' },
              ] as { key: keyof typeof settings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={String(key)} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <Toggle on={!!settings[key]} onChange={() => setSettings(p => ({ ...p, [key]: !p[key] }))} />
                </div>
              ))}
            </div>

            {/* License warning thresholds */}
            {settings.notifyLicenseExpiry && (
              <div className="pl-2 pt-1 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Warn me at:</p>
                {([
                  { key: 'licenseWarnDays30', label: '30 days before expiry', color: 'amber'  },
                  { key: 'licenseWarnDays14', label: '14 days before expiry', color: 'orange' },
                  { key: 'licenseWarnDays7',  label: '7 days before expiry',  color: 'red'    },
                ] as { key: keyof typeof settings; label: string; color: string }[]).map(({ key, label }) => (
                  <label key={String(key)} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={!!settings[key]}
                      onChange={() => setSettings(p => ({ ...p, [key]: !p[key] }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {/* Cost threshold input */}
            {settings.notifyCostThreshold && (
              <div className="pl-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Cost Threshold (R)</label>
                <input type="number" value={settings.costThreshold}
                  onChange={e => setSettings(p => ({ ...p, costThreshold: e.target.value }))}
                  className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <button
            onClick={saveSettings}
            className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
              settingsSaved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {settingsSaved ? '✓ Settings Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* ── Audit Log Tab ─────────────────────────────────────────────────── */}
      {activeTab === 3 && (() => {
        const modules = ['All', ...Array.from(new Set(auditLog.map(e => e.module))).sort()];
        const actions = ['All', ...Array.from(new Set(auditLog.map(e => e.action))).sort()];
        const filtered = auditLog.filter(e => {
          if (auditModule !== 'All' && e.module !== auditModule) return false;
          if (auditAction !== 'All' && e.action !== auditAction) return false;
          if (auditSearch) {
            const q = auditSearch.toLowerCase();
            return e.user_name.toLowerCase().includes(q) || (e.details ?? '').toLowerCase().includes(q);
          }
          return true;
        });
        return (
          <div className="space-y-3">
            {/* Filter bar */}
            <div className="bg-white rounded-lg shadow p-3 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user or details…"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select value={auditModule} onChange={e => setAuditModule(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500">
                {modules.map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500">
                {actions.map(a => <option key={a}>{a}</option>)}
              </select>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {filtered.length} of {auditLog.length} entries
              </span>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">System Audit Log</h3>
                  <p className="text-xs text-gray-500">Read-only record of all system actions</p>
                </div>
              </div>
              {auditLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-500">Loading audit log…</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filtered.map(entry => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                            {new Date(entry.created_at).toLocaleString('en-ZA')}
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-800">{entry.user_name}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">{entry.module}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">{entry.details}</td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">
                          {auditLog.length === 0 ? 'No audit entries yet.' : 'No entries match the current filters.'}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── User Modal ────────────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{editingProfile ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={userForm.name}
                  onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., John Smith" />
              </div>
              {!editingProfile && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input type="email" value={userForm.email}
                      onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="john@wmsfms.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input type="password" value={userForm.password}
                      onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="Min. 6 characters" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select value={userForm.role}
                  onChange={e => setUserForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {userSaveErr && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{userSaveErr}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowUserModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveUser} disabled={userSaving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {userSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingProfile ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Site Modal ────────────────────────────────────────────────────── */}
      {showSiteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{editingSite ? 'Edit Site' : 'Add Site'}</h3>
              <button onClick={() => setShowSiteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site Name *</label>
                <input type="text" value={siteForm.name}
                  onChange={e => setSiteForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Grootegeluk Mine" />
              </div>
              {siteSaveErr && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{siteSaveErr}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSiteModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveSite} disabled={siteSaving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {siteSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingSite ? 'Save Changes' : 'Add Site'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Administration;
