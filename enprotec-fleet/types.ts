// ─── Fleet views ─────────────────────────────────────────────────────────────
export type FleetView =
  | 'FleetDashboard'
  | 'Vehicles'
  | 'Inspections'
  | 'Costs'
  | 'Licenses'
  | 'FleetReports'
  | 'Templates'
  | 'Compliance'
  | 'Administration';

// ─── Operations views ─────────────────────────────────────────────────────────
export type View =
  | 'Dashboard'
  | 'Workflows'
  | 'StockReceipts'
  | 'Requests'
  | 'EquipmentManager'
  | 'RejectedRequests'
  | 'Picking'
  | 'Deliveries'
  | 'Stock'
  | 'Reports'
  | 'Users'
  | 'Sites'
  | 'Stores'
  | 'MyDeliveries'
  | 'Salvage'
  | 'InspectionReport'
  | 'MyInspections'
  | 'StockReports';

export type FormType = 'PR' | 'GateRelease' | 'StockRequest' | 'EPOD' | 'StockIntake' | 'SalvageBooking' | 'ReturnIntake';

// ─── Roles ────────────────────────────────────────────────────────────────────
export enum UserRole {
  // Core roles
  Admin             = 'Admin',
  OperationsManager = 'Operations Manager',
  EquipmentManager  = 'Equipment Manager',
  StockController   = 'Stock Controller',
  Storeman          = 'Storeman',
  SiteManager       = 'Site Manager',
  ProjectManager    = 'Project Manager',
  Driver            = 'Driver',
  Security          = 'Security',
  // Extended roles
  GeneralManagerOps            = 'General Manager: Operations and Equipment Support',
  EngineeringManager           = 'Engineering Manager: Maintenance and Equipment Support',
  FinancialManager             = 'Financial Manager',
  EquipmentSupportManager      = 'Equipment Support Manager',
  PlantManagerBenificiation    = 'Plant Manager: Benificiation Plants',
  OpsManagerBenificiation      = 'Operations Manager for Benificiation Plants',
  PlantManager                 = 'Plant Manager',
  ProductionTechAnalyst        = 'Production & Technical Analyst',
  EngineeringSupervisor        = 'Engineering Supervisor',
  SeniorSiteManager            = 'Senior Site Manager',
  OperationalReadinessEngineer = 'Operational Readiness Engineer',
  SeniorProjectManager         = 'Senior Project Manager',
  ProjectEngineer              = 'Project Engineer',
  ProcurementLead              = 'Procurement Lead',
  ProductSpecialist            = 'Product Specialist',
  ProcurementQualityOfficer    = 'Procurement, Quality and Expediting Officer',
}

export const getMappedRole = (role: UserRole | string | undefined | null): UserRole => {
  switch (role) {
    case UserRole.GeneralManagerOps:
    case UserRole.EngineeringManager:
    case UserRole.FinancialManager:
      return UserRole.Admin;
    case UserRole.EquipmentSupportManager:
      return UserRole.EquipmentManager;
    case UserRole.PlantManagerBenificiation:
    case UserRole.OpsManagerBenificiation:
    case UserRole.PlantManager:
      return UserRole.OperationsManager;
    case UserRole.SeniorSiteManager:
    case UserRole.EngineeringSupervisor:
    case UserRole.ProductionTechAnalyst:
    case UserRole.ProcurementLead:
      return UserRole.SiteManager;
    case UserRole.SeniorProjectManager:
    case UserRole.ProjectEngineer:
    case UserRole.OperationalReadinessEngineer:
    case UserRole.ProcurementQualityOfficer:
    case UserRole.ProductSpecialist:
      return UserRole.ProjectManager;
    default:
      return role as UserRole;
  }
};

export const getRolesMappingTo = (baseRole: UserRole): UserRole[] => {
  return Object.values(UserRole).filter(r => getMappedRole(r) === baseRole);
};

// ─── Status ───────────────────────────────────────────────────────────────────
export enum UserStatus {
  Active   = 'Active',
  Inactive = 'Inactive',
}

export enum SiteStatus {
  Active = 'Active',
  Frozen = 'Frozen',
}

// ─── Store / Department ───────────────────────────────────────────────────────
export enum Store {
  OEM         = 'OEM',
  Operations  = 'Operations',
  Projects    = 'Projects',
  SalvageYard = 'SalvageYard',
  Satellite   = 'Satellite',
}

export enum StoreType {
  OEM         = 'OEM',
  Operations  = 'Operations',
  Projects    = 'Projects',
  SalvageYard = 'SalvageYard',
  Satellite   = 'Satellite',
}

export const departmentToStoreMap: Record<Store, StoreType> = {
  [Store.OEM]:         StoreType.OEM,
  [Store.Operations]:  StoreType.Operations,
  [Store.Projects]:    StoreType.Projects,
  [Store.SalvageYard]: StoreType.SalvageYard,
  [Store.Satellite]:   StoreType.Satellite,
};

export const storeToStoreMap: Record<StoreType, Store> = {
  [StoreType.OEM]:         Store.OEM,
  [StoreType.Operations]:  Store.Operations,
  [StoreType.Projects]:    Store.Projects,
  [StoreType.SalvageYard]: Store.SalvageYard,
  [StoreType.Satellite]:   Store.Satellite,
};

export interface Department {
  id:          string;
  name:        string;
  code:        string;
  description: string | null;
  status:      'Active' | 'Frozen';
  created_at:  string;
  updated_at:  string;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id:           string;
  name:         string;
  email:        string;
  role:         string;          // raw string from enprotec_users (covers all role variants)
  fleet_role?:  string | null;
  status:       UserStatus;
  sites?:       string[] | null;
  departments?: Store[] | null;
}

// ─── Sites ────────────────────────────────────────────────────────────────────
export interface Site {
  id:           string;
  name:         string;
  location?:    string;
  contact?:     string;
  vehicleCount?: number;
  status:       'Active' | 'Inactive' | 'Frozen';
}

// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id:        string;
  timestamp: string;
  user:      string;
  action:    string;
  module:    string;
  details:   string;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────
export enum WorkflowStatus {
  REQUEST_SUBMITTED       = 'Request Submitted',
  AWAITING_OPS_MANAGER    = 'Awaiting Ops Manager',
  REQUEST_DECLINED        = 'Request Declined',
  AWAITING_EQUIP_MANAGER  = 'Awaiting Equip. Manager',
  AWAITING_PICKING        = 'Awaiting Picking',
  PICKED_AND_LOADED       = 'Picked & Loaded',
  DISPATCHED              = 'Dispatched',
  EPOD_CONFIRMED          = 'EPOD Confirmed',
  COMPLETED               = 'Completed',
  REJECTED_AT_DELIVERY    = 'Rejected at Delivery',
  SALVAGE_AWAITING_DECISION = 'Salvage - Awaiting Decision',
  SALVAGE_TO_BE_REPAIRED  = 'Salvage - To Be Repaired',
  SALVAGE_REPAIR_CONFIRMED = 'Salvage - Repair Confirmed',
  SALVAGE_TO_BE_SCRAPPED  = 'Salvage - To Be Scrapped',
  SALVAGE_SCRAP_CONFIRMED = 'Salvage - Scrap Confirmed',
  SALVAGE_COMPLETE        = 'Salvage - Complete',
  STOCK_CONTROLLER_APPROVAL = 'Awaiting Stock Controller',
  GATE_RELEASE_PENDING    = 'Gate Release Pending',
  PR_SUBMITTED            = 'PR Submitted',
  MANAGER_APPROVAL        = 'Manager Approval',
  PO_GENERATED            = 'PO Generated',
  SUPPLIER_DELIVERY       = 'Supplier Delivery',
  STOCK_INTAKE            = 'Stock Controller Intake',
}

export enum Priority {
  Low      = 'Low',
  Medium   = 'Medium',
  High     = 'High',
  Critical = 'Critical',
}

export interface WorkflowItem {
  partNumber:         string;
  description:        string;
  quantityRequested:  number;
  quantityOnHand?:    number;
}

export interface WorkflowAttachment {
  id:          string;
  url:         string;
  fileName?:   string | null;
  uploadedAt?: string;
}

export interface WorkflowRequest {
  id:                   string;
  requestNumber:        string;
  type:                 'Internal' | 'External';
  requester:            string;
  requester_id:         string;
  projectCode:          string;
  department:           Store;
  currentStatus:        WorkflowStatus;
  priority:             Priority;
  createdAt:            string;
  items:                WorkflowItem[];
  steps:                WorkflowStatus[];
  attachmentUrl?:       string | null;
  rejectionComment?:    string | null;
  driverName?:          string | null;
  vehicleRegistration?: string | null;
  attachments?:         WorkflowAttachment[];
}

export interface WorkflowComment {
  id:           string;
  comment_text: string;
  created_at:   string;
  user:         { name: string } | null;
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export interface StockItem {
  id:             string;
  partNumber:     string;
  description:    string;
  category:       string;
  quantityOnHand: number;
  minStockLevel:  number;
  store:          StoreType;
  location:       string;
  site_id?:       string | null;
}

export interface StockReceipt {
  id:               string;
  partNumber:       string;
  description:      string;
  quantityReceived: number;
  receivedBy:       string;
  receivedAt:       string;
  store:            StoreType;
  deliveryNotePO:   string;
  comments?:        string | null;
  attachmentUrl?:   string | null;
}

export interface SalvageRequest {
  id:            string;
  stock_item_id: string;
  partNumber:    string;
  description:   string;
  quantity:      number;
  status:        WorkflowStatus;
  notes:         string | null;
  sourceStore?:  Store;
  createdBy:     string;
  createdAt:     string;
  decisionBy:    string | null;
  decisionAt:    string | null;
  photoUrl?:     string | null;
}

// ─── Module access ────────────────────────────────────────────────────────────
export type ModuleAccess = 'fleet' | 'operations' | 'chooser';

export function getModuleAccess(user: User): ModuleAccess {
  const role = user.role;
  if (role === UserRole.Admin)  return 'chooser';
  if (role === UserRole.Driver) return 'fleet';
  return 'operations';
}
