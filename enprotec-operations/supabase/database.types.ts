// ─── Fleet-specific types ─────────────────────────────────────────────────────
export type UserStatus    = 'Active' | 'Inactive';
export type VehicleStatus = 'Active' | 'In Maintenance' | 'Inactive' | 'Decommissioned';
export type LicenseCat    = 'Vehicle' | 'Driver';
export type CostCat       = 'Fuel' | 'Maintenance' | 'Tyres' | 'Insurance' | 'Licensing' | 'Other';
export type CompStatus    = 'Overdue' | 'Due Soon' | 'Scheduled' | 'Completed';
export type SiteStatus    = 'Active' | 'Frozen';
export type InspResult    = 'pass' | 'fail' | 'requires_attention' | 'in_progress';
export type InspFreq      = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DbQuestion {
  id: string;
  text: string;
  type: 'checkbox' | 'text' | 'number' | 'select' | 'photo';
  required: boolean;
  unit?: string;
  options?: string[];
}

export interface JoinedSite    { id: string; name: string; }
export interface JoinedUser    { id: string; name: string; email: string; }
export interface JoinedVehicle { id: string; registration: string; make: string; model: string; }

export interface ProfileRow {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  status:       UserStatus;
  sites?:       string[] | null;
  departments?: string[] | null;
  fleet_role?:  string | null;
}

export interface SiteRow {
  id:     string;
  name:   string;
  status: SiteStatus;
}

export interface VehicleRow {
  id:                   string;
  registration:         string;
  make:                 string;
  model:                string;
  vehicle_type:         string;
  year:                 number | null;
  vin:                  string | null;
  serial_number:        string | null;
  fuel_type:            string | null;
  current_hours:        number;
  current_mileage:      number;
  site_id:              string | null;
  assigned_driver_id:   string | null;
  purchase_date:        string | null;
  acquisition_cost:     number | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  status:               VehicleStatus;
  photo_url:            string | null;
  notes:                string | null;
  created_at:           string;
  updated_at:           string;
  site?:   JoinedSite | null;
  driver?: JoinedUser | null;
}

export interface TemplateRow {
  id:          string;
  name:        string;
  description: string;
  frequency:   InspFreq;
  questions:   DbQuestion[];
  active:      boolean;
  last_used:   string | null;
  created_by:  string | null;
  created_at:  string;
  updated_at:  string;
}

export interface InspectionRow {
  id:              string;
  template_id:     string | null;
  vehicle_id:      string;
  inspector_id:    string | null;
  inspection_type: string;
  started_at:      string;
  completed_at:    string | null;
  status:          InspResult;
  answers:         Json;
  notes:           string | null;
  odometer:        number | null;
  hour_meter:      number | null;
  signature_url:   string | null;
  created_at:      string;
  updated_at:      string;
  vehicle?:   JoinedVehicle | null;
  inspector?: JoinedUser    | null;
}

export interface LicenseRow {
  id:                  string;
  category:            LicenseCat;
  vehicle_id:          string | null;
  driver_id:           string | null;
  driver_name:         string | null;
  driver_employee_id:  string | null;
  license_type:        string;
  license_number:      string;
  issue_date:          string;
  expiry_date:         string;
  notes:               string | null;
  document_url:        string | null;
  created_by:          string | null;
  created_at:          string;
  updated_at:          string;
}

export interface CostRow {
  id:             string;
  vehicle_id:     string;
  date:           string;
  category:       CostCat;
  amount:         number;
  description:    string;
  supplier:       string | null;
  invoice_number: string | null;
  rto_number:     string | null;
  po_number:      string | null;
  quote_number:   string | null;
  km_reading:     string | null;
  receipt_url:    string | null;
  created_by:     string | null;
  created_at:     string;
  updated_at:     string;
  vehicle?: JoinedVehicle | null;
}

export interface ComplianceRow {
  id:              string;
  vehicle_id:      string | null;
  inspection_type: string;
  due_date:        string;
  scheduled_date:  string | null;
  completed_date:  string | null;
  status:          CompStatus;
  notes:           string | null;
  assigned_to:     string | null;
  created_at:      string;
  updated_at:      string;
  vehicle?:  JoinedVehicle | null;
  assignee?: JoinedUser    | null;
}

export interface AuditRow {
  id:         string;
  user_id:    string | null;
  user_name:  string;
  action:     string;
  module:     string;
  details:    string;
  created_at: string;
}

// ─── Supabase JSON type ───────────────────────────────────────────────────────
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      enprotec_inventory: {
        Row: {
          id: string;
          stock_item_id: string;
          store: string;
          quantity_on_hand: number;
          location: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          stock_item_id: string;
          store: string;
          quantity_on_hand: number;
          location?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          stock_item_id?: string;
          store?: string;
          quantity_on_hand?: number;
          location?: string | null;
          created_at?: string;
        };
      };
      en_inspection_report_items: {
        Row: {
          id: string;
          category: string | null;
          question: string;
          requires_photo: boolean | null;
          correct_answer: string | null;
        };
        Insert: {
          id?: string;
          category?: string | null;
          question: string;
          requires_photo?: boolean | null;
          correct_answer?: string | null;
        };
        Update: {
          id?: string;
          category?: string | null;
          question?: string;
          requires_photo?: boolean | null;
          correct_answer?: string | null;
        };
      };
      en_inspection_report_vehicles: {
        Row: {
          id: string;
          registration_number: string;
          make: string | null;
          model: string | null;
          license_expiry: string | null;
          current_odometer: number | null;
          next_service_km: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          registration_number: string;
          make?: string | null;
          model?: string | null;
          license_expiry?: string | null;
          current_odometer?: number | null;
          next_service_km?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          registration_number?: string;
          make?: string | null;
          model?: string | null;
          license_expiry?: string | null;
          current_odometer?: number | null;
          next_service_km?: number | null;
          created_at?: string | null;
        };
      };
      en_inspection_report_drivers: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          department: string | null;
          assigned_vehicle: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          department?: string | null;
          assigned_vehicle?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          department?: string | null;
          assigned_vehicle?: string | null;
          created_at?: string | null;
        };
      };
      en_inspection_report_inspections: {
        Row: {
          id: string;
          driver_id: string | null;
          vehicle_id: string | null;
          inspection_date: string | null;
          odometer: number | null;
          site: string | null;
          remarks: string | null;
          overall_status: string | null;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          inspection_date?: string | null;
          odometer?: number | null;
          site?: string | null;
          remarks?: string | null;
          overall_status?: string | null;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          inspection_date?: string | null;
          odometer?: number | null;
          site?: string | null;
          remarks?: string | null;
          overall_status?: string | null;
          submitted_at?: string | null;
        };
      };
      en_inspection_report_responses: {
        Row: {
          id: string;
          inspection_id: string | null;
          item_id: string | null;
          condition: string | null;
          notes: string | null;
          photo_url: string | null;
          storage_bucket: string | null;
        };
        Insert: {
          id?: string;
          inspection_id?: string | null;
          item_id?: string | null;
          condition?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          storage_bucket?: string | null;
        };
        Update: {
          id?: string;
          inspection_id?: string | null;
          item_id?: string | null;
          condition?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          storage_bucket?: string | null;
        };
      };
      enprotec_salvage_requests: {
        Row: {
          id: string;
          stock_item_id: string;
          quantity: number;
          status: string;
          notes: string | null;
          created_by_id: string;
          created_at: string;
          decision_by_id: string | null;
          decision_at: string | null;
          source_department: string | null;
          photo_url: string | null;
        };
        Insert: {
          id?: string;
          stock_item_id: string;
          quantity: number;
          status: string;
          notes?: string | null;
          created_by_id: string;
          created_at?: string;
          decision_by_id?: string | null;
          decision_at?: string | null;
          source_department?: string | null;
          photo_url?: string | null;
        };
        Update: {
          id?: string;
          stock_item_id?: string;
          quantity?: number;
          status?: string;
          notes?: string | null;
          created_by_id?: string;
          created_at?: string;
          decision_by_id?: string | null;
          decision_at?: string | null;
          source_department?: string | null;
          photo_url?: string | null;
        };
      };
      enprotec_sites: {
        Row: {
          id: string;
          name: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          created_at?: string;
        };
      };
      enprotec_stock_items: {
        Row: {
          id: string;
          part_number: string;
          description: string | null;
          category: string | null;
          min_stock_level: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          part_number: string;
          description?: string | null;
          category?: string | null;
          min_stock_level?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          part_number?: string;
          description?: string | null;
          category?: string | null;
          min_stock_level?: number;
          created_at?: string;
        };
      };
      en_stock_movements: {
        Row: {
          id: string;
          stock_item_id: string;
          store: string;
          movement_type: string;
          quantity: number;
          created_at: string;
          site_id: string | null;
          workflow_request_id: string | null;
          user_id: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          stock_item_id: string;
          store: string;
          movement_type: string;
          quantity: number;
          created_at?: string;
          site_id?: string | null;
          workflow_request_id?: string | null;
          user_id?: string | null;
          note?: string | null;
        };
        Update: {
          id?: string;
          stock_item_id?: string;
          store?: string;
          movement_type?: string;
          quantity?: number;
          created_at?: string;
          site_id?: string | null;
          workflow_request_id?: string | null;
          user_id?: string | null;
          note?: string | null;
        };
      };
      enprotec_stock_receipts: {
        Row: {
          id: string;
          stock_item_id: string;
          quantity_received: number;
          received_by_id: string;
          received_at: string;
          delivery_note_po: string;
          comments: string | null;
          attachment_url: string | null;
          store: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          stock_item_id: string;
          quantity_received: number;
          received_by_id: string;
          received_at?: string;
          delivery_note_po: string;
          comments?: string | null;
          attachment_url?: string | null;
          store: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          stock_item_id?: string;
          quantity_received?: number;
          received_by_id?: string;
          received_at?: string;
          delivery_note_po?: string;
          comments?: string | null;
          attachment_url?: string | null;
          store?: string;
          created_at?: string;
        };
      };
      enprotec_users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string;
          sites: string[] | null;
          status: string;
          departments: string[] | null;
          created_at: string;
          password?: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role: string;
          sites?: string[] | null;
          status: string;
          departments?: string[] | null;
          created_at?: string;
          password?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          sites?: string[] | null;
          status?: string;
          departments?: string[] | null;
          created_at?: string;
          password?: string;
        };
      };
      enprotec_workflow_comments: {
        Row: {
          id: string;
          workflow_request_id: string;
          user_id: string;
          comment_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_request_id: string;
          user_id: string;
          comment_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_request_id?: string;
          user_id?: string;
          comment_text?: string;
          created_at?: string;
        };
      };
      enprotec_workflow_attachments: {
        Row: {
          id: string;
          workflow_request_id: string;
          file_name: string | null;
          attachment_url: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          workflow_request_id: string;
          file_name?: string | null;
          attachment_url: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          workflow_request_id?: string;
          file_name?: string | null;
          attachment_url?: string;
          uploaded_at?: string;
        };
      };
      enprotec_workflow_items: {
        Row: {
          id: string;
          workflow_request_id: string;
          stock_item_id: string;
          quantity_requested: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_request_id: string;
          stock_item_id: string;
          quantity_requested: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_request_id?: string;
          stock_item_id?: string;
          quantity_requested?: number;
          created_at?: string;
        };
      };
      enprotec_workflow_requests: {
        Row: {
          id: string;
          request_number: string;
          type: string;
          requester_id: string;
          site_id: string | null;
          department: string;
          current_status: string;
          priority: string;
          created_at: string;
          attachment_url: string | null;
          rejection_comment: string | null;
          driver_name: string | null;
          vehicle_registration: string | null;
        };
        Insert: {
          id?: string;
          request_number: string;
          type: string;
          requester_id: string;
          site_id?: string | null;
          department: string;
          current_status: string;
          priority: string;
          created_at?: string;
          attachment_url?: string | null;
          rejection_comment?: string | null;
          driver_name?: string | null;
          vehicle_registration?: string | null;
        };
        Update: {
          id?: string;
          request_number?: string;
          type?: string;
          requester_id?: string;
          site_id?: string | null;
          department?: string;
          current_status?: string;
          priority?: string;
          created_at?: string;
          attachment_url?: string | null;
          rejection_comment?: string | null;
          driver_name?: string | null;
          vehicle_registration?: string | null;
        };
      };
      // ─── Fleet tables ─────────────────────────────────────────────────────────
      vehicles: {
        Row: VehicleRow;
        Insert: Omit<VehicleRow, 'id' | 'created_at' | 'updated_at' | 'site' | 'driver'>;
        Update: Partial<Omit<VehicleRow, 'id' | 'created_at' | 'updated_at' | 'site' | 'driver'>>;
      };
      inspection_templates: {
        Row: TemplateRow;
        Insert: Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      inspections: {
        Row: InspectionRow;
        Insert: Omit<InspectionRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'inspector'>;
        Update: Partial<Omit<InspectionRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'inspector'>>;
      };
      licenses: {
        Row: LicenseRow;
        Insert: Omit<LicenseRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<LicenseRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      costs: {
        Row: CostRow;
        Insert: Omit<CostRow, 'id' | 'created_at' | 'updated_at' | 'vehicle'>;
        Update: Partial<Omit<CostRow, 'id' | 'created_at' | 'updated_at' | 'vehicle'>>;
      };
      compliance_schedule: {
        Row: ComplianceRow;
        Insert: Omit<ComplianceRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'assignee'>;
        Update: Partial<Omit<ComplianceRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'assignee'>>;
      };
      audit_log: {
        Row: AuditRow;
        Insert: Omit<AuditRow, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: {
      enprotec_salvage_requests_view: {
        Row: { [key: string]: any };
      };
      enprotec_stock_movements_view: {
        Row: { [key: string]: any };
      };
      enprotec_stock_receipts_view: {
        Row: { [key: string]: any };
      };
      enprotec_stock_view: {
        Row: { [key: string]: any };
      };
      enprotec_workflows_view: {
        Row: { [key: string]: any };
      };
    };
    Functions: {
      get_user_role:  { Args: Record<never, never>; Returns: string };
      get_fleet_role: { Args: Record<never, never>; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
