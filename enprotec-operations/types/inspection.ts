export interface InspectionVehicleInfo {
  registration_number: string | null;
  make: string | null;
  model: string | null;
}

export interface InspectionDriverInfo {
  full_name: string | null;
  email: string | null;
}

export interface InspectionResponseDetail {
  id: string;
  condition: string | null;
  notes: string | null;
  photo_url: string | null;
  storage_bucket: string | null;
  item: {
    question: string | null;
    category: string | null;
    correct_answer: string | null;
  } | null;
}

export interface InspectionDetail {
  id: string;
  inspection_date: string | null;
  site: string | null;
  overall_status: string | null;
  odometer: number | null;
  remarks: string | null;
  vehicle: InspectionVehicleInfo | null;
  driver: InspectionDriverInfo | null;
  responses: InspectionResponseDetail[] | null;
}
