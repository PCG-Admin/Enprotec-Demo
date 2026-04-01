import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabase/client';
import type { User } from '../../types';
import { fetchInspectionDetail, sendInspectionCompletedWebhook } from '../../services/inspectionService';
import {
  InspectionItemLike,
  isFailureAnswer,
  normaliseAnswer,
} from '../../utils/inspection';
import {
  createInspectionPdfDocument,
} from '../../utils/inspectionPdf';
import type {
  InspectionDetail,
  InspectionDriverInfo,
  InspectionVehicleInfo,
} from '../types/inspection';

interface InspectionResponseRow {
  condition: string | null;
  item?:
    | {
        question: string | null;
        category: string | null;
        correct_answer: string | null;
      }
    | null;
}

interface InspectionWithRelations {
  id: string;
  inspection_date: string | null;
  site: string | null;
  overall_status: string | null;
  driver: InspectionDriverInfo | null;
  vehicle: InspectionVehicleInfo | null;
  responses: InspectionResponseRow[] | null;
}

interface InspectionSummary {
  id: string;
  inspectionDate: string | null;
  formattedDate: string;
  site: string | null;
  vehicleLabel: string;
  totalItems: number;
  failedItems: number;
  overallStatus: string | null;
}

interface MyInspectionsProps {
  user: User;
  showSuccessToast: boolean;
  onDismissToast: () => void;
  onCreateNew: () => void;
}

const asItemLike = (
  item?: { question: string | null; category: string | null; correct_answer: string | null } | null
): InspectionItemLike => ({
  question: item?.question ?? null,
  category: item?.category ?? null,
  correct_answer: item?.correct_answer ?? null,
});

const MyInspections: React.FC<MyInspectionsProps> = ({
  user,
  showSuccessToast,
  onDismissToast,
  onCreateNew,
}) => {
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30'>('all');
  const [siteFilter, setSiteFilter] = useState<'all' | string>('all');

  const [selectedInspection, setSelectedInspection] = useState<InspectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [deviationInspection, setDeviationInspection] = useState<InspectionDetail | null>(null);
  const [deviationLoading, setDeviationLoading] = useState(false);
  const [deviationError, setDeviationError] = useState<string | null>(null);
  const [isDeviationModalOpen, setIsDeviationModalOpen] = useState(false);
  const [sendingInspection, setSendingInspection] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSendingInspection(false);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);
  }, [selectedInspection?.id]);


  const fetchInspections = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: inspectionsError } = await supabase
        .from('enprotec_inspection_report_inspections')
        .select(
          `
          id,
          inspection_date,
          site,
          overall_status,
          driver:enprotec_inspection_report_drivers (
            full_name,
            email
          ),
          vehicle:enprotec_inspection_report_vehicles (
            registration_number,
            make,
            model
          ),
          responses:enprotec_inspection_report_responses (
            condition,
            item:enprotec_inspection_report_items (
              question,
              category,
              correct_answer
            )
          )
        `
        )
        .order('inspection_date', { ascending: false });

      if (inspectionsError) {
        throw inspectionsError;
      }

      const summaries = buildInspectionSummaries((data ?? []) as InspectionWithRelations[]);
      setInspections(summaries);
    } catch (fetchError: any) {
      console.error(fetchError);
      setError(fetchError.message ?? 'Unable to load inspections.');
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [user.id]);

  const handleViewInspection = async (inspectionId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    try {
      const detail = await fetchInspectionDetail(inspectionId);
      setSelectedInspection(detail);
    } catch (viewError: any) {
      console.error(viewError);
      setDetailError(viewError.message ?? 'Unable to load inspection details.');
      setSelectedInspection(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDeviations = async (inspectionId: string) => {
    setDeviationLoading(true);
    setDeviationError(null);
    setIsDeviationModalOpen(true);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);

    try {
      const detail = await fetchInspectionDetail(inspectionId);
      setDeviationInspection(detail);
    } catch (deviationErr: any) {
      console.error(deviationErr);
      setDeviationError(deviationErr.message ?? 'Unable to load deviations for this inspection.');
      setDeviationInspection(null);
    } finally {
      setDeviationLoading(false);
    }
  };

  const closeDeviationModal = () => {
    setIsDeviationModalOpen(false);
    setDeviationError(null);
    setSendSuccessMessage(null);
    setSendErrorMessage(null);
  };

  const siteOptions = useMemo(() => {
    const uniqueSites = new Set<string>();
    inspections.forEach(inspection => {
      const siteName = inspection.site?.trim();
      if (siteName) {
        uniqueSites.add(siteName);
      }
    });
    return Array.from(uniqueSites).sort((a, b) => a.localeCompare(b));
  }, [inspections]);

  useEffect(() => {
    if (siteFilter !== 'all' && !siteOptions.includes(siteFilter)) {
      setSiteFilter('all');
    }
  }, [siteFilter, siteOptions]);

  const filteredInspections = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = new Date();

    return inspections.filter(inspection => {
      if (normalizedSearch) {
        const haystack = `${inspection.vehicleLabel} ${inspection.site ?? ''}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      const normalizedStatus = (inspection.overallStatus ?? '').toLowerCase();
      const hasFailures = inspection.failedItems > 0 || normalizedStatus === 'fail';
      const isPass = normalizedStatus === 'pass' && !hasFailures;
      const isFail = hasFailures || normalizedStatus === 'fail';

      if (statusFilter === 'pass' && !isPass) {
        return false;
      }

      if (statusFilter === 'fail' && !isFail) {
        return false;
      }

      if (dateFilter !== 'all') {
        if (!inspection.inspectionDate) {
          return false;
        }
        const inspectionDateValue = new Date(inspection.inspectionDate);
        if (Number.isNaN(inspectionDateValue.getTime())) {
          return false;
        }
        const limitDays = Number(dateFilter);
        const diffMs = now.getTime() - inspectionDateValue.getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        if (diffMs > limitDays * msPerDay) {
          return false;
        }
      }

      if (siteFilter !== 'all') {
        const siteName = inspection.site?.trim();
        if (!siteName || siteName !== siteFilter) {
          return false;
        }
      }

      return true;
    });
  }, [inspections, searchTerm, statusFilter, dateFilter, siteFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setSiteFilter('all');
  };

  useEffect(() => {
    if (loading || error || detailLoading) return;
    if (!filteredInspections.length) {
      if (selectedInspection) {
        setSelectedInspection(null);
      }
      return;
    }
    if (selectedInspection && filteredInspections.some(inspection => inspection.id === selectedInspection.id)) {
      return;
    }
    handleViewInspection(filteredInspections[0].id);
  }, [filteredInspections, loading, error, detailLoading, selectedInspection]);

  const groupedResponses = useMemo(() => {
    if (!selectedInspection?.responses?.length) {
      return [] as Array<[string, NonNullable<InspectionDetail['responses']>]>;
    }

    const map = new Map<string, NonNullable<InspectionDetail['responses']>>();
    selectedInspection.responses.forEach(response => {
      const category = response.item?.category?.trim() || 'General';
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(response);
    });

    return Array.from(map.entries());
  }, [selectedInspection]);

  const deviations = useMemo(() => {
    if (!selectedInspection?.responses?.length) return [];
    return selectedInspection.responses.filter(response => {
      const itemLike = asItemLike(response.item ?? undefined);
      return isFailureAnswer(itemLike, normaliseAnswer(response.condition));
    });
  }, [selectedInspection]);

  const photoResponses = useMemo(() => {
    if (!selectedInspection?.responses?.length) return [];
    return selectedInspection.responses.filter(
      response => Boolean(response.photo_url) && response.photo_url.trim().length > 0
    );
  }, [selectedInspection]);
  const handleSendInspection = async () => {
    if (!selectedInspection) return;
    setSendingInspection(true);
    setSendErrorMessage(null);
    setSendSuccessMessage(null);
    try {
      await sendInspectionCompletedWebhook(selectedInspection.id);
      setSendSuccessMessage('Inspection report has been sent.');
    } catch (sendError: any) {
      console.error(sendError);
      setSendErrorMessage(
        sendError instanceof Error ? sendError.message : 'Failed to send inspection to webhook.'
      );
    } finally {
      setSendingInspection(false);
    }
  };
  const handleDownloadPdf = async () => {
    if (!selectedInspection) return;
    const doc = await createInspectionPdfDocument(selectedInspection);
    doc.save(`inspection-${selectedInspection.id}.pdf`);
  };

  const renderInspections = () => {
    if (loading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <span className="text-sm text-zinc-500">Loading your inspections...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
          {error}
        </div>
      );
    }

    if (!inspections.length) {
      return (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">No inspections yet</h3>
          <p className="mt-2 text-sm text-zinc-500">Start your first inspection to see it listed here.</p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Create Inspection
          </button>
        </div>
      );
    }

    if (!filteredInspections.length) {
      return (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-zinc-900">No inspections found</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Adjust your search or filters to see inspections that match.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center justify-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-600 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Reset Filters
          </button>
        </div>
      );
    }

    return (
      <ul className="flex flex-col gap-4">
        {filteredInspections.map(inspection => (
          <li key={inspection.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-5 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-zinc-900">{inspection.vehicleLabel}</h3>
                <p className="text-sm text-zinc-500">
                  {inspection.formattedDate}
                  {inspection.site ? ` - ${inspection.site}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-stretch justify-end gap-2 sm:items-end sm:text-right">
                <StatusPill
                  failedItems={inspection.failedItems}
                  totalItems={inspection.totalItems}
                  overallStatus={inspection.overallStatus}
                />
                <button
                  type="button"
                  onClick={() => handleViewInspection(inspection.id)}
                  className="inline-flex items-center justify-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-600 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  View Details
                </button>
                {inspection.failedItems > 0 && (
                  <button
                    type="button"
                    onClick={() => handleViewDeviations(inspection.id)}
                    className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    View Deviations
                  </button>
                )}
              </div>
            </div>
            {inspection.failedItems > 0 && (
              <p className="mt-4 text-sm text-red-600">
                {inspection.failedItems} item{inspection.failedItems === 1 ? '' : 's'} require attention.
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const renderDetailPanel = () => {
    if (detailLoading) {
      return (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <span className="text-sm text-zinc-500">Loading inspection details...</span>
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-sm text-red-700">
          {detailError}
        </div>
      );
    }

    if (!selectedInspection) {
      return (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 text-center">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Select an inspection</h3>
            <p className="mt-2 text-sm text-zinc-500">Choose an inspection from the list to view details.</p>
          </div>
        </div>
      );
    }

    const normalizedStatus = (selectedInspection.overall_status ?? '').toLowerCase();
    const isInspectionCompleted =
      Boolean(normalizedStatus) && normalizedStatus !== 'pending';

    const infoBlocks = [
      {
        label: 'Inspection Date',
        value: selectedInspection.inspection_date
          ? new Date(selectedInspection.inspection_date).toLocaleString()
          : 'Unknown',
      },
      { label: 'Site', value: selectedInspection.site ?? 'Not recorded' },
      {
        label: 'Vehicle',
        value: [
          selectedInspection.vehicle?.registration_number ?? 'Unknown registration',
          [selectedInspection.vehicle?.make, selectedInspection.vehicle?.model].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(' - '),
      },
      {
        label: 'Driver',
        value: `${selectedInspection.driver?.full_name ?? 'N/A'} (${selectedInspection.driver?.email ?? 'N/A'})`,
      },
      {
        label: 'Odometer',
        value:
          selectedInspection.odometer != null
            ? `${selectedInspection.odometer.toLocaleString()} km`
            : 'Not captured',
      },
      { label: 'Overall Status', value: selectedInspection.overall_status ?? 'Pending' },
    ];

    return (
      <div className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Vehicle Inspection</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              {selectedInspection.vehicle?.registration_number ?? selectedInspection.id}
            </h2>
            <p className="text-sm text-zinc-500">{selectedInspection.site ?? 'Site not recorded'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              failedItems={deviations.length}
              totalItems={selectedInspection.responses?.length ?? 0}
              overallStatus={selectedInspection.overall_status}
            />
            {isInspectionCompleted && (
              <button
                type="button"
                onClick={handleSendInspection}
                disabled={sendingInspection}
                className="inline-flex items-center justify-center rounded-md border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sendingInspection ? 'Sending...' : 'Send'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Download PDF
            </button>
          </div>
        </div>

        {sendErrorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sendErrorMessage}
          </div>
        )}
        {sendSuccessMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {sendSuccessMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {infoBlocks.map(block => (
            <div key={block.label} className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{block.label}</p>
              <p className="mt-1 text-sm text-zinc-900">{block.value}</p>
            </div>
          ))}
        </div>

        {selectedInspection.remarks?.trim() && (
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Inspector Remarks</p>
            <p className="mt-2 text-sm text-zinc-700">{selectedInspection.remarks}</p>
          </div>
        )}

        {photoResponses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">Photos & Evidence</h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {photoResponses.length} photo{photoResponses.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photoResponses.map((response, index) => {
                const questionLabel =
                  response.item?.question?.trim() ?? 'Checklist item';
                const photoKey = response.id ?? `${selectedInspection.id}-photo-${index}`;
                return (
                  <figure
                    key={photoKey}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 shadow-sm"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-white">
                      <img
                        src={response.photo_url ?? ''}
                        alt={questionLabel}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <figcaption className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-zinc-800">{questionLabel}</p>
                      {response.notes?.trim() && (
                        <p className="text-xs text-zinc-600">{response.notes}</p>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">Checklist Responses</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {selectedInspection.responses?.length ?? 0} item
              {(selectedInspection.responses?.length ?? 0) === 1 ? '' : 's'}
            </span>
          </div>

          {groupedResponses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-10 text-center text-sm text-zinc-500">
              No responses were captured for this inspection.
            </div>
          ) : (
            groupedResponses.map(([category, responses]) => (
              <div key={category} className="overflow-hidden rounded-lg border border-zinc-100">
                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{category}</p>
                    <p className="text-sm text-zinc-500">
                      {responses.length} response{responses.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">
                    {
                      responses.filter(response =>
                        isFailureAnswer(asItemLike(response.item ?? undefined), normaliseAnswer(response.condition))
                      ).length
                    }{' '}
                    deviation{
                      responses.filter(response =>
                        isFailureAnswer(asItemLike(response.item ?? undefined), normaliseAnswer(response.condition))
                      ).length === 1
                        ? ''
                        : 's'
                    }
                  </span>
                </div>

                <ul className="divide-y divide-zinc-100">
                  {responses.map((response, index) => {
                    const itemLike = asItemLike(response.item ?? undefined);
                    const normalized = normaliseAnswer(response.condition);
                    const isFail = isFailureAnswer(itemLike, normalized);
                    const statusLabel = (response.condition ?? normalized ?? 'N/A').toUpperCase();

                    return (
                      <li key={response.id || `${selectedInspection.id}-${index}`} className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-zinc-900">
                              {response.item?.question ?? `Checklist item ${index + 1}`}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                              <span className="rounded-full border border-zinc-200 px-2 py-0.5">
                                Response: {statusLabel}
                              </span>
                              {isFail && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-600">
                                  Deviation
                                </span>
                              )}
                            </div>
                            {response.notes?.trim() && (
                              <p className="text-sm text-zinc-600">
                                <span className="font-medium text-zinc-500">Notes:</span> {response.notes}
                              </p>
                            )}
                            {response.photo_url && (
                              <p className="text-xs text-zinc-400">
                                Photo captured; stored in {response.storage_bucket ?? 'default bucket'}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderDeviationModal = () => {
    if (!isDeviationModalOpen) return null;

    const deviationResponses =
      deviationInspection?.responses?.filter(response =>
        isFailureAnswer(asItemLike(response.item ?? undefined), normaliseAnswer(response.condition))
      ) ?? [];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-10">
        <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Inspection Deviations</p>
              <h3 className="text-lg font-semibold text-zinc-900">
                {deviationInspection?.vehicle?.registration_number ?? 'Selected Inspection'}
              </h3>
              <p className="text-xs text-zinc-500">
                {deviationInspection?.inspection_date
                  ? new Date(deviationInspection.inspection_date).toLocaleString()
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDeviationModal}
              className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Close
            </button>
          </div>

          <div className="px-6 py-4">
            {deviationLoading ? (
              <div className="flex h-40 items-center justify-center">
                <span className="text-sm text-zinc-500">Loading deviations...</span>
              </div>
            ) : deviationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {deviationError}
              </div>
            ) : deviationResponses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-10 text-center text-sm text-zinc-500">
                No deviations recorded for this inspection.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="min-w-full divide-y divide-zinc-200">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        #
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Item
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Result
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {deviationResponses.map((response, index) => (
                      <tr key={response.id || `${deviationInspection?.id ?? 'deviation'}-${index}`}>
                        <td className="px-4 py-3 text-sm text-zinc-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-zinc-900">
                          {response.item?.question ?? `Checklist item ${index + 1}`}
                          {response.item?.category && (
                            <span className="ml-2 text-xs text-zinc-400">({response.item.category})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-600">
                          {(response.condition ?? normaliseAnswer(response.condition) ?? 'N/A').toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {response.notes?.trim() ? (
                            response.notes
                          ) : (
                            <span className="text-zinc-400">No notes provided</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {showSuccessToast && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>Inspection captured successfully.</span>
          <button
            type="button"
            onClick={onDismissToast}
            className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Your Inspections</h2>
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center justify-center rounded-md border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-600 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              New Inspection
            </button>
          </div>

          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Search</label>
              <input
                type="search"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search by vehicle or site..."
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as 'all' | 'pass' | 'fail')}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">All statuses</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Period
                <select
                  value={dateFilter}
                  onChange={event => setDateFilter(event.target.value as 'all' | '7' | '30')}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">All time</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:col-span-1">
                Site
                <select
                  value={siteFilter}
                  onChange={event => setSiteFilter(event.target.value)}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">All sites</option>
                  {siteOptions.map(site => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {renderInspections()}
        </aside>

        <section>{renderDetailPanel()}</section>
      </div>

      {renderDeviationModal()}
    </div>
  );
};

function buildInspectionSummaries(rows: InspectionWithRelations[]): InspectionSummary[] {
  return rows.map(row => {
    const totalItems = row.responses?.length ?? 0;
    const failedItems =
      row.responses?.filter(response =>
        isFailureAnswer(asItemLike(response.item ?? undefined), normaliseAnswer(response.condition))
      ).length ?? 0;
    const inspectionDate = row.inspection_date ? new Date(row.inspection_date) : null;

    const formattedDate = inspectionDate
      ? inspectionDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Date not recorded';

    const registration = row.vehicle?.registration_number?.trim();
    const make = row.vehicle?.make?.trim();
    const model = row.vehicle?.model?.trim();
    const makeModel = [make, model].filter(Boolean).join(' ');

    const labelParts: string[] = [];
    if (registration) labelParts.push(registration);
    if (makeModel) labelParts.push(makeModel);

    const vehicleLabel = labelParts.length ? labelParts.join(' - ') : `Vehicle ${row.id.slice(0, 6)}`;

    return {
      id: row.id,
      inspectionDate: row.inspection_date,
      formattedDate,
      site: row.site,
      vehicleLabel,
      totalItems,
      failedItems,
      overallStatus: row.overall_status,
    };
  });
}

interface StatusPillProps {
  totalItems: number;
  failedItems: number;
  overallStatus: string | null;
}

const StatusPill: React.FC<StatusPillProps> = ({ failedItems, totalItems, overallStatus }) => {
  const normalized = (overallStatus ?? '').toLowerCase();
  let derivedStatus = normalized;

  if (!derivedStatus) {
    if (failedItems > 0) {
      derivedStatus = 'fail';
    } else if (totalItems > 0) {
      derivedStatus = 'pass';
    } else {
      derivedStatus = 'pending';
    }
  }

  const baseClasses =
    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold shadow-sm';

  switch (derivedStatus) {
    case 'pass':
      return (
        <span className={`${baseClasses} border border-emerald-200 bg-emerald-50 text-emerald-700`}>
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Pass
        </span>
      );
    case 'fail':
      return (
        <span className={`${baseClasses} border border-red-200 bg-red-50 text-red-600`}>
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
          Attention Needed
        </span>
      );
    default:
      return (
        <span className={`${baseClasses} border border-zinc-200 bg-white text-zinc-600`}>
          <span className="h-2 w-2 rounded-full bg-zinc-400" aria-hidden="true" />
          Pending
        </span>
      );
  }
};

export default MyInspections;
