// ─── Shared Inspection Types ─────────────────────────────────────────────────

export type YesNo = 'Yes' | 'No' | '';
export type Condition = 'Good' | 'Damaged' | 'Not Working' | 'N/A' | '';

export interface WeekRow {
  id: string;
  weekLabel: string;
  operationalHours: string;
  checklistsCompleted: YesNo;
  findingsOnChecklists: YesNo;
  findingsCommunicated: YesNo;
}

export interface ChecklistFinding {
  id: string;
  date: string;
  description: string;
  remedialAction: string;
}

export interface Breakdown {
  id: string;
  description: string;
  durationHrs: string;
  spareParts: string;
  costToRepair: string;
}

export interface WheelCheck {
  tyreThreadCondition: Condition;
  bubblesOrDamage: YesNo;
  allWheelNutsInPlace: YesNo;
  photo: string;
}

export interface EquipmentChecks {
  windscreenCondition: Condition;
  windscreenPhoto: string;
  wipersCondition: Condition;
  leftFrontWheel: WheelCheck;
  rightFrontWheel: WheelCheck;
  leftRearWheel: WheelCheck;
  rightRearWheel: WheelCheck;
  headlightsBothWorking: YesNo;
  headlightsFreeFromDamage: YesNo;
  headlightsLensesClear: YesNo;
  taillightsBothWorking: YesNo;
  taillightsFreeFromDamage: YesNo;
  taillightsLensesClear: YesNo;
  leftIndicatorWorking: YesNo;
  rightIndicatorWorking: YesNo;
  hazardsWorking: YesNo;
  hooterWorking: YesNo;
  fireExtinguisher: YesNo;
  stopBlock: YesNo;
  engineOilLevel: YesNo;
  oilLeaks: YesNo;
  coolantLevel: YesNo;
  coolantLeaks: YesNo;
  hydraulicsOilPhoto: string;
  hydraulicsNote: string;
  fanBelt: Condition;
  alternatorBelt: Condition;
  waterHoses: Condition;
  radiatorLevel: Condition;
  engineOilLevelEngine: Condition;
  batteryWaterLevel: Condition;
  fuelLeaks: string;
  engineTemperature: Condition;
  suspension: YesNo;
  brakes: YesNo;
  clutch: YesNo;
  airConditioner: YesNo;
  rearViewMirrors: YesNo;
  seatbelts: YesNo;
}

export interface Deviation {
  id: string;
  item: string;
  deviation: string;
}

export interface GeneratorEquipmentChecks {
  engineOilLevelOk: YesNo;
  oilLeaks: YesNo;
  coolantLevelOk: YesNo;
  coolantLeaks: YesNo;
  fuelGaugePhoto: string;
  fuelLevel: string;
  fanBelt: string;
  alternatorBelt: string;
  waterHoses: string;
  radiatorLevel: string;
  engineOilLevelEngine: string;
  batteryWaterLevel: string;
  fuelLeaks: string;
  temperature: string;
}

export interface InspectionRecord {
  id: string;
  previousInspectionDate: string;
  inspectionDate: string;
  inspectedBy: string;
  siteAllocation: string;
  vehicleMakeModel: string;
  registrationNumber: string;
  currentHours: string;
  lastServiceHours: string;
  lastServiceDate: string;
  nextServiceHours: string;
  nextServiceDate: string;
  previousLoadTestDate: string;
  nextLoadTestDate: string;
  totalMaintenanceCost: string;
  avgMonthlyMaintenanceCost: string;
  vehicleFrontPhoto: string;
  vehicleLeftPhoto: string;
  vehicleRightPhoto: string;
  vehicleBackPhoto: string;
  interiorPhoto: string;
  serialNumberPhoto: string;
  serialNumberText: string;
  serviceSticker: string;
  serviceStickerDate: string;
  weeklyUse: WeekRow[];
  checklistFindings: ChecklistFinding[];
  monthlyBreakdowns: Breakdown[];
  equipment: EquipmentChecks;
  generatorEquipment: GeneratorEquipmentChecks;
  deviations: Deviation[];
  inspectionType: 'General' | 'Forklift' | 'Generator';
  result: 'pass' | 'fail' | 'requires_attention';
  // Custom checklist template
  templateId?: string;
  templateName?: string;
  templateAnswers?: Record<string, string>;
  templateQuestions?: Array<{ id: string; text: string; type: string; options?: string[] }>;
}

// ─── Print / PDF Function ─────────────────────────────────────────────────────

/** Opens a formatted print window for the given inspection record */
const generateInspectionDownload = async (insp: InspectionRecord) => {
  /* Read company settings from localStorage */
  let companyName    = 'Enprotec';
  let officeLabel    = 'South African Head Office';
  let companyAddress = '';
  let poBox          = '';
  let companyPhone   = '';
  let companyEmail   = '';
  let companyWebsite = '';
  let directors      = '';
  let companyReg     = '';
  let vatNumber      = '';
  try {
    const raw = localStorage.getItem('enprotec_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.companyName)    companyName    = s.companyName;
      if (s.officeLabel)    officeLabel    = s.officeLabel;
      if (s.companyAddress) companyAddress = s.companyAddress;
      if (s.poBox)          poBox          = s.poBox;
      if (s.companyPhone)   companyPhone   = s.companyPhone;
      if (s.companyEmail)   companyEmail   = s.companyEmail;
      if (s.companyWebsite) companyWebsite = s.companyWebsite;
      if (s.directors)      directors      = s.directors;
      if (s.companyReg)     companyReg     = s.companyReg;
      if (s.vatNumber)      vatNumber      = s.vatNumber;
    }
  } catch { /* ignore */ }

  /* Fetch Enprotec logo → base64 so it renders in the new window */
  let logoSrc = '';
  try {
    const resp = await fetch('/BR002-Full%20colour%20w%20slogan%20Landscape-2500px-Rev03%20(1).jpg');
    if (resp.ok) {
      const blob = await resp.blob();
      logoSrc = await new Promise<string>(res => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob);
      });
    }
  } catch { /* logo unavailable */ }

  /* ── helpers ── */
  const ph = (src: string, label: string) => src
    ? `<div class="photo-cell"><img src="${src}" class="photo-img" alt="${label}"/><p class="photo-label">${label}</p></div>`
    : `<div class="photo-cell no-photo-cell"><p class="photo-label">${label}</p><p class="photo-none">No photo</p></div>`;

  const chk = (label: string, val: string) => {
    const cls = (val === 'Yes' || val === 'Good' || val === 'Ok' || val === 'None')
      ? 'chk-pass' : (val === 'No' || val === 'Damaged' || val === 'Not Working') ? 'chk-fail' : 'chk-na';
    return `<tr><td>${label}</td><td class="${cls}">${val || '—'}</td></tr>`;
  };

  const typeLabel  = insp.inspectionType === 'Forklift' ? 'FORKLIFT' : insp.inspectionType === 'Generator' ? 'GENERATOR' : 'VEHICLE';
  const fullTitle  = `MONTHLY ${typeLabel} INSPECTION REPORT`;
  const entityWord = insp.inspectionType === 'Generator' ? 'Generator' : 'Vehicle';
  const isGen      = insp.inspectionType === 'Generator';
  const logoHtml   = logoSrc ? `<img src="${logoSrc}" class="logo-img" alt="${companyName}"/>` : `<div class="logo-text">${companyName.toUpperCase()}</div>`;
  const resultClass = insp.result === 'pass' ? 'result-pass' : insp.result === 'fail' ? 'result-fail' : 'result-attention';
  const resultLabel = insp.result === 'requires_attention' ? 'REQUIRES ATTENTION' : insp.result.toUpperCase();

  /* ── row builders ── */
  const weeklyRows = (insp.weeklyUse ?? []).map(w =>
    `<tr><td>${w.weekLabel||'—'}</td><td>${w.operationalHours||'—'}</td>${!isGen ? `<td>${w.checklistsCompleted||'—'}</td><td>${w.findingsOnChecklists||'—'}</td><td>${w.findingsCommunicated||'—'}</td>` : ''}</tr>`
  ).join('') || `<tr><td colspan="${isGen?2:5}" class="empty-row">No weekly data</td></tr>`;

  const findingRows = (insp.checklistFindings ?? []).map((f, i) =>
    `<tr><td>${i+1}</td><td>${f.date||'—'}</td><td>${f.description||'—'}</td><td>${f.remedialAction||'—'}</td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty-row">No findings recorded</td></tr>';

  const breakdownRows = (insp.monthlyBreakdowns ?? []).map((b, i) =>
    `<tr><td>${i+1}</td><td>${b.description||'—'}</td><td>${b.durationHrs||'—'}</td><td>${b.spareParts||'—'}</td><td>${b.costToRepair||'—'}</td></tr>`
  ).join('') || '<tr><td colspan="5" class="empty-row">No breakdowns recorded</td></tr>';

  const devRows = (insp.deviations ?? []).map((d, i) =>
    `<tr><td>${i+1}</td><td>${d.item}</td><td>${d.deviation}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty-row">No deviations recorded</td></tr>';

  const templateQuestions = insp.templateQuestions ?? [];
  const templateAnswers   = insp.templateAnswers   ?? {};
  const customChecklistHtml = templateQuestions.length > 0 ? `
  <div class="section">
    <div class="section-title">Custom Checklist — ${insp.templateName || 'Template'}</div>
    <table>
      <thead><tr><th style="width:60%">Question</th><th>Answer</th></tr></thead>
      <tbody>
        ${templateQuestions.map(q => {
          const ans = templateAnswers[q.id] ?? '—';
          const cls = (ans === 'Yes' || ans === 'Pass' || ans === 'OK') ? 'chk-pass'
                    : (ans === 'No'  || ans === 'Fail')                 ? 'chk-fail' : '';
          return `<tr><td>${q.text}</td><td class="${cls}">${ans}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : '';

  /* ── equipment checks HTML ── */
  const e = insp.equipment;
  const g = insp.generatorEquipment;

  const wheelHtml = (label: string, w: typeof e.leftFrontWheel) => `
    <div class="wheel-card">
      <div class="wheel-title">${label}</div>
      ${ph(w.photo, label + ' photo')}
      <table style="margin-top:6px">
        ${chk('Tyre Thread', w.tyreThreadCondition)}
        ${chk('Bubbles / Damage', w.bubblesOrDamage)}
        ${chk('All Nuts In Place', w.allWheelNutsInPlace)}
      </table>
    </div>`;

  const equipChecksHtml = isGen ? `
    <h2>6. Generator Equipment Checks</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <h3 class="sub-h">Fluids</h3>
        <table>
          ${chk('Engine Oil Level OK', g.engineOilLevelOk)}
          ${chk('Oil Leaks', g.oilLeaks)}
          ${chk('Coolant Level OK', g.coolantLevelOk)}
          ${chk('Coolant Leaks', g.coolantLeaks)}
        </table>
        <h3 class="sub-h">Engine</h3>
        <table>
          ${chk('Fan Belt', g.fanBelt)}
          ${chk('Alternator Belt', g.alternatorBelt)}
          ${chk('Water Hoses', g.waterHoses)}
          ${chk('Radiator Level', g.radiatorLevel)}
          ${chk('Engine Oil Level', g.engineOilLevelEngine)}
          ${chk('Battery Water Level', g.batteryWaterLevel)}
          ${chk('Fuel Leaks', g.fuelLeaks)}
          ${chk('Temperature', g.temperature)}
        </table>
      </div>
      <div>
        <h3 class="sub-h">Fuel Gauge</h3>
        <p style="font-size:10px;color:#555;margin-bottom:4px">Level: <strong>${g.fuelLevel || '—'}</strong></p>
        ${g.fuelGaugePhoto ? `<img src="${g.fuelGaugePhoto}" style="max-width:100%;max-height:180px;object-fit:contain;border:1px solid #e5e7eb;border-radius:4px"/>` : '<div class="no-photo-cell" style="height:120px">No fuel gauge photo</div>'}
      </div>
    </div>
  ` : `
    <h2>6. Equipment Checks</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <h3 class="sub-h">Windscreen &amp; Wipers</h3>
        <table>
          ${chk('Windscreen Condition', e.windscreenCondition)}
          ${chk('Wipers Condition', e.wipersCondition)}
        </table>
        ${e.windscreenPhoto ? `<img src="${e.windscreenPhoto}" style="max-width:100%;max-height:120px;object-fit:contain;margin-top:6px;border:1px solid #e5e7eb;border-radius:4px"/>` : ''}

        <h3 class="sub-h" style="margin-top:10px">Lights &amp; Signals</h3>
        <table>
          ${chk('Headlights Working', e.headlightsBothWorking)}
          ${chk('Headlights Damage-Free', e.headlightsFreeFromDamage)}
          ${chk('Headlight Lenses Clear', e.headlightsLensesClear)}
          ${chk('Taillights Working', e.taillightsBothWorking)}
          ${chk('Taillights Damage-Free', e.taillightsFreeFromDamage)}
          ${chk('Taillight Lenses Clear', e.taillightsLensesClear)}
          ${chk('Left Indicator', e.leftIndicatorWorking)}
          ${chk('Right Indicator', e.rightIndicatorWorking)}
          ${chk('Hazards', e.hazardsWorking)}
          ${chk('Hooter', e.hooterWorking)}
        </table>

        <h3 class="sub-h" style="margin-top:10px">Emergency Kit</h3>
        <table>
          ${chk('Fire Extinguisher', e.fireExtinguisher)}
          ${chk('Stop Block', e.stopBlock)}
        </table>

        <h3 class="sub-h" style="margin-top:10px">General</h3>
        <table>
          ${chk('Suspension', e.suspension)}
          ${chk('Brakes', e.brakes)}
          ${chk('Clutch', e.clutch)}
          ${chk('Air Conditioner', e.airConditioner)}
          ${chk('Rear View Mirrors', e.rearViewMirrors)}
          ${chk('Seatbelts', e.seatbelts)}
        </table>
      </div>
      <div>
        <h3 class="sub-h">Fluids</h3>
        <table>
          ${chk('Engine Oil Level', e.engineOilLevel)}
          ${chk('Oil Leaks', e.oilLeaks)}
          ${chk('Coolant Level', e.coolantLevel)}
          ${chk('Coolant Leaks', e.coolantLeaks)}
        </table>
        <p style="font-size:10px;margin-top:6px;color:#555">Hydraulics Note: ${e.hydraulicsNote || '—'}</p>
        ${e.hydraulicsOilPhoto ? `<img src="${e.hydraulicsOilPhoto}" style="max-width:100%;max-height:120px;object-fit:contain;margin-top:6px;border:1px solid #e5e7eb;border-radius:4px"/>` : ''}

        <h3 class="sub-h" style="margin-top:10px">Engine</h3>
        <table>
          ${chk('Fan Belt', e.fanBelt)}
          ${chk('Alternator Belt', e.alternatorBelt)}
          ${chk('Water Hoses', e.waterHoses)}
          ${chk('Radiator Level', e.radiatorLevel)}
          ${chk('Engine Oil Level', e.engineOilLevelEngine)}
          ${chk('Battery Water Level', e.batteryWaterLevel)}
          ${chk('Fuel Leaks', e.fuelLeaks)}
          ${chk('Engine Temperature', e.engineTemperature)}
        </table>
      </div>
    </div>

    <h3 class="sub-h">Wheels</h3>
    <div class="wheel-grid">
      ${wheelHtml('Left Front', e.leftFrontWheel)}
      ${wheelHtml('Right Front', e.rightFrontWheel)}
      ${wheelHtml('Left Rear', e.leftRearWheel)}
      ${wheelHtml('Right Rear', e.rightRearWheel)}
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${fullTitle}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;background:#fff}

  /* cover */
  .cover-header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding:16px 24px}
  .logo-img{max-width:200px;max-height:70px;object-fit:contain}
  .logo-text{font-size:26px;font-weight:900;color:#1d4ed8;letter-spacing:2px}
  .addr-block{text-align:right;font-size:9px;color:#374151;line-height:1.6}
  .addr-block .office-label{font-weight:700;font-size:10px;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px}
  .title-banner{background:#1d4ed8;color:#fff;padding:10px 24px;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px}
  .cover-vehicle-photo{width:100%;max-height:260px;object-fit:cover;display:block}
  .no-photo-cover{width:100%;height:180px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;text-align:center;padding:16px}

  /* result banner */
  .result-banner{padding:8px 24px;display:flex;align-items:center;gap:12px;font-size:12px;font-weight:700}
  .result-pass{background:#d1fae5;color:#065f46}
  .result-fail{background:#fee2e2;color:#991b1b}
  .result-attention{background:#fef3c7;color:#92400e}
  .result-banner .badge{display:inline-block;padding:3px 14px;border-radius:20px;font-size:12px;font-weight:800;border:2px solid currentColor}

  /* content */
  .content{padding:16px 24px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #d1d5db;border-radius:4px;margin-bottom:16px;overflow:hidden}
  .info-grid .lbl{background:#f9fafb;font-weight:700;padding:5px 10px;border-bottom:1px solid #e5e7eb;border-right:1px solid #e5e7eb}
  .info-grid .val{padding:5px 10px;border-bottom:1px solid #e5e7eb}
  h2{background:#1d4ed8;color:#fff;padding:6px 12px;font-size:12px;font-weight:700;margin:18px 0 8px;border-radius:3px;text-transform:uppercase}
  .sub-h{font-size:11px;font-weight:700;color:#374151;background:#f3f4f6;padding:4px 8px;border-left:3px solid #1d4ed8;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10.5px}
  th,td{border:1px solid #d1d5db;padding:5px 8px;text-align:left}
  th{background:#f3f4f6;font-weight:700;font-size:10px;text-transform:uppercase}
  .empty-row{text-align:center;color:#9ca3af;font-style:italic}

  /* check colours */
  .chk-pass{color:#065f46;background:#d1fae5;font-weight:600}
  .chk-fail{color:#991b1b;background:#fee2e2;font-weight:600}
  .chk-na{color:#6b7280}

  /* photos */
  .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
  .photo-cell{border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;text-align:center}
  .photo-img{width:100%;height:140px;object-fit:cover;display:block}
  .photo-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;padding:4px;background:#f9fafb}
  .photo-none{font-size:9px;color:#9ca3af;padding:8px 0}
  .no-photo-cell{background:#f9fafb;height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center}

  /* wheels */
  .wheel-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .wheel-card{border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;padding:6px}
  .wheel-title{font-size:10px;font-weight:700;color:#1d4ed8;margin-bottom:4px;text-align:center}
  .wheel-card .photo-img{height:100px}
  .wheel-card .photo-cell{margin-bottom:4px}

  .footer{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:9px;color:#9ca3af;text-align:center}
  .no-print{display:block}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cover-header{page-break-inside:avoid}.no-print{display:none!important}}
</style>
</head><body>
<div class="no-print" style="position:fixed;top:12px;right:12px;z-index:999">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.18)">Save as PDF</button>
</div>

<!-- Cover letterhead -->
<div class="cover-header">
  ${logoHtml}
  <div class="addr-block">
    <div class="office-label">${officeLabel}</div>
    ${companyAddress ? `<div>${companyAddress}</div>` : ''}
    ${poBox          ? `<div>${poBox}</div>`          : ''}
    <div>${[companyEmail, companyWebsite].filter(Boolean).join(' &nbsp;|&nbsp; ') || 'enquiries@enprotec.com &nbsp;|&nbsp; enprotec.com'}</div>
  </div>
</div>

<!-- Title banner -->
<div class="title-banner">${fullTitle}</div>

<!-- Vehicle cover photo -->
${insp.vehicleFrontPhoto
  ? `<img src="${insp.vehicleFrontPhoto}" class="cover-vehicle-photo" alt="${entityWord} front"/>`
  : `<div class="no-photo-cover">${entityWord} front photo not captured</div>`}

<!-- Result Banner -->
<div class="result-banner ${resultClass}">
  <span>Inspection Result:</span>
  <span class="badge">${resultLabel}</span>
  <span style="margin-left:auto;font-weight:400">Inspected by: ${insp.inspectedBy||'—'}</span>
</div>

<div class="content">

  <!-- 1. Header Info -->
  <div class="info-grid">
    <div class="lbl">Previous Inspection Date</div><div class="val">${insp.previousInspectionDate||'—'}</div>
    <div class="lbl">Inspection Date</div><div class="val">${insp.inspectionDate||'—'}</div>
    <div class="lbl">Inspected By</div><div class="val">${insp.inspectedBy||'—'}</div>
    <div class="lbl">Site Allocation</div><div class="val">${insp.siteAllocation||'—'}</div>
    <div class="lbl">${entityWord} Make &amp; Model</div><div class="val">${insp.vehicleMakeModel||'—'}</div>
    <div class="lbl">Registration / Serial</div><div class="val">${insp.registrationNumber||'—'}</div>
    <div class="lbl">Current Hours / ODO</div><div class="val">${insp.currentHours||'—'}</div>
    <div class="lbl">Last Service (Hours)</div><div class="val">${insp.lastServiceHours||'—'}</div>
    <div class="lbl">Last Service (Date)</div><div class="val">${insp.lastServiceDate||'—'}</div>
    <div class="lbl">Next Service (Hours)</div><div class="val">${insp.nextServiceHours||'—'}</div>
    <div class="lbl">Next Service (Date)</div><div class="val">${insp.nextServiceDate||'—'}</div>
    <div class="lbl">Total Maintenance Cost</div><div class="val">R ${insp.totalMaintenanceCost||'0'}</div>
    <div class="lbl">Avg Monthly Maint. Cost</div><div class="val">R ${insp.avgMonthlyMaintenanceCost||'0'}</div>
    <div class="lbl">Serial Number</div><div class="val">${insp.serialNumberText||'—'}</div>
    <div class="lbl">Service Sticker</div><div class="val">${insp.serviceSticker||'—'} ${insp.serviceStickerDate ? '· '+insp.serviceStickerDate : ''}</div>
  </div>

  <!-- 2. Visual Photos -->
  <h2>2. Visual Inspection Photos</h2>
  <div class="photo-grid">
    ${ph(insp.vehicleFrontPhoto,  entityWord+' Front')}
    ${ph(insp.vehicleLeftPhoto,   entityWord+' Left')}
    ${ph(insp.vehicleRightPhoto,  entityWord+' Right')}
    ${ph(insp.vehicleBackPhoto,   entityWord+' Back')}
    ${ph(insp.interiorPhoto,      'Interior')}
    ${ph(insp.serialNumberPhoto,  'Serial Number Plate')}
  </div>

  <!-- 3. Weekly Use -->
  <h2>3. Weekly Use</h2>
  <table>
    <thead><tr><th>Week</th><th>Operational Hours</th>${!isGen ? '<th>Checklists Done?</th><th>Findings?</th><th>Findings Addressed?</th>' : ''}</tr></thead>
    <tbody>${weeklyRows}</tbody>
  </table>

  <!-- 4. Checklist Findings -->
  <h2>4. Checklist Findings</h2>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Remedial Action</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>

  <!-- 5. Monthly Breakdowns -->
  <h2>5. Monthly Breakdowns</h2>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Duration (Hrs)</th><th>Spare Parts</th><th>Cost (ZAR)</th></tr></thead>
    <tbody>${breakdownRows}</tbody>
  </table>

  <!-- 6. Equipment Checks -->
  ${equipChecksHtml}

  <!-- 7. Deviations -->
  <h2>7. Deviations / Defects</h2>
  <table>
    <thead><tr><th>No</th><th>Item</th><th>Deviation / Finding</th></tr></thead>
    <tbody>${devRows}</tbody>
  </table>

  <!-- 8. Custom Checklist (if template was used) -->
  ${customChecklistHtml}

  <div class="footer">
    ${directors ? `<div style="font-weight:600;color:#374151">DIRECTORS: ${directors}</div>` : ''}
    ${(companyReg || vatNumber) ? `<div>${[companyReg ? `Company Reg: ${companyReg}` : '', vatNumber ? `VAT no: ${vatNumber}` : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>` : ''}
    <div style="margin-top:4px">${[companyEmail, companyWebsite].filter(Boolean).join(' &nbsp;|&nbsp; ') || 'enquiries@enprotec.com &nbsp;|&nbsp; enprotec.com'} &nbsp;|&nbsp; ${new Date().toLocaleString('en-ZA')}</div>
  </div>
</div>

</body></html>`;

  /* Open in a new tab so the user can click "Save as PDF" via the browser print dialog */
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    /* Popup blocked — fall back to HTML download */
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inspection-${(insp.registrationNumber || 'report').replace(/[^a-z0-9]/gi, '-')}-${insp.inspectionDate || 'report'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  /* Revoke after 60 s — enough time for the tab to fully load */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadInspection = generateInspectionDownload;
