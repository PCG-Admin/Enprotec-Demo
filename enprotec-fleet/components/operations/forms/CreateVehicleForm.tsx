import React, { useState } from 'react';
import { supabase } from '../../../supabase/client';
import type { Database } from '../../supabase/database.types';

type VehicleInsert = Database['public']['Tables']['en_inspection_report_vehicles']['Insert'];

interface CreateVehicleFormProps {
  onSuccess: (vehicle: Database['public']['Tables']['en_inspection_report_vehicles']['Row']) => void;
  onCancel: () => void;
}

const CreateVehicleForm: React.FC<CreateVehicleFormProps> = ({ onSuccess, onCancel }) => {
  const [form, setForm] = useState<VehicleInsert>({
    registration_number: '',
    make: '',
    model: '',
    license_expiry: '',
    current_odometer: undefined,
    next_service_km: undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key: keyof VehicleInsert, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNumberChange = (key: keyof VehicleInsert, value: string) => {
    if (!value.trim().length) {
      setForm(prev => ({
        ...prev,
        [key]: undefined,
      }));
      return;
    }
    const numeric = Number(value.replace(/[^\d.]/g, ''));
    if (Number.isNaN(numeric)) return;
    setForm(prev => ({
      ...prev,
      [key]: numeric,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (!form.registration_number?.trim()) {
      setError('Registration number is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: VehicleInsert = {
        ...form,
        registration_number: form.registration_number.trim(),
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        license_expiry: form.license_expiry?.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from('en_inspection_report_vehicles')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        onSuccess(data);
      }
    } catch (submitError: any) {
      console.error(submitError);
      setError(submitError.message ?? 'Unable to create vehicle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Registration Number *</label>
        <input
          type="text"
          value={form.registration_number}
          onChange={event => handleChange('registration_number', event.target.value.toUpperCase())}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          placeholder="e.g. ABC 123 GP"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Make</label>
          <input
            type="text"
            value={form.make ?? ''}
            onChange={event => handleChange('make', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="Toyota"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Model</label>
          <input
            type="text"
            value={form.model ?? ''}
            onChange={event => handleChange('model', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="Hilux"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">License Expiry</label>
        <input
          type="date"
          value={form.license_expiry ?? ''}
          onChange={event => handleChange('license_expiry', event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current Odometer (km)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.current_odometer ?? ''}
            onChange={event => handleNumberChange('current_odometer', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="e.g. 152000"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next Service at (km)</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.next_service_km ?? ''}
            onChange={event => handleNumberChange('next_service_km', event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="e.g. 155000"
          />
        </div>
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
          {loading ? 'Saving...' : 'Save Vehicle'}
        </button>
      </div>
    </form>
  );
};

export default CreateVehicleForm;
