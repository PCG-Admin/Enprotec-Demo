export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole      = string;   // open set — matches enprotec_users.role
export type UserStatus    = 'Active' | 'Inactive';
export type VehicleStatus = 'Active' | 'In Maintenance' | 'Inactive' | 'Decommissioned';
export type LicenseCat    = 'Vehicle' | 'Driver';
export type CostCat       = 'Fuel' | 'Maintenance' | 'Tyres' | 'Insurance' | 'Licensing' | 'Other';
export type CompStatus    = 'Overdue' | 'Due Soon' | 'Scheduled' | 'Completed';
export type SiteStatus    = 'Active' | 'Frozen';  // matches enprotec_sites.status
export type InspResult    = 'pass' | 'fail' | 'requires_attention' | 'in_progress';
export type InspFreq      = 'daily' | 'weekly' | 'monthly' | 'custom';

/* ─── Question shape stored in JSONB ────────────────────────── */
export interface DbQuestion {
  id: string;
  text: string;
  type: 'checkbox' | 'text' | 'number' | 'select' | 'photo';
  required: boolean;
  unit?: string;
  options?: string[];
}

/* ─── Joined sub-shapes (returned by relational selects) ─────── */

export interface JoinedSite {
  id:   string;
  name: string;
}

export interface JoinedUser {
  id:    string;
  name:  string;
  email: string;
}

export interface JoinedVehicle {
  id:           string;
  registration: string;
  make:         string;
  model:        string;
}

/* ─── Database row shapes ────────────────────────────────────── */

/** Matches enprotec_users table (shared with Phase 1) */
export interface ProfileRow {
  id:           string;
  name:         string;
  email:        string;
  role:         UserRole;
  status:       UserStatus;
  sites?:       string[] | null;
  departments?: string[] | null;
}

/** Matches enprotec_sites table (shared with Phase 1) */
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
  // Joined relations (only present when selected with FK syntax)
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
  // Joined relations
  vehicle?:   JoinedVehicle | null;
  inspector?: JoinedUser    | null;
}

export interface LicenseRow {
  id:                  string;
  category:            LicenseCat;
  vehicle_id:          string | null;
  driver_id:           string | null;   // FK → enprotec_users(id)
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
  // Joined relations
  vehicle?: JoinedVehicle | null;
}

export interface ComplianceRow {
  id:             string;
  vehicle_id:     string | null;
  inspection_type: string;
  due_date:       string;
  scheduled_date: string | null;
  completed_date: string | null;
  status:         CompStatus;
  notes:          string | null;
  assigned_to:    string | null;
  created_at:     string;
  updated_at:     string;
  // Joined relations
  vehicle?: JoinedVehicle | null;
  assignee?: JoinedUser   | null;
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

/* ─── Database interface for typed Supabase client ──────────── */
export interface Database {
  public: {
    Tables: {
      enprotec_users: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, never>;
        Update: Partial<Omit<ProfileRow, 'id'>>;
      };
      enprotec_sites: {
        Row: SiteRow;
        Insert: Omit<SiteRow, 'id'>;
        Update: Partial<Omit<SiteRow, 'id'>>;
      };
      enprotec_vehicles: {
        Row: VehicleRow;
        Insert: Omit<VehicleRow, 'id' | 'created_at' | 'updated_at' | 'site' | 'driver'>;
        Update: Partial<Omit<VehicleRow, 'id' | 'created_at' | 'updated_at' | 'site' | 'driver'>>;
      };
      enprotec_inspection_templates: {
        Row: TemplateRow;
        Insert: Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      enprotec_inspections: {
        Row: InspectionRow;
        Insert: Omit<InspectionRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'inspector'>;
        Update: Partial<Omit<InspectionRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'inspector'>>;
      };
      enprotec_licenses: {
        Row: LicenseRow;
        Insert: Omit<LicenseRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<LicenseRow, 'id' | 'created_at' | 'updated_at'>>;
      };
      enprotec_costs: {
        Row: CostRow;
        Insert: Omit<CostRow, 'id' | 'created_at' | 'updated_at' | 'vehicle'>;
        Update: Partial<Omit<CostRow, 'id' | 'created_at' | 'updated_at' | 'vehicle'>>;
      };
      enprotec_compliance_schedule: {
        Row: ComplianceRow;
        Insert: Omit<ComplianceRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'assignee'>;
        Update: Partial<Omit<ComplianceRow, 'id' | 'created_at' | 'updated_at' | 'vehicle' | 'assignee'>>;
      };
      enprotec_audit_log: {
        Row: AuditRow;
        Insert: Omit<AuditRow, 'id' | 'created_at'>;
        Update: never;
      };
    };
    Functions: {
      get_user_role:  { Args: Record<never, never>; Returns: string };
      get_fleet_role: { Args: Record<never, never>; Returns: string };
    };
  };
}
