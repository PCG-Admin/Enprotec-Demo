import { supabase } from '../supabase/client';
import type { InspectionDetail } from '../types/inspection';
import { createInspectionPdfBase64 } from '../utils/inspectionPdf';

export const fetchInspectionDetail = async (
  inspectionId: string
): Promise<InspectionDetail> => {
  const { data, error } = await supabase
    .from('en_inspection_report_inspections')
    .select(
      `
        id,
        inspection_date,
        site,
        overall_status,
        odometer,
        remarks,
        vehicle:en_inspection_report_vehicles (
          registration_number,
          make,
          model
        ),
        driver:en_inspection_report_drivers (
          full_name,
          email
        ),
        responses:en_inspection_report_responses (
          id,
          condition,
          notes,
          photo_url,
          storage_bucket,
          item:en_inspection_report_items (
            question,
            category,
            correct_answer
          )
        )
      `
    )
    .eq('id', inspectionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Inspection not found.');
  }

  return data as unknown as InspectionDetail;
};

const formatVehicleLabel = (
  vehicle: InspectionDetail['vehicle']
): string => {
  if (!vehicle) return 'Not recorded';
  const parts: string[] = [];
  const registration = vehicle.registration_number?.trim();
  const make = vehicle.make?.trim();
  const model = vehicle.model?.trim();
  if (registration) parts.push(registration);
  const makeModel = [make, model].filter(Boolean).join(' ');
  if (makeModel) parts.push(makeModel);
  return parts.length ? parts.join(' - ') : 'Not recorded';
};

const formatDriverLabel = (
  driver: InspectionDetail['driver']
): string => {
  if (!driver) return 'Not recorded';
  const name = driver.full_name?.trim();
  const email = driver.email?.trim();
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return 'Not recorded';
};

export const sendInspectionCompletedWebhook = async (
  inspectionId: string
): Promise<void> => {
  const inspection = await fetchInspectionDetail(inspectionId);

  const { base64, byteLength } = await createInspectionPdfBase64(inspection);

  const payload = {
    inspectionId: inspection.id,
    inspectionDate: inspection.inspection_date,
    inspectionDateFormatted: inspection.inspection_date
      ? new Date(inspection.inspection_date).toLocaleString()
      : null,
    site: inspection.site ?? null,
    vehicle: formatVehicleLabel(inspection.vehicle),
    driver: formatDriverLabel(inspection.driver),
    overallStatus: inspection.overall_status ?? null,
    odometer: inspection.odometer,
    file: {
      name: `inspection-${inspection.id}.pdf`,
      mime: 'application/pdf',
      data: base64,
      encoding: 'base64',
      size: byteLength,
    },
  };

  const response = await fetch('/api/send-inspection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Inspection webhook proxy failed with status ${response.status}: ${errorText}`
    );
  }
};
