import React, { useState } from 'react';
import { supabase } from '../../supabase/client';
import type { Database } from '../../supabase/database.types';

type DriverInsert = Database['public']['Tables']['en_inspection_report_drivers']['Insert'];
type DriverRow = Database['public']['Tables']['en_inspection_report_drivers']['Row'];

interface CreateDriverFormProps {
  onSuccess: (driver: DriverRow) => void;
  onCancel: () => void;
  assignedVehicleOptions: Array<{ id: string; label: string }>;
}

const CreateDriverForm: React.FC<CreateDriverFormProps> = ({ onSuccess, onCancel, assignedVehicleOptions }) => {
  const [form, setForm] = useState<DriverInsert>({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    assigned_vehicle: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof DriverInsert, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (!form.full_name?.trim()) {
      setError('Driver name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: DriverInsert = {
        full_name: form.full_name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        department: form.department?.trim() || null,
        assigned_vehicle: form.assigned_vehicle || null,
      };

      const { data, error: insertError } = await supabase
        .from('en_inspection_report_drivers')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        onSuccess(data as DriverRow);
      }
    } catch (submitError: any) {
      console.error(submitError);
      setError(submitError.message ?? 'Unable to create driver.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Full Name *</label>
        <input
          type="text"
          value={form.full_name}
          onChange={event => handleChange('full_name', event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          placeholder="Driver full name"
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Assigned Vehicle</label>
        <select
          value={form.assigned_vehicle ?? ''}
          onChange={event =>
            setForm(prev => ({
              ...prev,
              assigned_vehicle: event.target.value ? event.target.value : null,
            }))
          }
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="">No vehicle</option>
          {assignedVehicleOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Email</label>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={event => handleChange('email', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="driver@example.com"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Phone</label>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={event => handleChange('phone', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="+27 ..."
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Store</label>
        <input
          type="text"
          value={form.department ?? ''}
          onChange={event => handleChange('department', event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          placeholder="Operations"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Driver'}
        </button>
      </div>
    </form>
  );
};

export default CreateDriverForm;
