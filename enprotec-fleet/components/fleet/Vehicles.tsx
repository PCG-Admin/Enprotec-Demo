import * as React from 'react';
import { Search, Plus, Edit2, Trash2, Camera, X, Car, CheckCircle, Wrench, XCircle } from 'lucide-react';
import {
  getVehicles, createVehicle, updateVehicle, deleteVehicle, uploadVehiclePhoto,
  type VehicleInsert,
} from '../../supabase/services/vehicles.service';
import { getSites } from '../../supabase/services/sites.service';
import { getProfiles } from '../../supabase/services/profiles.service';
import { logAction } from '../../supabase/services/audit.service';
import type { VehicleRow, SiteRow, ProfileRow } from '../../supabase/database.types';
import type { User } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  'Active':           'bg-emerald-100 text-emerald-700',
  'In Maintenance':   'bg-amber-100   text-amber-700',
  'Inactive':         'bg-zinc-100    text-zinc-600',
  'Decommissioned':   'bg-red-100     text-red-700',
};

const EMPTY_FORM: VehicleInsert = {
  registration: '', make: '', model: '', vehicle_type: '', year: null,
  vin: null, serial_number: null, fuel_type: 'Diesel',
  current_hours: 0, current_mileage: 0,
  site_id: null, assigned_driver_id: null,
  purchase_date: null, acquisition_cost: null,
  last_inspection_date: null, next_inspection_date: null,
  status: 'Active', photo_url: null, notes: null,
};

const INPUT = 'w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent';

const F: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>
    {children}
  </div>
);

const Vehicles: React.FC<{ user: User | null }> = ({ user }) => {
  const [vehicles, setVehicles]     = React.useState<VehicleRow[]>([]);
  const [sites, setSites]           = React.useState<SiteRow[]>([]);
  const [drivers, setDrivers]       = React.useState<ProfileRow[]>([]);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState('');
  const [search, setSearch]         = React.useState('');
  const [filterStatus, setFilter]   = React.useState('All');
  const [showModal, setShowModal]   = React.useState(false);
  const [editId, setEditId]         = React.useState<string | null>(null);
  const [form, setForm]             = React.useState<VehicleInsert>(EMPTY_FORM);
  const [photoFile, setPhotoFile]   = React.useState<File | null>(null);
  const [photoPreview, setPreview]  = React.useState<string | null>(null);
  const [saving, setSaving]         = React.useState(false);
  const [saveError, setSaveError]   = React.useState('');

  const load = async () => {
    try {
      const [v, s, p] = await Promise.all([getVehicles(), getSites(), getProfiles()]);
      setVehicles(v);
      setSites(s);
      setDrivers(p);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null); setForm(EMPTY_FORM);
    setPhotoFile(null); setPreview(null); setSaveError('');
    setShowModal(true);
  };

  const openEdit = (v: VehicleRow) => {
    setEditId(v.id);
    setForm({
      registration: v.registration, make: v.make, model: v.model,
      vehicle_type: v.vehicle_type, year: v.year, vin: v.vin,
      serial_number: v.serial_number, fuel_type: v.fuel_type,
      current_hours: v.current_hours, current_mileage: v.current_mileage,
      site_id: v.site_id, assigned_driver_id: v.assigned_driver_id,
      purchase_date: v.purchase_date, acquisition_cost: v.acquisition_cost,
      last_inspection_date: v.last_inspection_date, next_inspection_date: v.next_inspection_date,
      status: v.status, photo_url: v.photo_url, notes: v.notes,
    });
    setPhotoFile(null); setPreview(v.photo_url ?? null); setSaveError('');
    setShowModal(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const field = (key: keyof VehicleInsert, value: any) =>
    setForm(f => ({ ...f, [key]: value === '' ? null : value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setSaveError('');
    try {
      if (editId) {
        let updated = await updateVehicle(editId, form);
        if (photoFile) {
          const url = await uploadVehiclePhoto(photoFile, editId);
          updated = await updateVehicle(editId, { photo_url: url });
        }
        setVehicles(vs => vs.map(v => v.id === editId ? updated : v));
        if (user) logAction(user.id, user.name, 'Updated', 'Vehicles', `Updated vehicle ${form.registration}`);
      } else {
        const created = await createVehicle(form);
        let final = created;
        if (photoFile) {
          const url = await uploadVehiclePhoto(photoFile, created.id);
          final = await updateVehicle(created.id, { photo_url: url });
        }
        setVehicles(vs => [final, ...vs]);
        if (user) logAction(user.id, user.name, 'Created', 'Vehicles', `Added vehicle ${form.registration} (${form.make} ${form.model})`);
      }
      setShowModal(false);
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return;
    try {
      await deleteVehicle(id);
      setVehicles(vs => vs.filter(v => v.id !== id));
      if (user) logAction(user.id, user.name, 'Deleted', 'Vehicles', `Deleted vehicle ${id}`);
    } catch (e: any) {
      alert(e.message ?? 'Delete failed.');
    }
  };

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      v.registration.toLowerCase().includes(q) ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      (v.site?.name ?? '').toLowerCase().includes(q) ||
      (v.driver?.name ?? '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'All' || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: vehicles.length,
    active: vehicles.filter(v => v.status === 'Active').length,
    maintenance: vehicles.filter(v => v.status === 'In Maintenance').length,
    inactive: vehicles.filter(v => v.status === 'Inactive').length + vehicles.filter(v => v.status === 'Decommissioned').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Vehicles</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{counts.total} vehicles in fleet</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',          value: counts.total,       icon: <Car className="w-5 h-5 text-sky-500" />,       bg: 'bg-sky-50'     },
          { label: 'Active',         value: counts.active,      icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
          { label: 'In Maintenance', value: counts.maintenance, icon: <Wrench className="w-5 h-5 text-amber-500" />,   bg: 'bg-amber-50'   },
          { label: 'Inactive',       value: counts.inactive,    icon: <XCircle className="w-5 h-5 text-zinc-400" />,   bg: 'bg-zinc-50'    },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            {s.icon}
            <div><p className="text-2xl font-bold text-zinc-900">{s.value}</p><p className="text-xs text-zinc-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search registration, make, model, site, driver…"
            className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
        </div>
        <select value={filterStatus} onChange={e => setFilter(e.target.value)}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:ring-2 focus:ring-sky-500">
          {['All', 'Active', 'In Maintenance', 'Inactive', 'Decommissioned'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>{['Photo','Registration','Make / Model','Type','Site','Driver','Status','Next Inspection',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-zinc-400 text-sm">
                  {vehicles.length === 0 ? 'No vehicles yet. Click "Add Vehicle" to get started.' : 'No vehicles match your search.'}
                </td></tr>
              ) : filtered.map(v => (
                <tr key={v.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    {v.photo_url
                      ? <img src={v.photo_url} alt={v.registration} className="w-12 h-10 object-cover rounded-lg border border-zinc-200" />
                      : <div className="w-12 h-10 bg-zinc-100 rounded-lg flex items-center justify-center"><Car className="w-5 h-5 text-zinc-300" /></div>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-900">{v.registration}</td>
                  <td className="px-4 py-3 text-zinc-600">{v.make} {v.model}</td>
                  <td className="px-4 py-3 text-zinc-500">{v.vehicle_type || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{v.site?.name || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 max-w-[140px] truncate">{v.driver?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const today = new Date().toISOString().slice(0, 10);
                      const d = v.next_inspection_date;
                      if (!d) return <span className="text-zinc-400 text-xs">Not set</span>;
                      const daysLeft = Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
                      if (daysLeft < 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue · {d}</span>;
                      if (daysLeft <= 7) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Due Soon · {d}</span>;
                      return <span className="text-xs text-zinc-600">{d}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-zinc-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-lg font-semibold text-zinc-900">{editId ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-zinc-100 rounded-lg"><X className="w-5 h-5 text-zinc-500" /></button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">
                {/* Photo */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Vehicle Photo</label>
                  <div className="flex items-center gap-4">
                    {photoPreview
                      ? <img src={photoPreview} alt="preview" className="w-24 h-20 object-cover rounded-xl border border-zinc-200" />
                      : <div className="w-24 h-20 bg-zinc-100 rounded-xl flex items-center justify-center border-2 border-dashed border-zinc-300"><Car className="w-8 h-8 text-zinc-300" /></div>}
                    <label className="flex items-center gap-2 cursor-pointer bg-sky-50 text-sky-700 border border-sky-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-100 transition-colors">
                      <Camera className="w-4 h-4" />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Registration *"><input required value={form.registration} onChange={e => field('registration', e.target.value)} className={INPUT} placeholder="e.g. HYR549MP" /></F>
                  <F label="Status">
                    <select value={form.status} onChange={e => field('status', e.target.value)} className={INPUT}>
                      {['Active','In Maintenance','Inactive','Decommissioned'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </F>
                  <F label="Make *"><input required value={form.make} onChange={e => field('make', e.target.value)} className={INPUT} placeholder="e.g. TOYOTA" /></F>
                  <F label="Model *"><input required value={form.model} onChange={e => field('model', e.target.value)} className={INPUT} placeholder="e.g. Hilux 2.8 Legend" /></F>
                  <F label="Vehicle Type">
                    <select value={form.vehicle_type ?? ''} onChange={e => field('vehicle_type', e.target.value)} className={INPUT}>
                      <option value="">Select type</option>
                      {['Bakkie','Truck','Minibus','SUV','Sedan','MPV','Van'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </F>
                  <F label="Year"><input type="number" value={form.year ?? ''} onChange={e => field('year', e.target.value ? +e.target.value : null)} className={INPUT} placeholder="e.g. 2022" min={1990} max={2030} /></F>
                  <F label="VIN"><input value={form.vin ?? ''} onChange={e => field('vin', e.target.value)} className={INPUT} placeholder="VIN number" /></F>
                  <F label="Fuel Type">
                    <select value={form.fuel_type ?? 'Diesel'} onChange={e => field('fuel_type', e.target.value)} className={INPUT}>
                      {['Diesel','Petrol','Electric','Hybrid'].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </F>
                  <F label="Current Mileage (km)"><input type="number" value={form.current_mileage ?? 0} onChange={e => field('current_mileage', +e.target.value)} className={INPUT} min={0} /></F>
                  <F label="Current Hours"><input type="number" value={form.current_hours ?? 0} onChange={e => field('current_hours', +e.target.value)} className={INPUT} min={0} /></F>
                  <F label="Site">
                    <select value={form.site_id ?? ''} onChange={e => field('site_id', e.target.value || null)} className={INPUT}>
                      <option value="">— Select site —</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </F>
                  <F label="Assigned Driver">
                    <select value={form.assigned_driver_id ?? ''} onChange={e => field('assigned_driver_id', e.target.value || null)} className={INPUT}>
                      <option value="">— No driver assigned —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </F>
                  <F label="Purchase Date"><input type="date" value={form.purchase_date ?? ''} onChange={e => field('purchase_date', e.target.value)} className={INPUT} /></F>
                  <F label="Acquisition Cost (R)"><input type="number" value={form.acquisition_cost ?? ''} onChange={e => field('acquisition_cost', e.target.value ? +e.target.value : null)} className={INPUT} min={0} /></F>
                  <F label="Last Inspection Date"><input type="date" value={form.last_inspection_date ?? ''} onChange={e => field('last_inspection_date', e.target.value)} className={INPUT} /></F>
                  <div>
                    <F label="Next Inspection Date"><input type="date" value={form.next_inspection_date ?? ''} onChange={e => field('next_inspection_date', e.target.value)} className={INPUT} /></F>
                    <div className="flex gap-1 mt-1">
                      <span className="text-xs text-zinc-400 self-center mr-1">Quick set:</span>
                      {[['Daily', 1], ['Weekly', 7], ['Monthly', 30]] .map(([label, days]) => {
                        const base = form.last_inspection_date ?? new Date().toISOString().slice(0, 10);
                        const d = new Date(base); d.setDate(d.getDate() + (days as number));
                        const val = d.toISOString().slice(0, 10);
                        return (
                          <button key={label as string} type="button" onClick={() => field('next_inspection_date', val)}
                            className="px-2 py-0.5 text-xs border border-zinc-300 rounded hover:bg-sky-50 hover:border-sky-400 hover:text-sky-700 transition-colors">
                            {label as string}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <F label="Notes"><textarea value={form.notes ?? ''} onChange={e => field('notes', e.target.value)} className={INPUT + ' resize-none'} rows={3} placeholder="Additional notes…" /></F>

                {saveError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{saveError}</div>}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-sky-600 text-white text-sm font-medium rounded-lg hover:bg-sky-700 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
