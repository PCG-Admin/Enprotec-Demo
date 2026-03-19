import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import type { User } from '../types';
import {
  failureLabelForItem,
  isFailureAnswer,
  normaliseAnswer,
  requiresPhotoForItem,
} from '../utils/inspection';
import CreateVehicleForm from './forms/CreateVehicleForm';
import CreateDriverForm from './forms/CreateDriverForm';
import { sendInspectionCompletedWebhook } from '../services/inspectionService';

type InspectionItem = Database['public']['Tables']['en_inspection_report_items']['Row'];
type Vehicle = Database['public']['Tables']['en_inspection_report_vehicles']['Row'];
type DriverRow = Database['public']['Tables']['en_inspection_report_drivers']['Row'];

interface DriverOption {
  id: string;
  name: string;
}

interface InspectionReportProps {
  user: User;
  onSuccess: () => void;
}

interface InspectionResponseState {
  answer: 'yes' | 'no' | null;
  notes: string;
  file: File | null;
  filePreview: string | null;
  photoUrl?: string | null;
}

const defaultResponse: InspectionResponseState = {
  answer: null,
  notes: '',
  file: null,
  filePreview: null,
  photoUrl: null,
};

const STORAGE_BUCKET = 'enprotec_inspections';

const vehicleLabel = (vehicle: Vehicle): string => {
  const registration = vehicle.registration_number?.trim();
  const make = vehicle.make?.trim();
  const model = vehicle.model?.trim();
  const makeModel = [make, model].filter(Boolean).join(' ');
  return [registration, makeModel].filter(Boolean).join(' - ') || `Vehicle ${vehicle.id.slice(0, 6)}`;
};

const sortVehiclesByLabel = (list: Vehicle[]): Vehicle[] =>
  [...list].sort((a, b) => vehicleLabel(a).localeCompare(vehicleLabel(b)));

const sortDriverOptions = (options: DriverOption[]): DriverOption[] =>
  [...options].sort((a, b) => a.name.localeCompare(b.name));

const InspectionReport: React.FC<InspectionReportProps> = ({ user, onSuccess }) => {
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [responses, setResponses] = useState<Record<string, InspectionResponseState>>({});
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [odometer, setOdometer] = useState('');
  const [site, setSite] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isVehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [isDriverModalOpen, setDriverModalOpen] = useState(false);
  const vehicleOptions = useMemo(
    () => vehicles.map(vehicle => ({ id: vehicle.id, label: vehicleLabel(vehicle) })),
    [vehicles]
  );
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          { data: itemsData, error: itemsError },
          { data: vehicleData, error: vehiclesError },
          { data: driverRows, error: driversError },
        ] = await Promise.all([
          supabase
            .from('en_inspection_report_items')
            .select('*')
            .order('category', { ascending: true })
            .order('question', { ascending: true }),
          supabase
            .from('en_inspection_report_vehicles')
            .select('*')
            .order('registration_number', { ascending: true }),
          supabase
            .from('en_inspection_report_drivers')
            .select('*')
            .order('full_name', { ascending: true }),
        ]);

        if (itemsError) throw itemsError;
        if (vehiclesError) throw vehiclesError;
        if (driversError) throw driversError;

        const safeItems = itemsData ?? [];
        const safeVehicles = sortVehiclesByLabel(vehicleData ?? []);
        const driverOptions = sortDriverOptions((driverRows ?? []).map(mapDriverToOption));
        const normalizedUserEmail = user.email?.toLowerCase();
        const matchedDriverRow = (driverRows ?? []).find(row =>
          row.email ? row.email.toLowerCase() === normalizedUserEmail : false
        );

        if (isMounted) {
          setItems(safeItems);
          setVehicles(safeVehicles);
          setDrivers(driverOptions);

          const nextResponses: Record<string, InspectionResponseState> = {};
          safeItems.forEach(item => {
            nextResponses[item.id] = responses[item.id] ?? { ...defaultResponse };
          });
          setResponses(nextResponses);

          if (!selectedDriver && matchedDriverRow) {
            setSelectedDriver(matchedDriverRow.id);
            if (
              matchedDriverRow.assigned_vehicle &&
              safeVehicles.some(vehicle => vehicle.id === matchedDriverRow.assigned_vehicle)
            ) {
              setSelectedVehicle(matchedDriverRow.assigned_vehicle);
            }
          }
        }
      } catch (fetchError: any) {
        console.error(fetchError);
        if (isMounted) {
          setError(fetchError.message ?? 'Failed to load inspection data. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedItems = useMemo(() => {
    const byCategory = new Map<string, InspectionItem[]>();
    items.forEach(item => {
      const category = item.category?.trim() || 'General';
      const existing = byCategory.get(category) ?? [];
      existing.push(item);
      byCategory.set(category, existing);
    });

    return Array.from(byCategory.entries())
      .map(([category, groupItems]) => ({
        category,
        items: groupItems.sort((a, b) => {
          const questionA = a.question?.toLowerCase() ?? '';
          const questionB = b.question?.toLowerCase() ?? '';
          return questionA.localeCompare(questionB);
        }),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [items]);

  const totalItems = items.length;

  const answeredCount = useMemo(() => {
    if (!items.length) return 0;
    return items.reduce((count, item) => {
      const normalizedAnswer = normaliseAnswer(responses[item.id]?.answer);
      return normalizedAnswer ? count + 1 : count;
    }, 0);
  }, [items, responses]);

  const progressPercent = totalItems ? Math.round((answeredCount / totalItems) * 100) : 0;

  const isFormValid = useMemo(() => {
    if (!selectedVehicle || !selectedDriver) return false;
    return items.every(item => {
      const response = responses[item.id];
      const normalizedAnswer = normaliseAnswer(response?.answer);
      if (normalizedAnswer === null) return false;
      const failure = isFailureAnswer(item, normalizedAnswer);
      if (failure && requiresPhotoForItem(item) && !response?.file) return false;
      return true;
    });
  }, [items, responses, selectedDriver, selectedVehicle]);

  const handleAnswerChange = (item: InspectionItem, answer: 'yes' | 'no') => {
    setResponses(prev => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] ?? { ...defaultResponse }),
        answer,
        notes: isFailureAnswer(item, answer) ? prev[item.id]?.notes ?? '' : '',
      },
    }));
  };

  const handleNotesChange = (itemId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? { ...defaultResponse }),
        notes: value,
      },
    }));
  };

  const handleFileChange = (itemId: string, fileList: FileList | null) => {
    const file = fileList?.[0] ?? null;
    setResponses(prev => {
      const previous = prev[itemId];
      if (previous?.filePreview && previous.file) {
        URL.revokeObjectURL(previous.filePreview);
      }
      if (!file) {
        return {
          ...prev,
          [itemId]: {
            ...(previous ?? { ...defaultResponse }),
            file: null,
            filePreview: null,
          },
        };
      }

      const previewUrl = URL.createObjectURL(file);
      return {
        ...prev,
        [itemId]: {
          ...(previous ?? { ...defaultResponse }),
          file,
          filePreview: previewUrl,
        },
      };
    });
  };

  useEffect(() => {
    return () => {
      Object.values(responses).forEach(response => {
        if (response.filePreview) {
          URL.revokeObjectURL(response.filePreview);
        }
      });
    };
  }, [responses]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (success) {
      timeout = setTimeout(() => {
        onSuccess();
        setSuccess(false);
        setOdometer('');
        setSite('');
        // reset answers
        setResponses(current => {
          const cleared: Record<string, InspectionResponseState> = {};
          Object.keys(current).forEach(key => {
            const response = current[key];
            if (response.filePreview && response.file) {
              URL.revokeObjectURL(response.filePreview);
            }
            cleared[key] = { ...defaultResponse };
          });
          return cleared;
        });
      }, 1200);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [success, onSuccess]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const inspectionDate = new Date().toISOString().split('T')[0];
      const odometerValue = odometer ? Number(odometer) : null;
      const hasFailures = items.some(item => isFailureAnswer(item, responses[item.id]?.answer));
      const overallStatus = hasFailures ? 'fail' : 'pass';

      const { data: inspectionRecord, error: inspectionError } = await supabase
        .from('en_inspection_report_inspections')
        .insert({
          vehicle_id: selectedVehicle || null,
          driver_id: selectedDriver || null,
          inspection_date: inspectionDate,
          odometer: odometerValue,
          site: site || null,
          remarks: null,
          overall_status: overallStatus,
        })
        .select('id')
        .single();

      if (inspectionError || !inspectionRecord) {
        throw inspectionError ?? new Error('Failed to create inspection.');
      }

      const inspectionId = inspectionRecord.id;
      const uploadResults = await uploadPhotos(inspectionId, responses);

      const responsePayload = items.map(item => {
        const response = responses[item.id];
        const photoUrl = uploadResults.get(item.id) ?? response?.photoUrl ?? null;

        return {
          inspection_id: inspectionId,
          item_id: item.id,
          condition: response?.answer ?? 'yes',
          notes: response?.notes?.trim() ? response.notes.trim() : null,
          photo_url: photoUrl,
          storage_bucket: photoUrl ? STORAGE_BUCKET : null,
        };
      });

      const { error: responsesError } = await supabase
        .from('en_inspection_report_responses')
        .insert(responsePayload);

      if (responsesError) {
        throw responsesError;
      }

      try {
        await sendInspectionCompletedWebhook(inspectionId);
      } catch (webhookError) {
        console.error('Failed to send inspection completion webhook:', webhookError);
      }

      setSuccess(true);
    } catch (submitError: any) {
      console.error(submitError);
      setError(submitError.message ?? 'Failed to submit inspection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVehicleCreated = (vehicle: Vehicle) => {
    setVehicles(prev => sortVehiclesByLabel([...prev, vehicle]));
    setSelectedVehicle(vehicle.id);
    setVehicleModalOpen(false);
  };

  const handleDriverCreated = (driver: DriverRow) => {
    const option = mapDriverToOption(driver);
    setDrivers(prev => sortDriverOptions([...prev, option]));
    setSelectedDriver(driver.id);
    setDriverModalOpen(false);
  };

  return (
    <>
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Vehicle Safety</p>
        <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Vehicle Inspection Report</h1>
        <p className="text-sm text-zinc-500">
          Complete the daily inspection before the vehicle leaves site. Capture details for any defects.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Inspection saved. Redirecting to My Inspections...
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <span className="text-sm text-zinc-500">Loading inspection checklist...</span>
        </div>
      ) : (
        <form className="flex flex-col gap-6 pb-24" onSubmit={handleSubmit}>
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Inspection Details</h2>
              <p className="text-sm text-zinc-500">Log the vehicle, driver, and site context for today&apos;s inspection.</p>
            </div>
            <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <Field label="Vehicle" required>
                <div className="flex items-center gap-2">
                <select
                  className="w-full flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={selectedVehicle}
                  onChange={event => setSelectedVehicle(event.target.value)}
                >
                  <option value="">Select vehicle</option>
                  {vehicleOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(true)}
                  className="inline-flex items-center rounded-md border border-sky-200 px-3 py-2 text-xs font-medium text-sky-600 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Add Vehicle
                </button>
              </div>
            </Field>

              <Field label="Driver" required>
                <div className="flex items-center gap-2">
                <select
                  className="w-full flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={selectedDriver}
                  onChange={event => setSelectedDriver(event.target.value)}
                >
                  <option value="">Select driver</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setDriverModalOpen(true)}
                  className="inline-flex items-center rounded-md border border-sky-200 px-3 py-2 text-xs font-medium text-sky-600 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Add Driver
                </button>
              </div>
            </Field>

              <Field label="Odometer (km)">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={odometer}
                  onChange={event => setOdometer(event.target.value)}
                  placeholder="Enter odometer reading"
                />
              </Field>

              <Field label="Site / Project">
                <input
                  type="text"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  value={site}
                  onChange={event => setSite(event.target.value)}
                  placeholder="Where is the inspection taking place?"
                />
              </Field>
            </div>
          </section>

          {groupedItems.map(group => (
            <section key={group.category} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-zinc-900">{group.category}</h3>
                <p className="text-sm text-zinc-500">Confirm condition of each item below.</p>
              </div>
              <ul className="flex flex-col gap-4 px-6 py-6">
                {group.items.map(item => {
                  const response = responses[item.id] ?? defaultResponse;
                  const question = item.question ?? 'Checklist Item';
                  const requiresPhoto = requiresPhotoForItem(item);
                  const failureLabel = failureLabelForItem(item);
                  const isFailure = response.answer ? isFailureAnswer(item, response.answer) : false;

                  return (
                      <li key={item.id} className="rounded-lg border border-zinc-200 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="sm:w-2/3">
                            <p className="text-sm font-medium text-zinc-900">{question}</p>
                            {requiresPhoto && (
                              <span className="mt-1 inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                                Photo required when marked "{failureLabel}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <ToggleChip
                              active={response.answer === 'yes'}
                              intent="positive"
                              onClick={() => handleAnswerChange(item, 'yes')}
                            >
                              Yes
                            </ToggleChip>
                            <ToggleChip
                              active={response.answer === 'no'}
                              intent="negative"
                              onClick={() => handleAnswerChange(item, 'no')}
                            >
                              No
                            </ToggleChip>
                          </div>
                        </div>

                        {isFailure && (
                          <div className="mt-4 space-y-4 rounded-lg border border-red-100 bg-red-50/70 p-4">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-red-600">Notes</label>
                              <textarea
                                className="min-h-[96px] w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                                value={response.notes}
                                onChange={event => handleNotesChange(item.id, event.target.value)}
                                placeholder="Describe the issue and the corrective action required."
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-red-600">
                                Upload photo {requiresPhoto ? '(required for deviation)' : '(optional)'}
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={event => handleFileChange(item.id, event.target.files)}
                                className="block w-full text-sm text-zinc-800 file:mr-4 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-600 hover:file:bg-sky-100"
                              />
                              {response.file && <p className="text-xs text-zinc-500">Selected: {response.file.name}</p>}
                            </div>
                          </div>
                        )}
                        {!isFailure && (
                          <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
                            <label className="text-xs font-medium uppercase tracking-wide text-zinc-600">Upload photo (optional)</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={event => handleFileChange(item.id, event.target.files)}
                              className="block w-full text-sm text-zinc-800 file:mr-4 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-sky-600 hover:file:bg-sky-100"
                            />
                            {response.file && <p className="text-xs text-zinc-500">Selected: {response.file.name}</p>}
                          </div>
                        )}
                      </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="sticky bottom-0 left-0 right-0 mx-[-1rem] border-t border-zinc-200 bg-white/95 px-4 py-4 shadow-[0_-6px_12px_-10px_rgba(15,23,42,0.25)] backdrop-blur sm:mx-0 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-1">
                <p className="text-sm font-medium text-zinc-700">
                  {answeredCount} of {totalItems} checklist item{totalItems === 1 ? '' : 's'} answered
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-full rounded-full bg-zinc-200 sm:max-w-[240px]">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-sky-600">{progressPercent}%</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={!isFormValid || submitting}
                className="inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
              >
                {submitting ? 'Submitting...' : 'Submit Inspection'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
    {isVehicleModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-10">
        <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Add Vehicle</p>
              <h3 className="text-lg font-semibold text-zinc-900">Capture Fleet Vehicle</h3>
            </div>
            <button
              type="button"
              onClick={() => setVehicleModalOpen(false)}
              className="inline-flex items-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Close
            </button>
          </div>
          <div className="px-6 pb-6">
            <CreateVehicleForm
              onSuccess={handleVehicleCreated}
              onCancel={() => setVehicleModalOpen(false)}
            />
          </div>
        </div>
      </div>
    )}
    {isDriverModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-10">
        <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Add Driver</p>
              <h3 className="text-lg font-semibold text-zinc-900">Register Driver</h3>
            </div>
            <button
              type="button"
              onClick={() => setDriverModalOpen(false)}
              className="inline-flex items-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Close
            </button>
          </div>
          <div className="px-6 pb-6">
            <CreateDriverForm
              onSuccess={handleDriverCreated}
              onCancel={() => setDriverModalOpen(false)}
              assignedVehicleOptions={vehicleOptions}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

const mapDriverToOption = (row: DriverRow): DriverOption => ({
  id: row.id,
  name: row.full_name?.trim()?.length ? row.full_name : 'Unnamed Driver',
});

async function uploadPhotos(inspectionId: string, responses: Record<string, InspectionResponseState>): Promise<Map<string, string>> {
  const uploads = Object.entries(responses)
    .filter(([, response]) => response.file)
    .map(([itemId, response]) => ({ itemId, file: response.file as File }));

  if (!uploads.length) {
    return new Map();
  }

  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const results = new Map<string, string>();

  for (const upload of uploads) {
    const extension = upload.file.name.split('.').pop();
    const safeExtension = extension ? extension.toLowerCase() : 'jpg';
    const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
    const fileName = `${inspectionId}/${upload.itemId}-${uuid}.${safeExtension}`;

    const { error: uploadError } = await bucket.upload(fileName, upload.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: upload.file.type,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = bucket.getPublicUrl(fileName);
    if (publicUrlData?.publicUrl) {
      results.set(upload.itemId, publicUrlData.publicUrl);
    }
  }

  return results;
}

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, children }) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {label}
      {required && <span className="text-red-500">*</span>}
    </span>
    {children}
  </label>
);

interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  intent: 'positive' | 'negative';
  children: React.ReactNode;
}

const ToggleChip: React.FC<ToggleChipProps> = ({ active, onClick, intent, children }) => {
  const baseClasses =
    'inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const intentClasses =
    intent === 'positive'
      ? active
        ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm focus-visible:ring-emerald-400 focus-visible:ring-offset-white'
        : 'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 focus-visible:ring-emerald-300 focus-visible:ring-offset-white'
      : active
      ? 'border-red-500 bg-red-500 text-white shadow-sm focus-visible:ring-red-400 focus-visible:ring-offset-white'
      : 'border-red-200 bg-red-50/70 text-red-600 hover:border-red-300 hover:bg-red-100 focus-visible:ring-red-300 focus-visible:ring-offset-white';

  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${intentClasses}`}>
      {children}
    </button>
  );
};

export default InspectionReport;
















