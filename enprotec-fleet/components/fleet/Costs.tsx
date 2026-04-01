import * as React from 'react';
import {
  DollarSign, Plus, Edit, Trash2, X, Search,
  TrendingUp, Download, Filter, AlertCircle, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  getCosts, createCost, updateCost, deleteCost, getMonthlyCostTotals,
  type CostInsert,
} from '../../supabase/services/costs.service';
import { getVehicles } from '../../supabase/services/vehicles.service';
import { logAction } from '../../supabase/services/audit.service';
import type { CostRow, CostCat } from '../../supabase/database.types';
import type { VehicleRow } from '../../supabase/database.types';
import type { User } from '../../types';

const CATEGORIES: CostCat[] = ['Fuel', 'Maintenance', 'Tyres', 'Insurance', 'Licensing', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Fuel:        '#3b82f6',
  Maintenance: '#10b981',
  Tyres:       '#f59e0b',
  Insurance:   '#8b5cf6',
  Licensing:   '#f97316',
  Other:       '#6b7280',
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#6b7280'];

// vehicleRegDisplay is local UI state only — not sent to DB
const EMPTY_FORM = {
  vehicle_id: '',
  vehicleRegDisplay: '',
  date: new Date().toISOString().split('T')[0],
  category: 'Fuel' as CostCat,
  amount: '',
  description: '',
  supplier: '',
  invoice_number: '',
  rto_number: '',
  po_number: '',
  quote_number: '',
  km_reading: '',
  created_by: null as string | null,
};

const exportCSV = (data: CostRow[]) => {
  const header = ['DATE', 'VEHICLE', 'RTO NUMBER', 'PO NUMBER', 'INVOICE NUMBER', 'QUOTE NUMBER', 'SUPPLIER', 'DESCRIPTION', 'KM', 'TYPE', 'AMOUNT EXCL'];
  const rows = data.map(c => [
    c.date,
    c.vehicle?.registration ?? c.vehicle_id,
    c.rto_number ?? '',
    c.po_number ?? '',
    c.invoice_number ?? '',
    c.quote_number ?? '',
    c.supplier ?? '',
    c.description,
    c.km_reading ?? '',
    c.category,
    c.amount.toFixed(2),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'wms-fms-costs.csv'; a.click();
  URL.revokeObjectURL(url);
};

const Costs: React.FC<{ user: User | null }> = ({ user }) => {
  const [costs, setCosts]           = React.useState<CostRow[]>([]);
  const [vehicles, setVehicles]     = React.useState<VehicleRow[]>([]);
  const [trendData, setTrendData]   = React.useState<{ month: string; total: number }[]>([]);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterCat, setFilterCat]   = React.useState('All');
  const [filterVeh, setFilterVeh]   = React.useState('All');
  const [showModal, setShowModal]   = React.useState(false);
  const [editId, setEditId]         = React.useState<string | null>(null);
  const [form, setForm]             = React.useState({ ...EMPTY_FORM });
  const [saving, setSaving]         = React.useState(false);
  const [saveError, setSaveError]   = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, v, trend] = await Promise.all([getCosts(), getVehicles(), getMonthlyCostTotals(6)]);
      setCosts(c);
      setVehicles(v);
      setTrendData(trend.map(t => ({ month: t.month, total: t.total })));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load costs');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filteredCosts = costs.filter(c => {
    const reg = c.vehicle?.registration ?? '';
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      reg.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      (c.supplier ?? '').toLowerCase().includes(q);
    const matchCat = filterCat === 'All' || c.category === filterCat;
    const matchVeh = filterVeh === 'All' || reg === filterVeh;
    return matchSearch && matchCat && matchVeh;
  });

  const totalCost  = filteredCosts.reduce((s, c) => s + c.amount, 0);
  const fuelCost   = filteredCosts.filter(c => c.category === 'Fuel').reduce((s, c) => s + c.amount, 0);
  const maintCost  = filteredCosts.filter(c => c.category === 'Maintenance' || c.category === 'Tyres').reduce((s, c) => s + c.amount, 0);
  const uniqVehs   = new Set(filteredCosts.map(c => c.vehicle_id)).size;
  const avgPerVeh  = uniqVehs > 0 ? totalCost / uniqVehs : 0;

  const catData = CATEGORIES.map(cat => ({
    name: cat,
    value: costs.filter(c => c.category === cat).reduce((s, c) => s + c.amount, 0),
  })).filter(d => d.value > 0);

  const uniqueVehicleRegs = [...new Set(costs.map(c => c.vehicle?.registration).filter(Boolean) as string[])].sort();

  const openModal = (cost?: CostRow) => {
    setSaveError(null);
    if (cost) {
      setEditId(cost.id);
      setForm({
        vehicle_id: cost.vehicle_id,
        vehicleRegDisplay: cost.vehicle?.registration ?? '',
        date: cost.date,
        category: cost.category,
        amount: cost.amount.toString(),
        description: cost.description,
        supplier: cost.supplier ?? '',
        invoice_number: cost.invoice_number ?? '',
        rto_number: cost.rto_number ?? '',
        po_number: cost.po_number ?? '',
        quote_number: cost.quote_number ?? '',
        km_reading: cost.km_reading ?? '',
        created_by: cost.created_by,
      });
    } else {
      setEditId(null);
      setForm({ ...EMPTY_FORM, created_by: user?.id ?? null });
    }
    setShowModal(true);
  };

  const handleVehicleSelect = (reg: string) => {
    const v = vehicles.find(v => v.registration === reg);
    setForm(p => ({ ...p, vehicle_id: v?.id ?? '', vehicleRegDisplay: reg }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload: CostInsert = {
        vehicle_id: form.vehicle_id,
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        description: form.description,
        supplier: form.supplier || null,
        invoice_number: form.invoice_number || null,
        rto_number: form.rto_number || null,
        po_number: form.po_number || null,
        quote_number: form.quote_number || null,
        km_reading: form.km_reading || null,
        receipt_url: null,
        created_by: form.created_by,
      };
      const vReg = form.vehicleRegDisplay || 'vehicle';
      if (editId) {
        const updated = await updateCost(editId, payload);
        setCosts(p => p.map(c => c.id === editId ? updated : c));
        if (user) logAction(user.id, user.name, 'Updated', 'Costs', `Updated ${payload.category} cost for ${vReg} — R${payload.amount}`);
      } else {
        const created = await createCost(payload);
        setCosts(p => [created, ...p]);
        if (user) logAction(user.id, user.name, 'Created', 'Costs', `Added ${payload.category} cost for ${vReg} — R${payload.amount}`);
      }
      setShowModal(false);
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cost entry?')) return;
    try {
      await deleteCost(id);
      setCosts(p => p.filter(c => c.id !== id));
      if (user) logAction(user.id, user.name, 'Deleted', 'Costs', `Deleted cost entry ${id}`);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading costs…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
        <button onClick={load} className="ml-auto text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Cost Tracking</h1>
        <div className="flex gap-3">
          <button onClick={() => exportCSV(filteredCosts)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm">
            <Download className="h-4 w-4 mr-2" />Export CSV
          </button>
          <button onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm">
            <Plus className="h-5 w-5 mr-2" />Add Cost
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Cost',        value: `R ${totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <DollarSign className="h-6 w-6 text-blue-600"  />, bg: 'bg-blue-100'  },
          { label: 'Fuel',              value: `R ${fuelCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  icon: <TrendingUp  className="h-6 w-6 text-green-600" />, bg: 'bg-green-100' },
          { label: 'Maint. & Tyres',    value: `R ${maintCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp  className="h-6 w-6 text-yellow-600"/>, bg: 'bg-yellow-100'},
          { label: 'Avg per Vehicle',   value: `R ${avgPerVeh.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  icon: <DollarSign  className="h-6 w-6 text-purple-600"/>, bg: 'bg-purple-100'},
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center">
              <div className={`${s.bg} p-3 rounded-full`}>{s.icon}</div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Cost Trend (R)</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 11 }} />
                <YAxis stroke="#888" tick={{ fontSize: 11 }} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`R ${v.toLocaleString()}`, 'Total']} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Cost by Category</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `R ${v.toLocaleString()}`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by vehicle, description, supplier…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-gray-400" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterVeh} onChange={e => setFilterVeh(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="All">All Vehicles</option>
              {uniqueVehicleRegs.map(reg => {
                const v = vehicles.find(v => v.registration === reg);
                return <option key={reg} value={reg}>{reg}{v ? ` — ${v.make} ${v.model}` : ''}</option>;
              })}
            </select>
          </div>
        </div>

        {filteredCosts.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No cost entries found</h3>
            <p className="text-gray-500 text-sm mt-1">Add a cost entry to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCosts.map(cost => (
                  <tr key={cost.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 text-sm">
                      {cost.vehicle?.registration ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">{cost.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{ backgroundColor: (CATEGORY_COLORS[cost.category] ?? '#6b7280') + '20', color: CATEGORY_COLORS[cost.category] ?? '#6b7280' }}>
                        {cost.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900 text-sm">
                      R {cost.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-gray-600 text-sm">{cost.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{cost.supplier ?? '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button onClick={() => openModal(cost)} className="text-blue-600 hover:text-blue-900 mr-3">
                        <Edit className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleDelete(cost.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{editId ? 'Edit Cost Entry' : 'Add Cost Entry'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
                  <select required value={form.vehicleRegDisplay}
                    onChange={e => handleVehicleSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.registration}>{v.registration} — {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select required value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value as CostCat }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R) *</label>
                  <input type="number" step="0.01" min="0" required value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea rows={2} required value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Diesel fill-up, oil change…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input type="text" value={form.supplier}
                    onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Shell, Engen" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                  <input type="text" value={form.invoice_number}
                    onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="INV-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RTO Number</label>
                  <input type="text" value={form.rto_number}
                    onChange={e => setForm(p => ({ ...p, rto_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. E067414" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                  <input type="text" value={form.po_number}
                    onChange={e => setForm(p => ({ ...p, po_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. PO-0001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quote Number</label>
                  <input type="text" value={form.quote_number}
                    onChange={e => setForm(p => ({ ...p, quote_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. QUA64967" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">KM / Hours Reading</label>
                  <input type="text" value={form.km_reading}
                    onChange={e => setForm(p => ({ ...p, km_reading: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 285.2 or 492h" />
                </div>
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
                  {editId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Costs;
