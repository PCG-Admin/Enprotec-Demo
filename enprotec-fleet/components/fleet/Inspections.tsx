import * as React from 'react';
import {
  ClipboardList, CheckCircle, AlertCircle, XCircle,
  Plus, Search, X, Camera, MapPin, ChevronRight, ChevronLeft,
  Trash2, Loader2, Download, Eye,
} from 'lucide-react';
import {
  getInspections, createInspection, deleteInspection,
} from '../../supabase/services/inspections.service';
import { getVehicles } from '../../supabase/services/vehicles.service';
import { getSites } from '../../supabase/services/sites.service';
import { createCost } from '../../supabase/services/costs.service';
import { getActiveTemplates } from '../../supabase/services/templates.service';
import { logAction } from '../../supabase/services/audit.service';
import { getComplianceSchedule } from '../../supabase/services/compliance.service';
import type { InspectionRow, VehicleRow, TemplateRow, DbQuestion, SiteRow, ComplianceRow } from '../../supabase/database.types';
import type { User } from '../../types';
import { UserRole } from '../../types';
import {
  downloadInspection,
  type YesNo, type Condition,
  type WeekRow, type ChecklistFinding, type Breakdown,
  type WheelCheck, type EquipmentChecks, type Deviation,
  type GeneratorEquipmentChecks, type InspectionRecord,
} from '../../utils/printInspection';

// ─── Default state helpers ───────────────────────────────────────────────────

const defaultWheelCheck = (): WheelCheck => ({
  tyreThreadCondition: 'Good',
  bubblesOrDamage: 'No',
  allWheelNutsInPlace: 'Yes',
  photo: '',
});

const defaultEquipment = (): EquipmentChecks => ({
  windscreenCondition: 'Good',
  windscreenPhoto: '',
  wipersCondition: 'Good',
  leftFrontWheel: defaultWheelCheck(),
  rightFrontWheel: defaultWheelCheck(),
  leftRearWheel: defaultWheelCheck(),
  rightRearWheel: defaultWheelCheck(),
  headlightsBothWorking: 'Yes',
  headlightsFreeFromDamage: 'Yes',
  headlightsLensesClear: 'Yes',
  taillightsBothWorking: 'Yes',
  taillightsFreeFromDamage: 'Yes',
  taillightsLensesClear: 'Yes',
  leftIndicatorWorking: 'Yes',
  rightIndicatorWorking: 'Yes',
  hazardsWorking: 'Yes',
  hooterWorking: 'Yes',
  fireExtinguisher: 'Yes',
  stopBlock: 'Yes',
  engineOilLevel: 'Yes',
  oilLeaks: 'No',
  coolantLevel: 'Yes',
  coolantLeaks: 'No',
  hydraulicsOilPhoto: '',
  hydraulicsNote: '',
  fanBelt: 'Good',
  alternatorBelt: 'Good',
  waterHoses: 'Good',
  radiatorLevel: 'Good',
  engineOilLevelEngine: 'Good',
  batteryWaterLevel: 'Good',
  fuelLeaks: 'None',
  engineTemperature: 'Good',
  suspension: 'Yes',
  brakes: 'Yes',
  clutch: 'Yes',
  airConditioner: 'Yes',
  rearViewMirrors: 'Yes',
  seatbelts: 'Yes',
});

const defaultGeneratorEquipment = (): GeneratorEquipmentChecks => ({
  engineOilLevelOk: 'Yes',
  oilLeaks: 'No',
  coolantLevelOk: 'Yes',
  coolantLeaks: 'No',
  fuelGaugePhoto: '',
  fuelLevel: '',
  fanBelt: 'Ok',
  alternatorBelt: 'Ok',
  waterHoses: 'Ok',
  radiatorLevel: 'Ok',
  engineOilLevelEngine: 'Ok',
  batteryWaterLevel: 'Ok',
  fuelLeaks: 'None',
  temperature: 'Ok',
});

const newWeekRow = (): WeekRow => ({
  id: Date.now().toString(),
  weekLabel: '',
  operationalHours: '',
  checklistsCompleted: 'Yes',
  findingsOnChecklists: 'No',
  findingsCommunicated: 'No',
});

const currentWeekRow = (): WeekRow => {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  const id = monday.toISOString().slice(0, 10);
  return { ...newWeekRow(), weekLabel: `${fmt(monday)} – ${fmt(sunday)}`, id };
};

const defaultForm = (): Omit<InspectionRecord, 'id' | 'result'> => ({
  previousInspectionDate: '',
  inspectionDate: new Date().toISOString().split('T')[0],
  inspectedBy: '',
  siteAllocation: '',
  vehicleMakeModel: '',
  registrationNumber: '',
  currentHours: '',
  lastServiceHours: '',
  lastServiceDate: '',
  nextServiceHours: '',
  nextServiceDate: '',
  previousLoadTestDate: '',
  nextLoadTestDate: '',
  totalMaintenanceCost: '',
  avgMonthlyMaintenanceCost: '',
  vehicleFrontPhoto: '',
  vehicleLeftPhoto: '',
  vehicleRightPhoto: '',
  vehicleBackPhoto: '',
  interiorPhoto: '',
  serialNumberPhoto: '',
  serialNumberText: '',
  serviceSticker: '',
  serviceStickerDate: '',
  inspectionType: 'General',
  generatorEquipment: defaultGeneratorEquipment(),
  weeklyUse: [currentWeekRow()],
  checklistFindings: [],
  monthlyBreakdowns: [],
  equipment: defaultEquipment(),
  deviations: [],
});

// ─── Mock list data ───────────────────────────────────────────────────────────



// ─── Sub-components ──────────────────────────────────────────────────────────

const YesNoSelect: React.FC<{ value: YesNo; onChange: (v: YesNo) => void; invertColor?: boolean }> = ({ value, onChange, invertColor }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as YesNo)}
    className={`border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 ${
      value === 'Yes'
        ? invertColor ? 'bg-green-50 text-green-800' : 'bg-green-50 text-green-800'
        : value === 'No'
        ? invertColor ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        : ''
    }`}
  >
    <option value="">—</option>
    <option value="Yes">Yes</option>
    <option value="No">No</option>
  </select>
);

const ConditionSelect: React.FC<{ value: Condition; onChange: (v: Condition) => void }> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as Condition)}
    className={`border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 ${
      value === 'Good' ? 'bg-green-50 text-green-800'
        : value === 'Damaged' ? 'bg-yellow-50 text-yellow-800'
        : value === 'Not Working' ? 'bg-red-50 text-red-800'
        : ''
    }`}
  >
    <option value="">—</option>
    <option value="Good">Good</option>
    <option value="Damaged">Damaged</option>
    <option value="Not Working">Not Working</option>
    <option value="N/A">N/A</option>
  </select>
);

/** Resize + compress an image file to JPEG, max 1024px on longest side */
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else                { width  = Math.round((width  * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const PhotoUpload: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const [processing, setProcessing] = React.useState(false);
  const cameraRef  = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
      {value ? (
        <div className="relative">
          <img src={value} alt={label} className="max-h-32 mx-auto rounded object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : processing ? (
        <div className="flex flex-col items-center gap-1 py-2">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          <p className="text-xs text-gray-500">Processing…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <div className="flex gap-2">
            {/* Take Photo — opens camera directly on all phones */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              <Camera className="h-3.5 w-3.5" />Take Photo
            </button>
            {/* Choose from Gallery */}
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
            >
              Gallery
            </button>
          </div>
          <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}
    </div>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-blue-700 text-white px-4 py-2 rounded font-semibold text-sm tracking-wide mt-6 mb-3">
    {title}
  </div>
);

const CheckRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-700 flex-1">{label}</span>
    <div className="flex-shrink-0 ml-4">{children}</div>
  </div>
);

const TABS = [
  { id: 0, label: 'Vehicle Info' },
  { id: 1, label: 'Weekly Use' },
  { id: 2, label: 'Findings & Breakdowns' },
  { id: 3, label: 'Visual Inspection' },
  { id: 4, label: 'Equipment Checks' },
  { id: 5, label: 'Custom Checklist' },
  { id: 6, label: 'Deviations & Submit' },
];

const Inspections: React.FC<{ user: User | null }> = ({ user }) => {
  const isAdmin      = user?.role === UserRole.Admin || user?.fleet_role != null;
  const isDriver     = user?.role === UserRole.Driver && user?.fleet_role == null; // pure driver only
  const isCoordinator = isDriver; // only pure drivers get filtered vehicle view
  const [inspections, setInspections]       = React.useState<InspectionRecord[]>([]);
  const [vehicles, setVehicles]             = React.useState<VehicleRow[]>([]);
  const [sites, setSites]                   = React.useState<SiteRow[]>([]);
  const [templates, setTemplates]           = React.useState<TemplateRow[]>([]);
  const [templateId, setTemplateId]         = React.useState('');
  const [templateAnswers, setTemplateAnswers] = React.useState<Record<string, string>>({});
  const [loadingList, setLoadingList]       = React.useState(true);
  const [submitting, setSubmitting]   = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [breakdownCostModal, setBreakdownCostModal] = React.useState<{ vehicleId: string; vehicleReg: string; breakdowns: Breakdown[] } | null>(null);
  const [savingCosts, setSavingCosts] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'All' | 'General' | 'Forklift' | 'Generator'>('All');
  const [viewInspection, setViewInspection] = React.useState<InspectionRecord | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState('');
  const [form, setForm] = React.useState(defaultForm());
  const [weekCalMonth, setWeekCalMonth] = React.useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [complianceDue, setComplianceDue] = React.useState<ComplianceRow[]>([]);

  // Auto-populate inspectedBy with the logged-in user's name when the form opens
  React.useEffect(() => {
    if (showForm && user?.name) {
      setForm(prev => ({ ...prev, inspectedBy: prev.inspectedBy || user.name }));
    }
  }, [showForm]);

  React.useEffect(() => {
    Promise.all([getInspections(), getVehicles(), getActiveTemplates(), getSites(), getComplianceSchedule()])
      .then(([rows, vehs, tpls, sts, compliance]) => {
        setTemplates(tpls);
        setVehicles(vehs);
        setSites(sts);
        setInspections(rows.map((r): InspectionRecord => ({
          id: r.id,
          ...((r.answers as unknown as Omit<InspectionRecord, 'id' | 'result'>) ?? defaultForm()),
          result: (r.status as InspectionRecord['result']) ?? 'pass',
        })));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const soon = new Date(today);
        soon.setDate(soon.getDate() + 7);
        setComplianceDue(compliance.filter(c => {
          if (c.status === 'Completed') return false;
          const due = c.due_date ? new Date(c.due_date) : null;
          const sched = c.scheduled_date ? new Date(c.scheduled_date) : null;
          return (due && due <= soon) || (sched && sched <= soon);
        }));
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  const set = (field: keyof typeof form, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const setEquip = (field: keyof EquipmentChecks, value: unknown) =>
    setForm(prev => ({ ...prev, equipment: { ...prev.equipment, [field]: value } }));

  const setGenEquip = (field: keyof GeneratorEquipmentChecks, value: unknown) =>
    setForm(prev => ({ ...prev, generatorEquipment: { ...prev.generatorEquipment, [field]: value } }));

  const setWheel = (wheel: 'leftFrontWheel' | 'rightFrontWheel' | 'leftRearWheel' | 'rightRearWheel', field: keyof WheelCheck, value: unknown) =>
    setForm(prev => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        [wheel]: { ...prev.equipment[wheel], [field]: value },
      },
    }));

  // Auto-compute deviations from equipment checks
  const computedDeviations = React.useMemo((): Deviation[] => {
    const d: Deviation[] = [];
    const e = form.equipment;
    const add = (item: string, deviation: string) =>
      d.push({ id: `auto-${item}`, item, deviation });

    if (e.windscreenCondition && e.windscreenCondition !== 'Good') add('Windscreen', e.windscreenCondition);
    if (e.wipersCondition && e.wipersCondition !== 'Good') add('Wipers', e.wipersCondition);

    const wheels: [string, WheelCheck][] = [
      ['Left Front Wheel', e.leftFrontWheel], ['Right Front Wheel', e.rightFrontWheel],
      ['Left Rear Wheel', e.leftRearWheel], ['Right Rear Wheel', e.rightRearWheel],
    ];
    for (const [name, w] of wheels) {
      if (w.tyreThreadCondition && w.tyreThreadCondition !== 'Good') add(`${name} – Tyre`, w.tyreThreadCondition);
      if (w.bubblesOrDamage === 'Yes') add(`${name} – Damage`, 'Bubbles or damage present');
      if (w.allWheelNutsInPlace === 'No') add(`${name} – Wheel Nuts`, 'Not all wheel nuts in place');
    }

    if (e.headlightsBothWorking === 'No') add('Headlights', 'Both headlights not working');
    if (e.headlightsFreeFromDamage === 'No') add('Headlights', 'Headlights damaged');
    if (e.headlightsLensesClear === 'No') add('Headlights', 'Lenses not clear');
    if (e.taillightsBothWorking === 'No') add('Taillights', 'Both taillights not working');
    if (e.taillightsFreeFromDamage === 'No') add('Taillights', 'Taillights damaged');
    if (e.taillightsLensesClear === 'No') add('Taillights', 'Taillights lenses not clear');
    if (e.leftIndicatorWorking === 'No') add('Left Indicator', 'Not working');
    if (e.rightIndicatorWorking === 'No') add('Right Indicator', 'Not working');
    if (e.hazardsWorking === 'No') add('Hazards', 'Not working');
    if (e.hooterWorking === 'No') add('Hooter', 'Not working / volume inadequate');
    if (e.fireExtinguisher === 'No') add('Fire Extinguisher', 'Missing or expired');
    if (e.stopBlock === 'No') add('Stop Block', 'Missing');
    if (e.engineOilLevel === 'No') add('Engine Oil', 'Oil level not in order');
    if (e.oilLeaks === 'Yes') add('Engine Oil', 'Oil leaks present');
    if (e.coolantLevel === 'No') add('Coolant', 'Coolant level not in order');
    if (e.coolantLeaks === 'Yes') add('Coolant', 'Coolant leaks present');
    if (e.fanBelt && e.fanBelt !== 'Good') add('Fan Belt', e.fanBelt);
    if (e.alternatorBelt && e.alternatorBelt !== 'Good') add('Alternator Belt', e.alternatorBelt);
    if (e.waterHoses && e.waterHoses !== 'Good') add('Water Hoses', e.waterHoses);
    if (e.radiatorLevel && e.radiatorLevel !== 'Good') add('Radiator Level', e.radiatorLevel);
    if (e.fuelLeaks && e.fuelLeaks !== 'None' && e.fuelLeaks !== '') add('Fuel Leaks', e.fuelLeaks);
    if (e.suspension === 'No') add('Suspension', 'Not in good condition');
    if (e.brakes === 'No') add('Brakes', 'Not in good condition');
    if (e.clutch === 'No') add('Clutch', 'Not in good condition');
    if (e.airConditioner === 'No') add('Air Conditioner', 'Not working');
    if (e.rearViewMirrors === 'No') add('Rear View Mirrors', 'Not all mirrors in good condition');
    if (e.seatbelts === 'No') add('Seatbelts', 'Not in good condition');

    // Generator-specific deviations
    if (form.inspectionType === 'Generator') {
      const g = form.generatorEquipment;
      if (g.engineOilLevelOk === 'No') add('Engine Oil', 'Oil level not in order');
      if (g.oilLeaks === 'Yes')         add('Engine Oil', 'Oil leaks present');
      if (g.coolantLevelOk === 'No')    add('Coolant', 'Coolant level not in order');
      if (g.coolantLeaks === 'Yes')     add('Coolant', 'Coolant leaks present');
      if (g.fanBelt !== 'Ok' && g.fanBelt !== 'N/A')           add('Fan Belt', g.fanBelt);
      if (g.alternatorBelt !== 'Ok' && g.alternatorBelt !== 'N/A') add('Alternator Belt', g.alternatorBelt);
      if (g.waterHoses !== 'Ok' && g.waterHoses !== 'N/A')    add('Water Hoses', g.waterHoses);
      if (g.radiatorLevel !== 'Ok' && g.radiatorLevel !== 'N/A') add('Radiator Level', g.radiatorLevel);
      if (g.engineOilLevelEngine !== 'Ok' && g.engineOilLevelEngine !== 'N/A') add('Engine Oil Level', g.engineOilLevelEngine);
      if (g.batteryWaterLevel !== 'Ok' && g.batteryWaterLevel !== 'N/A') add('Battery Water Level', g.batteryWaterLevel);
      if (g.temperature !== 'Ok' && g.temperature !== 'N/A')  add('Temperature', g.temperature);
      if (g.fuelLeaks && g.fuelLeaks !== 'None' && g.fuelLeaks !== '') add('Fuel Leaks', g.fuelLeaks);
    }

    // Merge with manual deviations
    return [...d, ...form.deviations.filter(md => !md.id.startsWith('auto-'))];
  }, [form.equipment, form.deviations]);

  const computeResult = (): InspectionRecord['result'] => {
    const failKeywords = ['Not Working', 'damaged', 'missing', 'expired'];
    const hasFailure = computedDeviations.some(d =>
      failKeywords.some(kw => d.deviation.toLowerCase().includes(kw.toLowerCase()))
    );
    if (hasFailure) return computedDeviations.length > 3 ? 'fail' : 'requires_attention';
    return computedDeviations.length > 0 ? 'requires_attention' : 'pass';
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = computeResult();
      const formWithDeviations = { ...form, deviations: computedDeviations };
      const vehicle = vehicles.find(v => v.id === selectedVehicleId) ?? vehicles.find(v => v.registration.toLowerCase() === form.registrationNumber.toLowerCase());
      const selectedTemplate = templates.find(t => t.id === templateId);
      const payload = {
        vehicle_id: vehicle?.id ?? form.registrationNumber,
        inspector_id: user?.id ?? null,
        inspection_type: form.inspectionType,
        started_at: form.inspectionDate ? new Date(form.inspectionDate).toISOString() : new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: result,
        answers: {
          ...formWithDeviations,
          templateId,
          templateAnswers,
          templateName: selectedTemplate?.name ?? '',
          templateQuestions: selectedTemplate?.questions ?? [],
        } as any,
        notes: computedDeviations.map(d => `${d.item}: ${d.deviation}`).join('; ') || null,
        odometer: form.currentHours ? parseInt(form.currentHours) || null : null,
        hour_meter: null as number | null,
        signature_url: null as string | null,
        template_id: templateId || null,
      };
      const saved = await createInspection(payload);
      const record: InspectionRecord = {
        id: saved.id,
        ...(formWithDeviations),
        templateId,
        templateAnswers,
        templateName: selectedTemplate?.name,
        templateQuestions: selectedTemplate?.questions,
        result,
      };
      setInspections(prev => [record, ...prev]);
      if (user) logAction(user.id, user.name, 'Created', 'Inspections', `Submitted ${form.inspectionType} inspection for ${form.registrationNumber} — result: ${result}`);
      setShowForm(false);
      setActiveTab(0);

      // T47/T48: offer to log breakdown costs as cost entries
      // Use saved.vehicle_id (guaranteed valid UUID from persisted inspection)
      const breakdownsWithCost = form.monthlyBreakdowns.filter(b => b.costToRepair && parseFloat(b.costToRepair) > 0);
      if (breakdownsWithCost.length > 0 && saved.vehicle_id) {
        setBreakdownCostModal({ vehicleId: saved.vehicle_id, vehicleReg: form.registrationNumber, breakdowns: breakdownsWithCost });
      } else {
        setForm(defaultForm());
        setTemplateId('');
        setTemplateAnswers({});
        setSelectedVehicleId('');
      }
    } catch (e: any) {
      alert('Failed to save inspection: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInspection = async (id: string) => {
    if (!confirm('Delete this inspection?')) return;
    try {
      const record = inspections.find(i => i.id === id);
      await deleteInspection(id);
      setInspections(prev => prev.filter(i => i.id !== id));
      if (user) logAction(user.id, user.name, 'Deleted', 'Inspections', `Deleted ${record?.inspectionType ?? 'inspection'} for ${record?.registrationNumber ?? 'unknown vehicle'}`);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  // For drivers and fleet coordinators: filter to vehicles assigned to the user
  const visibleVehicles = isCoordinator
    ? vehicles.filter(v => v.assigned_driver_id === user?.id)
    : vehicles;

  // Filter inspections: non-admin users only see their own submitted inspections
  const assignedRegs = new Set(visibleVehicles.map(v => v.registration));
  const filteredInspections = inspections.filter(i => {
    if (!isAdmin && i.inspectedBy !== user?.name) return false;
    if (isCoordinator && !assignedRegs.has(i.registrationNumber)) return false;
    if (typeFilter !== 'All' && (i.inspectionType ?? 'General') !== typeFilter) return false;
    return (
      i.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.vehicleMakeModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.inspectedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.siteAllocation.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const ResultBadge: React.FC<{ result: InspectionRecord['result'] }> = ({ result }) => {
    const cfg = {
      pass: { cls: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3 mr-1" />, label: 'Pass' },
      fail: { cls: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3 mr-1" />, label: 'Fail' },
      requires_attention: { cls: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="h-3 w-3 mr-1" />, label: 'Requires Attention' },
    };
    const { cls, icon, label } = cfg[result];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
        {icon}{label}
      </span>
    );
  };

  // ── Render tabs ─────────────────────────────────────────────────────────────

  const renderTab0 = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 flex items-center"><MapPin className="h-4 w-4 mr-1" /> GPS timestamp will be captured on submission.</p>

      {/* Vehicle quick-select — all users */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Vehicle
          {isDriver && visibleVehicles.length === 0 && (
            <span className="ml-2 text-orange-500 text-xs font-normal">(no vehicle assigned yet — contact your admin)</span>
          )}
        </label>
        <select
          value={form.registrationNumber}
          onChange={e => {
            const pool = isDriver && visibleVehicles.length > 0 ? visibleVehicles : vehicles;
            const v = pool.find(v => v.registration === e.target.value);
            if (v) {
              set('registrationNumber', v.registration);
              set('vehicleMakeModel', `${v.make} ${v.model}`.trim());
              setSelectedVehicleId(v.id);
            }
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select vehicle…</option>
          {(isDriver && visibleVehicles.length > 0 ? visibleVehicles : vehicles).map(v => (
            <option key={v.id} value={v.registration}>{v.registration} — {v.make} {v.model}</option>
          ))}
        </select>
      </div>

      {/* Inspection Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Inspection Type</label>
        <div className="flex flex-wrap gap-3">
          {([
            { t: 'General',   active: 'bg-blue-600 border-blue-600 text-white' },
            { t: 'Forklift',  active: 'bg-orange-500 border-orange-500 text-white' },
            { t: 'Generator', active: 'bg-green-600 border-green-600 text-white' },
          ] as const).map(({ t, active }) => (
            <button
              key={t}
              type="button"
              onClick={() => set('inspectionType', t)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                form.inspectionType === t ? active : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {/* Site Allocation dropdown */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-700 mb-1">Site Allocation</label>
        <select
          value={form.siteAllocation}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('siteAllocation', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Select site —</option>
          {[...new Map(sites.filter((s: SiteRow) => s.status === 'Active').map((s: SiteRow) => [s.name, s])).values()].map((s: SiteRow) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([
          ['Previous Inspection Date', 'previousInspectionDate', 'date'],
          ['Inspection Date *', 'inspectionDate', 'date'],
          ['Inspected By *', 'inspectedBy', 'text'],
          ['Vehicle Make & Model *', 'vehicleMakeModel', 'text'],
          ['Registration Number *', 'registrationNumber', 'text'],
          ['Current Hours / Odometer', 'currentHours', 'text'],
          ['Last Service (Hours)', 'lastServiceHours', 'text'],
          ['Last Service (Date)', 'lastServiceDate', 'date'],
          ['Next Service (Hours)', 'nextServiceHours', 'text'],
          ['Next Service (Date)', 'nextServiceDate', 'date'],
          ['Previous Load Test Date', 'previousLoadTestDate', 'date'],
          ['Next Load Test Date', 'nextLoadTestDate', 'date'],
          ['Total Maintenance Cost (R)', 'totalMaintenanceCost', 'text'],
          ['Avg Monthly Maintenance Cost (R)', 'avgMonthlyMaintenanceCost', 'text'],
          ['Serial Number', 'serialNumberText', 'text'],
          ['Service Sticker Date', 'serviceStickerDate', 'date'],
        ] as [string, keyof typeof form, string][]).map(([label, field, type]) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[field] as string}
              onChange={(e) => {
                set(field, e.target.value);
                if (field === 'registrationNumber') {
                  const match = vehicles.find(v => v.registration.toLowerCase() === e.target.value.toLowerCase());
                  setSelectedVehicleId(match?.id ?? '');
                  if (match && !form.vehicleMakeModel) set('vehicleMakeModel', `${match.make} ${match.model}`.trim());
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Custom checklist template selector */}
      {templates.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Checklist Template{' '}
            <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <select
            value={templateId}
            onChange={e => { setTemplateId(e.target.value); setTemplateAnswers({}); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None — skip custom checklist</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.frequency})</option>
            ))}
          </select>
          {templateId && (
            <p className="text-xs text-blue-600 mt-1">
              Custom questions will appear in the "Custom Checklist" tab.
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderTab1 = () => {
    const year  = weekCalMonth.getFullYear();
    const month = weekCalMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = weekCalMonth.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().slice(0, 10);

    // Calendar click → always updates the LAST row's week (never adds a new row)
    const pickWeekForDay = (d: number) => {
      const clicked = new Date(year, month, d);
      const dow = clicked.getDay();
      const monday = new Date(clicked);
      monday.setDate(clicked.getDate() - ((dow + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekKey = monday.toISOString().slice(0, 10);
      const fmt = (dt: Date) => dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
      const label = `${fmt(monday)} – ${fmt(sunday)}`;
      const updated = [...form.weeklyUse];
      if (updated.length === 0) {
        updated.push({ ...newWeekRow(), weekLabel: label, id: weekKey });
      } else {
        updated[updated.length - 1] = { ...updated[updated.length - 1], weekLabel: label, id: weekKey };
      }
      set('weeklyUse', updated);
    };

    // Highlight calendar: locked weeks (all except last) vs active (last row)
    const lockedDays = new Set<string>();
    const activeDays = new Set<string>();
    form.weeklyUse.forEach((r: WeekRow, idx: number) => {
      const mon = new Date(r.id);
      if (isNaN(mon.getTime())) return;
      const target = idx === form.weeklyUse.length - 1 ? activeDays : lockedDays;
      for (let i = 0; i < 7; i++) {
        const d2 = new Date(mon);
        d2.setDate(mon.getDate() + i);
        target.add(d2.toISOString().slice(0, 10));
      }
    });

    const cells = Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isActive = activeDays.has(dateStr);
      const isLocked = lockedDays.has(dateStr);
      cells.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => pickWeekForDay(d)}
          title="Click to set this week"
          className={`h-9 w-full rounded text-xs font-medium transition-colors
            ${isLocked ? 'bg-gray-300 text-gray-600 cursor-default' : isActive ? 'bg-blue-600 text-white ring-2 ring-blue-400' : isToday ? 'bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100' : 'bg-white border border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300'}
          `}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="space-y-4">
        {/* Mini calendar */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setWeekCalMonth((m: Date) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1 rounded hover:bg-gray-200"><ChevronLeft className="h-4 w-4"/></button>
            <span className="text-sm font-semibold text-gray-700">{monthLabel}</span>
            <button type="button" onClick={() => setWeekCalMonth((m: Date) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-1 rounded hover:bg-gray-200"><ChevronRight className="h-4 w-4"/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{cells}</div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Click any day to set the <span className="text-blue-600 font-medium">active</span> week row — use + to track additional weeks</p>
        </div>

        {/* Week rows table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Week</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Operational Hours</th>
                {form.inspectionType !== 'Generator' && <>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Checklists Completed?</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Findings?</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Findings Addressed?</th>
                </>}
                <th className="px-3 py-2 text-right">
                  <button type="button"
                    onClick={() => set('weeklyUse', [...form.weeklyUse, newWeekRow()])}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                    <Plus className="h-3.5 w-3.5" />Add week
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.weeklyUse.map((row: WeekRow, idx: number) => {
                const isLastRow = idx === form.weeklyUse.length - 1;
                return (
                <tr key={row.id} className={isLastRow ? 'bg-blue-50' : 'bg-white'}>
                  <td className="px-3 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">
                    {row.weekLabel || <span className="text-gray-400 italic">← pick on calendar</span>}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.operationalHours}
                      onChange={(e) => {
                        const updated = [...form.weeklyUse];
                        updated[idx] = { ...row, operationalHours: e.target.value };
                        set('weeklyUse', updated);
                      }}
                      placeholder="e.g. 3Hrs"
                      className="w-20 border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  {form.inspectionType !== 'Generator' && (['checklistsCompleted', 'findingsOnChecklists', 'findingsCommunicated'] as const).map((f) => (
                    <td key={f} className="px-3 py-2">
                      <YesNoSelect
                        value={row[f]}
                        onChange={(v: YesNo) => {
                          const updated = [...form.weeklyUse];
                          updated[idx] = { ...row, [f]: v };
                          set('weeklyUse', updated);
                        }}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => set('weeklyUse', form.weeklyUse.filter((_: WeekRow, i: number) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ); })}
              {form.weeklyUse.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">Click a day above to add weeks</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTab2 = () => (
    <div className="space-y-6">
      {/* 1.1 Pre-use Inspection Checklist Findings */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-800">1.1 Pre-Use Inspection Checklist Findings</h3>
          <button
            type="button"
            onClick={() => set('checklistFindings', [...form.checklistFindings, { id: Date.now().toString(), date: '', description: '', remedialAction: '' }])}
            className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Finding
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2 italic">** Attach relevant pre-use inspection checklist and proof of close-out **</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Finding Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Remedial Action Taken</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.checklistFindings.map((row, idx) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input type="date" value={row.date}
                      onChange={(e) => { const u = [...form.checklistFindings]; u[idx] = { ...row, date: e.target.value }; set('checklistFindings', u); }}
                      className="border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={row.description} placeholder="Describe finding..."
                      onChange={(e) => { const u = [...form.checklistFindings]; u[idx] = { ...row, description: e.target.value }; set('checklistFindings', u); }}
                      className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={row.remedialAction} placeholder="Action taken..."
                      onChange={(e) => { const u = [...form.checklistFindings]; u[idx] = { ...row, remedialAction: e.target.value }; set('checklistFindings', u); }}
                      className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => set('checklistFindings', form.checklistFindings.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {form.checklistFindings.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">No findings logged</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Monthly Breakdowns */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-800">2. Monthly Breakdowns</h3>
          <button
            type="button"
            onClick={() => set('monthlyBreakdowns', [...form.monthlyBreakdowns, { id: Date.now().toString(), description: '', durationHrs: '', spareParts: '', costToRepair: '' }])}
            className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Breakdown
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2 italic">** Attach relevant breakdown report and proof of close-out **</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Breakdown Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Duration (Hrs)</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Spare Parts Needed</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost to Repair (R)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.monthlyBreakdowns.map((row, idx) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                  {(['description', 'durationHrs', 'spareParts', 'costToRepair'] as const).map((f) => (
                    <td key={f} className="px-3 py-2">
                      <input type="text" value={row[f]}
                        onChange={(e) => { const u = [...form.monthlyBreakdowns]; u[idx] = { ...row, [f]: e.target.value }; set('monthlyBreakdowns', u); }}
                        className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => set('monthlyBreakdowns', form.monthlyBreakdowns.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {form.monthlyBreakdowns.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">No breakdowns this month</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTab3 = () => {
    const isGen = form.inspectionType === 'Generator';
    const prefix = isGen ? 'Machine' : 'Vehicle';
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Take photos of each angle of the {isGen ? 'generator' : 'vehicle'} and relevant identifiers.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {([
            [`${prefix} Front`, 'vehicleFrontPhoto'],
            [`${prefix} Left`,  'vehicleLeftPhoto'],
            [`${prefix} Right`, 'vehicleRightPhoto'],
            [`${prefix} Back`,  'vehicleBackPhoto'],
            ['Interior',        'interiorPhoto'],
            ['Serial Number Plate', 'serialNumberPhoto'],
            ['Service Sticker', 'serviceSticker'],
          ] as [string, keyof typeof form][]).map(([label, field]) => (
            <PhotoUpload
              key={field}
              label={label}
              value={form[field] as string}
              onChange={(v) => set(field, v)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderWheelSection = (label: string, wheel: 'leftFrontWheel' | 'rightFrontWheel' | 'leftRearWheel' | 'rightRearWheel') => (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <PhotoUpload label="Photo" value={form.equipment[wheel].photo} onChange={(v) => setWheel(wheel, 'photo', v)} />
      </div>
      <CheckRow label="Tyre Thread Condition">
        <ConditionSelect value={form.equipment[wheel].tyreThreadCondition} onChange={(v) => setWheel(wheel, 'tyreThreadCondition', v)} />
      </CheckRow>
      <CheckRow label="Any bubbles or other damage?">
        <YesNoSelect value={form.equipment[wheel].bubblesOrDamage} onChange={(v) => setWheel(wheel, 'bubblesOrDamage', v)} />
      </CheckRow>
      <CheckRow label="All Wheel Nuts In Place">
        <YesNoSelect value={form.equipment[wheel].allWheelNutsInPlace} onChange={(v) => setWheel(wheel, 'allWheelNutsInPlace', v)} />
      </CheckRow>
    </div>
  );

  const renderTab4Generator = () => {
    const g = form.generatorEquipment;
    const okOptions = ['Ok', 'Not Ok', 'N/A'];
    const OkSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
      <select value={value} onChange={e => onChange(e.target.value)}
        className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500">
        {okOptions.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    return (
      <div className="space-y-2">
        <SectionHeader title="Fluids" />
        <CheckRow label="Engine oil level in order">
          <YesNoSelect value={g.engineOilLevelOk} onChange={v => setGenEquip('engineOilLevelOk', v)} />
        </CheckRow>
        <CheckRow label="Any oil leaks">
          <YesNoSelect value={g.oilLeaks} onChange={v => setGenEquip('oilLeaks', v)} />
        </CheckRow>
        <CheckRow label="Coolant level in order">
          <YesNoSelect value={g.coolantLevelOk} onChange={v => setGenEquip('coolantLevelOk', v)} />
        </CheckRow>
        <CheckRow label="Any coolant leaks">
          <YesNoSelect value={g.coolantLeaks} onChange={v => setGenEquip('coolantLeaks', v)} />
        </CheckRow>

        <SectionHeader title="Fuel Gauge" />
        <div className="flex items-start gap-3 py-2 border-b border-gray-100">
          <span className="text-sm text-gray-700 flex-1">Fuel Gauge Photo</span>
          <div className="w-24"><PhotoUpload label="Gauge photo" value={g.fuelGaugePhoto} onChange={v => setGenEquip('fuelGaugePhoto', v)} /></div>
        </div>
        <CheckRow label="Fuel Level">
          <input type="text" value={g.fuelLevel} onChange={e => setGenEquip('fuelLevel', e.target.value)}
            placeholder="e.g. Half Tank, Full"
            className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 w-40" />
        </CheckRow>

        <SectionHeader title="Engine" />
        {([
          ['Fan belt',            'fanBelt'],
          ['Alternator belt',     'alternatorBelt'],
          ['Water hoses',         'waterHoses'],
          ['Radiator level',      'radiatorLevel'],
          ['Engine oil level',    'engineOilLevelEngine'],
          ['Battery water level', 'batteryWaterLevel'],
          ['Temperature',         'temperature'],
        ] as [string, keyof GeneratorEquipmentChecks][]).map(([label, field]) => (
          <CheckRow key={field} label={label}>
            <OkSelect value={g[field] as string} onChange={v => setGenEquip(field, v)} />
          </CheckRow>
        ))}
        <CheckRow label="Fuel leaks">
          <input type="text" value={g.fuelLeaks} onChange={e => setGenEquip('fuelLeaks', e.target.value)}
            placeholder="None / describe..."
            className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 w-40" />
        </CheckRow>
      </div>
    );
  };

  const renderTab4 = () => {
    if (form.inspectionType === 'Generator') return renderTab4Generator();
    const e = form.equipment;
    return (
      <div className="space-y-2">

        <SectionHeader title="Windscreen & Wipers" />
        <CheckRow label="Windscreen Condition">
          <div className="flex flex-col items-end gap-2">
            <ConditionSelect value={e.windscreenCondition} onChange={(v) => { setEquip('windscreenCondition', v); if (v === 'Good') setEquip('windscreenPhoto', ''); }} />
            {e.windscreenCondition !== 'Good' && (
              <div className="w-full">
                <p className="text-xs text-red-600 font-medium mb-1">Photo required — attach evidence of damage</p>
                <PhotoUpload label="Windscreen Photo" value={e.windscreenPhoto} onChange={(v) => setEquip('windscreenPhoto', v)} />
              </div>
            )}
          </div>
        </CheckRow>
        <CheckRow label="Wipers effectively wipe windscreen">
          <ConditionSelect value={e.wipersCondition} onChange={(v) => setEquip('wipersCondition', v)} />
        </CheckRow>

        <SectionHeader title="Wheels" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {renderWheelSection('Left Front Wheel (Passenger Side)', 'leftFrontWheel')}
          {renderWheelSection('Right Front Wheel (Driver Side)', 'rightFrontWheel')}
          {renderWheelSection('Left Rear Wheel (Passenger Side)', 'leftRearWheel')}
          {renderWheelSection('Right Rear Wheel (Driver Side)', 'rightRearWheel')}
        </div>

        <SectionHeader title="Lighting" />
        {[
          ['Both headlights and high beams working', 'headlightsBothWorking'],
          ['Headlights free from damage', 'headlightsFreeFromDamage'],
          ['Headlight lenses clear', 'headlightsLensesClear'],
          ['Both taillights and brake lights working', 'taillightsBothWorking'],
          ['Taillights free from damage', 'taillightsFreeFromDamage'],
          ['Taillight lenses clear', 'taillightsLensesClear'],
          ['Left indicator (front and rear) working', 'leftIndicatorWorking'],
          ['Right indicator (front and rear) working', 'rightIndicatorWorking'],
          ['Hazards working', 'hazardsWorking'],
        ].map(([label, field]) => (
          <CheckRow key={field} label={label}>
            <YesNoSelect value={e[field as keyof EquipmentChecks] as YesNo} onChange={(v) => setEquip(field as keyof EquipmentChecks, v)} />
          </CheckRow>
        ))}

        <SectionHeader title="Hooter & Emergency Kit" />
        <CheckRow label="Hooter working and volume adequate">
          <YesNoSelect value={e.hooterWorking} onChange={(v) => setEquip('hooterWorking', v)} />
        </CheckRow>
        <CheckRow label="Fire extinguisher present and valid">
          <YesNoSelect value={e.fireExtinguisher} onChange={(v) => setEquip('fireExtinguisher', v)} />
        </CheckRow>
        <CheckRow label="Stop block present">
          <YesNoSelect value={e.stopBlock} onChange={(v) => setEquip('stopBlock', v)} />
        </CheckRow>

        <SectionHeader title="Fluids" />
        <CheckRow label="Engine oil level in order">
          <YesNoSelect value={e.engineOilLevel} onChange={(v) => setEquip('engineOilLevel', v)} />
        </CheckRow>
        <CheckRow label="Any oil leaks">
          <YesNoSelect value={e.oilLeaks} onChange={(v) => setEquip('oilLeaks', v)} />
        </CheckRow>
        <CheckRow label="Coolant level in order">
          <YesNoSelect value={e.coolantLevel} onChange={(v) => setEquip('coolantLevel', v)} />
        </CheckRow>
        <CheckRow label="Any coolant leaks">
          <YesNoSelect value={e.coolantLeaks} onChange={(v) => setEquip('coolantLeaks', v)} />
        </CheckRow>
        <div className="flex items-start gap-3 py-2 border-b border-gray-100">
          <span className="text-sm text-gray-700 flex-1">Hydraulics Oil – Gauge Photo</span>
          <div className="flex items-center gap-2">
            <div className="w-24"><PhotoUpload label="Gauge photo" value={e.hydraulicsOilPhoto} onChange={(v) => setEquip('hydraulicsOilPhoto', v)} /></div>
            <input type="text" value={e.hydraulicsNote} onChange={(e) => setEquip('hydraulicsNote', e.target.value)}
              placeholder="Note (e.g. Door locked, key lost)"
              className="border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 w-40" />
          </div>
        </div>

        <SectionHeader title="Engine" />
        {[
          ['Fan belt', 'fanBelt'], ['Alternator belt', 'alternatorBelt'],
          ['Water hoses', 'waterHoses'], ['Radiator level', 'radiatorLevel'],
          ['Engine oil level', 'engineOilLevelEngine'], ['Battery water level', 'batteryWaterLevel'],
          ['Engine temperature', 'engineTemperature'],
        ].map(([label, field]) => (
          <CheckRow key={field} label={label}>
            <ConditionSelect value={e[field as keyof EquipmentChecks] as Condition} onChange={(v) => setEquip(field as keyof EquipmentChecks, v)} />
          </CheckRow>
        ))}
        <CheckRow label="Fuel leaks">
          <input type="text" value={e.fuelLeaks} onChange={(ev) => setEquip('fuelLeaks', ev.target.value)}
            placeholder="None / describe..."
            className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 w-32" />
        </CheckRow>

        <SectionHeader title="General" />
        {[
          ['Suspension in good condition', 'suspension'],
          ['Brakes in good condition', 'brakes'],
          ['Clutch in good condition and easily engages gear', 'clutch'],
          ['Air conditioner working', 'airConditioner'],
          ['All 3 rear view mirrors in good condition', 'rearViewMirrors'],
          ['All seatbelts and seatbelt latches in good condition', 'seatbelts'],
        ].map(([label, field]) => (
          <CheckRow key={field} label={label}>
            <YesNoSelect value={e[field as keyof EquipmentChecks] as YesNo} onChange={(v) => setEquip(field as keyof EquipmentChecks, v)} />
          </CheckRow>
        ))}
      </div>
    );
  };

  const renderTab5 = () => {
    const selectedTemplate = templates.find((t: TemplateRow) => t.id === templateId);

    if (!selectedTemplate) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
          <ClipboardList className="h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No template selected</p>
          <p className="text-xs text-gray-400">
            Go back to "Vehicle Info" and choose a template to add custom questions here.
          </p>
        </div>
      );
    }

    const questions: DbQuestion[] = selectedTemplate.questions as DbQuestion[];
    const setAnswer = (qId: string, value: string) =>
      setTemplateAnswers(prev => ({ ...prev, [qId]: value }));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">{selectedTemplate.name}</h3>
            <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
          </div>
          <span className="text-xs text-gray-400">{questions.length} questions</span>
        </div>

        <div className="space-y-3">
          {questions.map((question, idx) => {
            const answer = templateAnswers[question.id] ?? '';
            return (
              <div key={question.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-medium text-gray-800 flex-1">
                    {question.text}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                </div>

                {question.type === 'checkbox' && (
                  <div className="flex gap-3 ml-8">
                    <button type="button"
                      onClick={() => setAnswer(question.id, answer === 'Pass' ? '' : 'Pass')}
                      className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        answer === 'Pass'
                          ? 'bg-green-100 border-green-300 text-green-800'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-green-300'
                      }`}>Pass</button>
                    <button type="button"
                      onClick={() => setAnswer(question.id, answer === 'Fail' ? '' : 'Fail')}
                      className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        answer === 'Fail'
                          ? 'bg-red-100 border-red-300 text-red-800'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-red-300'
                      }`}>Fail</button>
                  </div>
                )}

                {question.type === 'text' && (
                  <input type="text" value={answer}
                    onChange={e => setAnswer(question.id, e.target.value)}
                    className="ml-8 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your response…" />
                )}

                {question.type === 'number' && (
                  <div className="ml-8 flex items-center gap-2">
                    <input type="number" value={answer}
                      onChange={e => setAnswer(question.id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-32"
                      placeholder="0" />
                    {question.unit && <span className="text-sm text-gray-500">{question.unit}</span>}
                  </div>
                )}

                {question.type === 'select' && (
                  <select value={answer}
                    onChange={e => setAnswer(question.id, e.target.value)}
                    className="ml-8 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Select an option…</option>
                    {(question.options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {question.type === 'photo' && (
                  <div className="ml-8">
                    <PhotoUpload label={question.text} value={answer} onChange={v => setAnswer(question.id, v)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTab6 = () => {
    const manualDeviations = form.deviations.filter(d => !d.id.startsWith('auto-'));
    return (
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">1.2 Deviations</h3>
            <button
              type="button"
              onClick={() => set('deviations', [...form.deviations, { id: Date.now().toString(), item: '', deviation: '' }])}
              className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Manual
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Items flagged by equipment checks appear automatically. Add additional deviations manually below.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">No</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Deviation</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 w-16">Source</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {computedDeviations.map((dev, idx) => {
                  const isAuto = dev.id.startsWith('auto-');
                  return (
                    <tr key={dev.id} className={isAuto ? 'bg-yellow-50' : 'bg-white'}>
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        {isAuto ? <span className="text-gray-700">{dev.item}</span> : (
                          <input type="text" value={dev.item}
                            onChange={(e) => { const u = form.deviations.map(d => d.id === dev.id ? { ...d, item: e.target.value } : d); set('deviations', u); }}
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isAuto ? <span className="text-gray-700">{dev.deviation}</span> : (
                          <input type="text" value={dev.deviation}
                            onChange={(e) => { const u = form.deviations.map(d => d.id === dev.id ? { ...d, deviation: e.target.value } : d); set('deviations', u); }}
                            className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isAuto ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isAuto ? 'Auto' : 'Manual'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {!isAuto && (
                          <button type="button" onClick={() => set('deviations', form.deviations.filter(d => d.id !== dev.id))} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {computedDeviations.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-green-600 text-sm font-medium">No deviations found — vehicle is in good condition</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outcome preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Inspection Outcome Preview</p>
          <div className="flex items-center gap-3">
            {(() => {
              const r = computeResult();
              const cfg = {
                pass: { cls: 'bg-green-100 border-green-300 text-green-800', label: 'PASS — No deviations detected' },
                requires_attention: { cls: 'bg-yellow-100 border-yellow-300 text-yellow-800', label: `REQUIRES ATTENTION — ${computedDeviations.length} deviation(s) found` },
                fail: { cls: 'bg-red-100 border-red-300 text-red-800', label: `FAIL — ${computedDeviations.length} deviation(s) found` },
              };
              return <div className={`border rounded-lg px-4 py-3 font-semibold text-sm ${cfg[r].cls}`}>{cfg[r].label}</div>;
            })()}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => { setShowForm(false); setForm(defaultForm()); setActiveTab(0); setTemplateId(''); setTemplateAnswers({}); setSelectedVehicleId(''); }}
            className="flex-1 border border-gray-300 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Inspection
          </button>
        </div>
      </div>
    );
  };

  const tabContent = [renderTab0, renderTab1, renderTab2, renderTab3, renderTab4, renderTab5, renderTab6];

  // ── Main list view ──────────────────────────────────────────────────────────

  if (showForm) {
    return (
      <div className="space-y-0">
        {/* Form header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Inspection</h1>
            <p className="text-sm text-gray-500">{TABS[activeTab].label}</p>
          </div>
          <button onClick={() => { setShowForm(false); setForm(defaultForm()); setActiveTab(0); setTemplateId(''); setTemplateAnswers({}); setSelectedVehicleId(''); }} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-lg shadow p-6 min-h-[400px]">
          {tabContent[activeTab]()}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => setActiveTab(t => Math.max(0, t - 1))}
            disabled={activeTab === 0}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </button>
          {activeTab < TABS.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveTab(t => Math.min(TABS.length - 1, t + 1))}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Inspections</h1>
        <button
          onClick={() => {
            const base = defaultForm();
            if (isDriver && user) {
              base.inspectedBy = user.name;
              const v = visibleVehicles[0];
              if (v) { base.registrationNumber = v.registration; base.vehicleMakeModel = `${v.make} ${v.model}`.trim(); setSelectedVehicleId(v.id); }
            }
            setForm(base);
            setTemplateId('');
            setTemplateAnswers({});
            setActiveTab(0);
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Inspection
        </button>
      </div>

      {/* Compliance Warning Banner */}
      {complianceDue.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                {complianceDue.length} vehicle{complianceDue.length > 1 ? 's have' : ' has'} compliance inspections due or scheduled within 7 days
              </p>
              <ul className="mt-2 space-y-1">
                {complianceDue.map(c => {
                  const reg = c.vehicle?.registration ?? 'Unknown vehicle';
                  const due = c.due_date ? new Date(c.due_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
                  const sched = c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
                  const isOverdue = c.due_date && new Date(c.due_date) < new Date();
                  return (
                    <li key={c.id} className="text-xs text-amber-700 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <span><strong>{reg}</strong> — {c.inspection_type}</span>
                      {sched && <span className="text-amber-600">(Scheduled: {sched})</span>}
                      {due && <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>· Due: {due}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Search + Type filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vehicle, registration, inspector, or site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { t: 'All',       active: 'bg-gray-700 border-gray-700 text-white' },
              { t: 'General',   active: 'bg-blue-600 border-blue-600 text-white' },
              { t: 'Forklift',  active: 'bg-orange-500 border-orange-500 text-white' },
              { t: 'Generator', active: 'bg-green-600 border-green-600 text-white' },
            ] as const).map(({ t, active }) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t as typeof typeFilter)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                  typeFilter === t ? active : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full"><ClipboardList className="h-6 w-6 text-blue-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Inspections</p>
              <p className="text-2xl font-bold text-gray-900">{filteredInspections.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full"><CheckCircle className="h-6 w-6 text-green-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pass</p>
              <p className="text-2xl font-bold text-gray-900">{filteredInspections.filter(i => i.result === 'pass').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-full"><AlertCircle className="h-6 w-6 text-yellow-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attention / Fail</p>
              <p className="text-2xl font-bold text-gray-900">{filteredInspections.filter(i => i.result !== 'pass').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow">
        {loadingList ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Loading inspections…</span>
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No inspections found</h3>
            <p className="mt-1 text-gray-500">{searchTerm ? 'Try adjusting your search' : 'Start by creating a new inspection'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reg</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Site</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Inspected By</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Deviations</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Result</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const t = insp.inspectionType ?? 'General';
                        const cls = t === 'Forklift' ? 'bg-orange-100 text-orange-800'
                                  : t === 'Generator' ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800';
                        return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{t}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{insp.vehicleMakeModel}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{insp.registrationNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{insp.inspectionDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{insp.siteAllocation}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{insp.inspectedBy}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-gray-600">{insp.deviations?.length || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ResultBadge result={insp.result} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewInspection(insp)} className="text-indigo-500 hover:text-indigo-700" title="View Inspection">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => downloadInspection(insp)} className="text-blue-500 hover:text-blue-700" title="Download Inspection">
                          <Download className="h-4 w-4" />
                        </button>
                        {!isDriver && (
                          <button onClick={() => handleDeleteInspection(insp.id)} className="text-red-500 hover:text-red-700" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── T25: Inspection read-only view modal ── */}
      {viewInspection && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4 py-8">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10 rounded-t-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 truncate">
                      {viewInspection.vehicleMakeModel} — {viewInspection.registrationNumber}
                    </h2>
                    <p className="text-xs text-gray-500">{viewInspection.inspectionDate} · {viewInspection.inspectedBy}</p>
                  </div>
                  <ResultBadge result={viewInspection.result} />
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button onClick={() => downloadInspection(viewInspection)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50">
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button onClick={() => setViewInspection(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-6 space-y-8">

                {/* Vehicle Info */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    {([
                      ['Type', viewInspection.inspectionType],
                      ['Site', viewInspection.siteAllocation],
                      ['Make / Model', viewInspection.vehicleMakeModel],
                      ['Registration', viewInspection.registrationNumber],
                      ['Current Hours', viewInspection.currentHours],
                      ['Last Service Date', viewInspection.lastServiceDate],
                      ['Last Service Hours', viewInspection.lastServiceHours],
                      ['Next Service Date', viewInspection.nextServiceDate],
                      ['Next Service Hours', viewInspection.nextServiceHours],
                      ['Prev Load Test', viewInspection.previousLoadTestDate],
                      ['Next Load Test', viewInspection.nextLoadTestDate],
                      ['Serial Number', viewInspection.serialNumberText],
                      ['Total Maint. Cost', viewInspection.totalMaintenanceCost ? `R ${viewInspection.totalMaintenanceCost}` : ''],
                      ['Avg Monthly Cost', viewInspection.avgMonthlyMaintenanceCost ? `R ${viewInspection.avgMonthlyMaintenanceCost}` : ''],
                    ] as [string, string][]).filter(([, v]) => v).map(([label, val]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="font-medium text-gray-900">{val}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Vehicle Photos */}
                {(() => {
                  const photos = [
                    { label: 'Front', src: viewInspection.vehicleFrontPhoto },
                    { label: 'Left', src: viewInspection.vehicleLeftPhoto },
                    { label: 'Right', src: viewInspection.vehicleRightPhoto },
                    { label: 'Back', src: viewInspection.vehicleBackPhoto },
                    { label: 'Interior', src: viewInspection.interiorPhoto },
                    { label: 'Serial No.', src: viewInspection.serialNumberPhoto },
                    { label: 'Service Sticker', src: viewInspection.serviceSticker },
                  ].filter(p => p.src);
                  if (!photos.length) return null;
                  return (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Photos</h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {photos.map(p => (
                          <div key={p.label} className="text-center">
                            <img src={p.src} alt={p.label} className="w-full h-24 object-cover rounded-lg border" />
                            <p className="text-xs text-gray-500 mt-1">{p.label}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Weekly Use */}
                {viewInspection.weeklyUse?.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Weekly Use</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Week</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Hours</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Checklists Done</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Findings</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Communicated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewInspection.weeklyUse.map((w, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-1.5">{w.weekLabel || `Week ${i + 1}`}</td>
                              <td className="px-3 py-1.5">{w.operationalHours || '—'}</td>
                              <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${w.checklistsCompleted === 'Yes' ? 'bg-green-100 text-green-800' : w.checklistsCompleted === 'No' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>{w.checklistsCompleted || '—'}</span></td>
                              <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${w.findingsOnChecklists === 'No' ? 'bg-green-100 text-green-800' : w.findingsOnChecklists === 'Yes' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>{w.findingsOnChecklists || '—'}</span></td>
                              <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs ${w.findingsCommunicated === 'Yes' ? 'bg-green-100 text-green-800' : w.findingsCommunicated === 'No' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-500'}`}>{w.findingsCommunicated || '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Checklist Findings */}
                {viewInspection.checklistFindings?.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Checklist Findings</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Remedial Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewInspection.checklistFindings.map((f, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-1.5 whitespace-nowrap">{f.date || '—'}</td>
                              <td className="px-3 py-1.5">{f.description || '—'}</td>
                              <td className="px-3 py-1.5">{f.remedialAction || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Monthly Breakdowns */}
                {viewInspection.monthlyBreakdowns?.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Monthly Breakdowns</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Duration (hrs)</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Spare Parts</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Cost (R)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewInspection.monthlyBreakdowns.map((b, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-1.5">{b.description || '—'}</td>
                              <td className="px-3 py-1.5">{b.durationHrs || '—'}</td>
                              <td className="px-3 py-1.5">{b.spareParts || '—'}</td>
                              <td className="px-3 py-1.5 font-medium">{b.costToRepair ? `R ${parseFloat(b.costToRepair).toLocaleString('en-ZA')}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Equipment Checks */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Equipment Checks</h3>
                  {(() => {
                    const eq = viewInspection.equipment;
                    const yn = (v: string) => (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'Yes' ? 'bg-green-100 text-green-800' : v === 'No' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>{v || '—'}</span>
                    );
                    const cond = (v: string) => (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${v === 'Good' || v === 'Ok' ? 'bg-green-100 text-green-800' : v === 'Damaged' ? 'bg-yellow-100 text-yellow-800' : v === 'Not Working' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>{v || '—'}</span>
                    );
                    const row = (label: string, val: React.ReactNode) => (
                      <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-gray-600">{label}</span>
                        <span>{val}</span>
                      </div>
                    );
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Exterior / Safety</p>
                          {row('Windscreen', cond(eq.windscreenCondition))}
                          {row('Wipers', cond(eq.wipersCondition))}
                          {row('Headlights Working', yn(eq.headlightsBothWorking))}
                          {row('Headlights Free from Damage', yn(eq.headlightsFreeFromDamage))}
                          {row('Taillights Working', yn(eq.taillightsBothWorking))}
                          {row('Left Indicator', yn(eq.leftIndicatorWorking))}
                          {row('Right Indicator', yn(eq.rightIndicatorWorking))}
                          {row('Hazards', yn(eq.hazardsWorking))}
                          {row('Hooter', yn(eq.hooterWorking))}
                          {row('Fire Extinguisher', yn(eq.fireExtinguisher))}
                          {row('Stop Block', yn(eq.stopBlock))}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Engine / Mechanical</p>
                          {row('Engine Oil Level', yn(eq.engineOilLevel))}
                          {row('Oil Leaks', yn(eq.oilLeaks))}
                          {row('Coolant Level', yn(eq.coolantLevel))}
                          {row('Coolant Leaks', yn(eq.coolantLeaks))}
                          {row('Fan Belt', cond(eq.fanBelt))}
                          {row('Alternator Belt', cond(eq.alternatorBelt))}
                          {row('Water Hoses', cond(eq.waterHoses))}
                          {row('Suspension', yn(eq.suspension))}
                          {row('Brakes', yn(eq.brakes))}
                          {row('Clutch', yn(eq.clutch))}
                          {row('Air Conditioner', yn(eq.airConditioner))}
                          {row('Seatbelts', yn(eq.seatbelts))}
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Wheels</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(['leftFrontWheel', 'rightFrontWheel', 'leftRearWheel', 'rightRearWheel'] as const).map(w => {
                              const wheel = eq[w];
                              const label = { leftFrontWheel: 'Left Front', rightFrontWheel: 'Right Front', leftRearWheel: 'Left Rear', rightRearWheel: 'Right Rear' }[w];
                              return (
                                <div key={w} className="border border-gray-200 rounded-lg p-3">
                                  <p className="text-xs font-medium text-gray-700 mb-2">{label}</p>
                                  {wheel.photo && <img src={wheel.photo} alt={label} className="w-full h-16 object-cover rounded mb-2" />}
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-500">Tread</span>{cond(wheel.tyreThreadCondition)}</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Bubbles</span>{yn(wheel.bubblesOrDamage)}</div>
                                    <div className="flex justify-between"><span className="text-gray-500">Nuts OK</span>{yn(wheel.allWheelNutsInPlace)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* Custom Checklist */}
                {(() => {
                  const raw = viewInspection as any;
                  const tId = raw.templateId as string | undefined;
                  const tAnswers = raw.templateAnswers as Record<string, string> | undefined;
                  const tpl = tId ? templates.find(t => t.id === tId) : null;
                  if (!tpl || !tAnswers) return null;
                  return (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom Checklist — {tpl.name}</h3>
                      <div className="space-y-1">
                        {(tpl.questions as any[]).map((q: any, i: number) => (
                          <div key={q.id || i} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                            <p className="text-sm text-gray-800">{q.text}{q.required && <span className="text-red-500 ml-0.5">*</span>}</p>
                            <div className="ml-4 shrink-0">
                              {tAnswers[q.id] ? (
                                q.type === 'checkbox' ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${tAnswers[q.id] === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {tAnswers[q.id] === 'pass' ? 'Pass' : 'Fail'}
                                  </span>
                                ) : q.type === 'photo' ? (
                                  <img src={tAnswers[q.id]} alt={q.text} className="max-h-16 rounded border" />
                                ) : (
                                  <span className="text-sm text-gray-700">{tAnswers[q.id]}{q.unit ? ` ${q.unit}` : ''}</span>
                                )
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}

                {/* Deviations */}
                {viewInspection.deviations?.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deviations ({viewInspection.deviations.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500 w-8">#</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">Deviation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {viewInspection.deviations.map((d, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                              <td className="px-3 py-1.5 font-medium text-gray-800">{d.item || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-600">{d.deviation || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex justify-end rounded-b-xl">
                <button onClick={() => setViewInspection(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── T47/T48: Log breakdown costs modal ── */}
      {breakdownCostModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Log Breakdown Costs?</h3>
                <p className="text-xs text-gray-500 mt-0.5">The following breakdown costs can be saved as cost entries for {breakdownCostModal.vehicleReg}.</p>
              </div>
              <button onClick={() => { setBreakdownCostModal(null); setForm(defaultForm()); setTemplateId(''); setTemplateAnswers({}); setSelectedVehicleId(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-60 overflow-y-auto">
              {breakdownCostModal.breakdowns.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700 flex-1">{b.description || 'Breakdown'}</span>
                  <span className="font-semibold text-gray-900 ml-4">R {parseFloat(b.costToRepair).toLocaleString('en-ZA')}</span>
                </div>
              ))}
              <p className="text-sm font-bold text-gray-900 pt-1">
                Total: R {breakdownCostModal.breakdowns.reduce((s, b) => s + (parseFloat(b.costToRepair) || 0), 0).toLocaleString('en-ZA')}
              </p>
            </div>
            <div className="px-5 py-4 flex gap-3 justify-end border-t">
              <button
                onClick={() => { setBreakdownCostModal(null); setForm(defaultForm()); setTemplateId(''); setTemplateAnswers({}); setSelectedVehicleId(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Skip
              </button>
              <button
                disabled={savingCosts}
                onClick={async () => {
                  setSavingCosts(true);
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    for (const b of breakdownCostModal.breakdowns) {
                      await createCost({
                        vehicle_id: breakdownCostModal.vehicleId,
                        date: today,
                        category: 'Maintenance',
                        amount: parseFloat(b.costToRepair) || 0,
                        description: b.description || 'Breakdown repair',
                        supplier: null,
                        invoice_number: null,
                        receipt_url: null,
                        rto_number: null,
                        po_number: null,
                        quote_number: null,
                        km_reading: null,
                        created_by: null,
                      });
                    }
                    setBreakdownCostModal(null);
                    setForm(defaultForm());
                    setTemplateId('');
                    setTemplateAnswers({});
                    setSelectedVehicleId('');
                  } catch (e: any) {
                    alert('Failed to save costs: ' + e.message);
                  } finally {
                    setSavingCosts(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCosts ? 'Saving…' : 'Save as Cost Entries'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inspections;
