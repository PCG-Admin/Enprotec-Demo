import * as React from 'react';
import {
  AlertTriangle, CheckCircle, Clock, Calendar,
  Search, AlertCircle, RefreshCw, Plus, X, Loader2,
  ChevronLeft, ChevronRight, LayoutList, Trash2,
} from 'lucide-react';
import {
  getComplianceSchedule, createComplianceEntry, updateComplianceEntry,
  markCompleted, syncComplianceStatuses, deleteComplianceEntry,
  type ComplianceInsert,
} from '../../supabase/services/compliance.service';
import { getVehicles } from '../../supabase/services/vehicles.service';
import { getInspections } from '../../supabase/services/inspections.service';
import { getProfiles } from '../../supabase/services/profiles.service';
import { logAction } from '../../supabase/services/audit.service';
import type { ComplianceRow, CompStatus, InspectionRow, ProfileRow } from '../../supabase/database.types';
import type { VehicleRow } from '../../supabase/database.types';
import type { User } from '../../types';

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'Overdue',   label: 'Overdue' },
  { key: 'Due Soon',  label: 'Due Soon' },
  { key: 'Scheduled', label: 'Scheduled' },
  { key: 'Completed', label: 'Completed' },
];

const INSPECTION_TYPES = [
  'Pre-use Inspection',
  'Weekly Inspection',
  'Monthly Service',
  'Certificate of Fitness (COF)',
  'Safety Inspection',
  'Roadworthy Test',
  'Other',
];

const daysRemaining = (dueDate: string) =>
  Math.round((new Date(dueDate).getTime() - Date.now()) / (1000 * 86400));

const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

const StatusBadge: React.FC<{ status: CompStatus; due_date: string; notifyOverdue: boolean }> = ({ status, due_date, notifyOverdue }) => {
  const days = daysRemaining(due_date);
  switch (status) {
    case 'Overdue':
      return notifyOverdue
        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="h-3 w-3 mr-1" />Overdue · {fmtDate(due_date)}
          </span>
        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            Overdue · {fmtDate(due_date)}
          </span>;
    case 'Due Soon':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <Clock className="h-3 w-3 mr-1" />Due {fmtDate(due_date)} ({days}d)
      </span>;
    case 'Scheduled':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Calendar className="h-3 w-3 mr-1" />Scheduled · {fmtDate(due_date)}
      </span>;
    case 'Completed':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />Done
      </span>;
  }
};

// vehicleRegDisplay is local UI state only — not sent to DB
const EMPTY_FORM = {
  vehicle_id:         '',
  vehicleRegDisplay:  '',
  inspection_type:    INSPECTION_TYPES[0],
  due_date:           '',
  scheduled_date:     '',
  notes:              '',
  assigned_to:        '',   // UUID of assignee
};

const Compliance: React.FC<{ user: User | null }> = ({ user }) => {
  const notifyOverdue: boolean = React.useMemo(() => {
    try { const s = JSON.parse(localStorage.getItem('enprotec_settings') ?? '{}'); return s.notifyOverdue !== false; } catch { return true; }
  }, []);

  const [schedule, setSchedule]           = React.useState<ComplianceRow[]>([]);
  const [vehicles, setVehicles]           = React.useState<VehicleRow[]>([]);
  const [profiles, setProfiles]           = React.useState<ProfileRow[]>([]);
  const [inspectionRecs, setInspectionRecs] = React.useState<InspectionRow[]>([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [searchTerm, setSearchTerm]     = React.useState('');
  const [showModal, setShowModal]       = React.useState(false);
  const [form, setForm]                 = React.useState({ ...EMPTY_FORM });
  const [saving, setSaving]             = React.useState(false);
  const [saveError, setSaveError]       = React.useState<string | null>(null);
  const [viewMode, setViewMode]         = React.useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth]         = React.useState(() => { const d = new Date(); d.setDate(1); return d; });

  const load = React.useCallback(async (sync = false) => {
    setLoading(true);
    setError(null);
    try {
      await syncComplianceStatuses();
      const [s, v, insp, p] = await Promise.all([getComplianceSchedule(), getVehicles(), getInspections(), getProfiles()]);
      setSchedule(s);
      setVehicles(v);
      setInspectionRecs(insp);
      setProfiles(p);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const overdue   = schedule.filter(s => s.status === 'Overdue');
  const dueSoon   = schedule.filter(s => s.status === 'Due Soon');
  const completed = schedule.filter(s => s.status === 'Completed');
  const total     = schedule.length;
  const complianceScore = total > 0 ? Math.round(((total - overdue.length) / total) * 100) : 100;

  const filtered = schedule.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const q = searchTerm.toLowerCase();
    const reg = s.vehicle?.registration ?? '';
    const assigneeName = s.assignee?.name ?? profiles.find(p => p.id === s.assigned_to)?.name ?? '';
    const matchSearch = !q ||
      reg.toLowerCase().includes(q) ||
      s.inspection_type.toLowerCase().includes(q) ||
      assigneeName.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleVehicleInput = (reg: string) => {
    const v = vehicles.find(v => v.registration === reg);
    setForm(p => ({ ...p, vehicle_id: v?.id ?? '', vehicleRegDisplay: reg }));
  };

  const openModal = (prefillDate?: string) => {
    setSaveError(null);
    setForm({ ...EMPTY_FORM, ...(prefillDate ? { due_date: prefillDate } : {}) });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.due_date) return;
    setSaving(true);
    setSaveError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const days = daysRemaining(form.due_date);
      let status: CompStatus = 'Scheduled';
      if (form.due_date < today) status = 'Overdue';
      else if (days <= 14) status = 'Due Soon';

      const payload: ComplianceInsert = {
        vehicle_id:     form.vehicle_id || null,
        inspection_type: form.inspection_type,
        due_date:       form.due_date,
        scheduled_date: form.scheduled_date || null,
        completed_date: null,
        status,
        notes:          form.notes || null,
        assigned_to:    form.assigned_to || null,
      };
      const created = await createComplianceEntry(payload);
      setSchedule(p => [...p, created].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      // Navigate calendar to the month of the new entry
      const [y, m] = created.due_date.slice(0, 7).split('-').map(Number);
      setCalMonth(new Date(y, m - 1, 1));
      setViewMode('calendar');
      const vReg = form.vehicleRegDisplay || 'vehicle';
      if (user) logAction(user.id, user.name, 'Created', 'Compliance', `Scheduled ${payload.inspection_type} for ${vReg} — due ${payload.due_date}`);
      setShowModal(false);
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      const updated = await markCompleted(id);
      const entry = schedule.find(s => s.id === id);
      setSchedule(p => p.map(s => s.id === id ? updated : s));
      if (user) logAction(user.id, user.name, 'Completed', 'Compliance', `Marked ${entry?.inspection_type ?? 'entry'} for ${entry?.vehicle?.registration ?? '—'} as completed`);
    } catch (e: any) {
      alert('Failed to mark as completed: ' + e.message);
    }
  };

  const handleDelete = async (id: string, vehicle: string, inspectionType: string) => {
    if (!window.confirm(`Delete compliance entry for ${vehicle}?`)) return;
    try {
      await deleteComplianceEntry(id);
      setSchedule(p => p.filter(s => s.id !== id));
      if (user) logAction(user.id, user.name, 'Deleted', 'Compliance', `Deleted ${inspectionType} for ${vehicle}`);
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
  };

  const handleRefresh = () => load(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading compliance data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
        <button onClick={() => load()} className="ml-auto text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Compliance & Scheduling</h1>
        <div className="flex gap-2">
          {/* List / Calendar toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-2 flex items-center gap-1 text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <LayoutList className="h-4 w-4" />List
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 flex items-center gap-1 text-sm border-l border-gray-300 ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Calendar className="h-4 w-4" />Calendar
            </button>
          </div>
          <button onClick={handleRefresh}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm">
            <RefreshCw className="h-4 w-4 mr-2" />Sync Status
          </button>
          <button onClick={openModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm">
            <Plus className="h-4 w-4 mr-2" />Schedule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Compliance Score</p>
          <p className={`text-3xl font-bold mt-1 ${complianceScore >= 80 ? 'text-green-600' : complianceScore >= 60 ? 'text-orange-500' : 'text-red-600'}`}>
            {complianceScore}%
          </p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${complianceScore >= 80 ? 'bg-green-500' : complianceScore >= 60 ? 'bg-orange-400' : 'bg-red-500'}`}
              style={{ width: `${complianceScore}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-3xl font-bold mt-1 text-red-600">{overdue.length}</p>
          <p className="text-xs text-gray-400 mt-1">Immediate action needed</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Due Soon</p>
          <p className="text-3xl font-bold mt-1 text-orange-500">{dueSoon.length}</p>
          <p className="text-xs text-gray-400 mt-1">Within 14 days</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{completed.length}</p>
          <p className="text-xs text-gray-400 mt-1">This period</p>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="font-semibold text-red-800">
              Overdue Inspections — Immediate Action Required ({overdue.length})
            </h3>
          </div>
          <div className="space-y-2">
            {overdue.map(entry => (
              <div key={entry.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
                <div>
                  <span className="font-medium text-gray-900">{entry.inspection_type}</span>
                  <span className="text-gray-400 text-sm ml-2">({entry.vehicle?.registration ?? 'Unknown'})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-600 text-sm font-medium">
                    {Math.abs(daysRemaining(entry.due_date))} days overdue
                  </span>
                  <button onClick={() => handleMarkCompleted(entry.id)}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                    Mark Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar View ── */}
      {viewMode === 'calendar' && (() => {
        const year  = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthLabel = calMonth.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
        const today = new Date().toISOString().slice(0, 10);

        // Map items by scheduled_date (if set) AND due_date so both appear on calendar
        const byDate: Record<string, Array<ComplianceRow & { _calType: 'scheduled' | 'due' }>> = {};
        const addToDate = (key: string, item: ComplianceRow, type: 'scheduled' | 'due') => {
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push({ ...item, _calType: type });
        };
        schedule.forEach(s => {
          if (s.scheduled_date) addToDate(s.scheduled_date.slice(0, 10), s, 'scheduled');
          addToDate(s.due_date.slice(0, 10), s, 'due');
        });

        const statusDot: Record<string, string> = {
          Overdue: 'bg-red-500', 'Due Soon': 'bg-orange-400',
          Scheduled: 'bg-blue-400', Completed: 'bg-green-500', 'Scheduled Date': 'bg-purple-500',
        };

        const cells = Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />);
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const items   = byDate[dateStr] ?? [];
          const isToday = dateStr === today;
          cells.push(
            <div key={dateStr} onClick={() => openModal(dateStr)}
              className={`min-h-[80px] border border-gray-200 rounded p-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}>
              <p className={`text-xs font-bold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>{d}</p>
              {items.slice(0, 3).map((item, i) => (
                <div key={`${item.id}-${i}`} className={`text-[10px] rounded px-1 py-0.5 mb-0.5 text-white truncate ${item._calType === 'scheduled' ? 'bg-purple-500' : (statusDot[item.status] ?? 'bg-gray-400')}`}
                  title={`${item._calType === 'scheduled' ? 'Scheduled' : 'Due'}: ${item.vehicle?.registration ?? '?'} — ${item.inspection_type}`}>
                  {item._calType === 'scheduled' ? '📅 ' : ''}{item.vehicle?.registration ?? '?'}: {item.inspection_type}
                </div>
              ))}
              {items.length > 3 && <p className="text-[10px] text-gray-400">+{items.length - 3} more</p>}
            </div>
          );
        }

        return (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="p-1 rounded hover:bg-gray-100"><ChevronLeft className="h-5 w-5"/></button>
              <h3 className="text-base font-semibold text-gray-800">{monthLabel}</h3>
              <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="p-1 rounded hover:bg-gray-100"><ChevronRight className="h-5 w-5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{cells}</div>
            <div className="flex gap-4 mt-3 flex-wrap">
              {Object.entries(statusDot).map(([s, cls]) => (
                <span key={s} className="flex items-center gap-1 text-xs text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${cls}`}/>{s}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Filters + Table (list view) */}
      {viewMode === 'list' && <><div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search vehicle, inspection type, assigned to…"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === f.key ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Inspection Schedule</h3>
          <span className="text-sm text-gray-500">{filtered.length} entries</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar className="mx-auto h-10 w-10 mb-2 opacity-40" />
            <p>No entries match your filters.</p>
            {schedule.length === 0 && (
              <p className="text-sm mt-1">Click "Schedule Inspection" to add your first entry.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspection Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map(entry => (
                  <tr key={entry.id} className={`hover:bg-gray-50 ${entry.status === 'Overdue' ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 font-medium text-gray-900 text-sm">
                      {entry.vehicle?.registration ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-sm">{entry.inspection_type}</td>
                    <td className="px-6 py-4 text-gray-600 text-sm font-medium">{entry.due_date}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={entry.status} due_date={entry.due_date} notifyOverdue={notifyOverdue} />
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{entry.assignee?.name ?? profiles.find(p => p.id === entry.assigned_to)?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm max-w-xs truncate">{entry.notes ?? '—'}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        return (
                          <div className="flex flex-col gap-1.5">
                            {entry.status !== 'Completed' && (
                              <button onClick={() => handleMarkCompleted(entry.id)}
                                className="text-xs text-green-700 border border-green-300 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100 font-medium">
                                Mark Done
                              </button>
                            )}
                            <button onClick={() => handleDelete(entry.id, entry.vehicle?.registration ?? '—', entry.inspection_type)}
                              className="inline-flex items-center gap-1 text-xs text-red-600 border border-red-200 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100 font-medium">
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div></>}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Inspection</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                <select
                  value={form.vehicleRegDisplay}
                  onChange={e => handleVehicleInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select vehicle —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.registration}>{v.registration} — {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Type *</label>
                <select required value={form.inspection_type}
                  onChange={e => setForm(p => ({ ...p, inspection_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {INSPECTION_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                  <input type="date" required value={form.due_date}
                    onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                  <input type="date" value={form.scheduled_date}
                    onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <select value={form.assigned_to}
                  onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">— Not assigned —</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes…" />
              </div>
              {saveError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{saveError}
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compliance;
