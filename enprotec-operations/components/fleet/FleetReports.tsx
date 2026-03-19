import * as React from 'react';
import { Download, Filter, Printer, FileText } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { getInspections } from '../../supabase/services/inspections.service';
import { getVehicles } from '../../supabase/services/vehicles.service';
import { getMonthlyCostTotals, getCosts } from '../../supabase/services/costs.service';
import { getComplianceSchedule } from '../../supabase/services/compliance.service';
import type { InspectionRow, VehicleRow, CostRow } from '../../supabase/database.types';
import type { ComplianceRow } from '../../supabase/database.types';

/* ─── Constants ──────────────────────────────────────────────── */
const DATE_RANGE_MONTHS: Record<string, number> = {
  month: 1, quarter: 3, half: 6, year: 12,
};

const DATE_RANGE_LABELS: Record<string, string> = {
  month: 'Last 30 days', quarter: 'Last 90 days',
  half: 'Last 6 months', year: 'Last 12 months',
};

const fmtR = (n: number) => `R ${n.toLocaleString('en-ZA')}`;

const COMPLIANCE_COLORS: Record<string, string> = {
  Completed: '#10b981',
  Scheduled: '#3b82f6',
  'Due Soon': '#f59e0b',
  Overdue: '#ef4444',
};

/* ─── Helpers ────────────────────────────────────────────────── */
function filterByDateRange(items: InspectionRow[], months: number): InspectionRow[] {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return items.filter(i => new Date(i.started_at) >= since);
}

function groupByMonth(inspections: InspectionRow[]) {
  const buckets: Record<string, { completed: number; failed: number; general: number; forklift: number; generator: number }> = {};
  inspections.forEach(i => {
    const key = i.started_at.slice(0, 7);
    if (!buckets[key]) buckets[key] = { completed: 0, failed: 0, general: 0, forklift: 0, generator: 0 };
    const passed = i.status === 'pass' || i.status === 'requires_attention';
    if (passed) buckets[key].completed++;
    else if (i.status === 'fail') buckets[key].failed++;
    const t = (i.inspection_type ?? '').toLowerCase();
    if (t === 'forklift' || t === 'forklift inspection') buckets[key].forklift++;
    else if (t === 'generator') buckets[key].generator++;
    else buckets[key].general++; // 'General', 'Monthly Inspection', or anything else
  });
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month: new Date(key + '-01').toLocaleString('en-ZA', { month: 'short' }),
      ...v,
    }));
}

function groupByVehicle(inspections: InspectionRow[]) {
  const buckets: Record<string, number> = {};
  inspections.forEach(i => {
    const reg = i.vehicle?.registration ?? i.vehicle_id;
    buckets[reg] = (buckets[reg] ?? 0) + 1;
  });
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([vehicle, count]) => ({ vehicle, count }));
}

function groupCostsByVehicle(costs: CostRow[], months: number) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const filtered = costs.filter(c => new Date(c.date) >= since);
  const map: Record<string, { vehicle: string; fuel: number; maintenance: number; other: number; total: number }> = {};
  filtered.forEach(c => {
    const v = c.vehicle?.registration ?? c.vehicle_id ?? 'Unknown';
    if (!map[v]) map[v] = { vehicle: v, fuel: 0, maintenance: 0, other: 0, total: 0 };
    if (c.category === 'Fuel') map[v].fuel += c.amount;
    else if (c.category === 'Maintenance') map[v].maintenance += c.amount;
    else map[v].other += c.amount;
    map[v].total += c.amount;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function compliancePieData(rows: ComplianceRow[]) {
  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
  return Object.entries(counts).map(([name, value]) => ({
    name, value, color: COMPLIANCE_COLORS[name] ?? '#94a3b8',
  }));
}

function groupDeviations(inspections: InspectionRow[]) {
  const counts: Record<string, { item: string; count: number; vehicles: Set<string> }> = {};
  inspections.forEach(insp => {
    const devs: { item?: string; deviation?: string }[] = (insp.answers as any)?.deviations ?? [];
    devs.forEach(d => {
      const key = d.item?.trim() || 'Unknown';
      if (!counts[key]) counts[key] = { item: key, count: 0, vehicles: new Set() };
      counts[key].count++;
      if (insp.vehicle?.registration) counts[key].vehicles.add(insp.vehicle.registration);
    });
  });
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map(r => ({ item: r.item, count: r.count, vehicles: r.vehicles.size }));
}

/* ─── TSV helpers — tab-separated so Excel opens correctly in all locales ── */
/** Strip tabs/newlines from a cell value so they don't break columns */
const tsvCell = (v: string | number | null | undefined): string =>
  String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

const T = '\t'; // column separator

/* ─── Export ─────────────────────────────────────────────────── */
function exportCSV(
  reportType: string,
  dateRange: string,
  filteredInsp: InspectionRow[],
  allCosts: CostRow[],
  compliance: ComplianceRow[],
  vehicles: VehicleRow[],
) {
  const months = DATE_RANGE_MONTHS[dateRange] ?? 3;
  const since = new Date(); since.setMonth(since.getMonth() - months);
  const filteredCosts = allCosts.filter(c => new Date(c.date) >= since);

  let header = '';
  let rows: string[] = [];

  if (reportType === 'inspections') {
    header = ['Date','Vehicle Reg','Make & Model','Inspection Type','Site','Inspected By','Result','Deviations','Breakdowns','Current Hours'].join(T);
    rows = filteredInsp.map(i => {
      const ans = i.answers as any;
      const veh = vehicles.find(v => v.id === i.vehicle_id);
      return [
        tsvCell(i.started_at.slice(0, 10)),
        tsvCell(i.vehicle?.registration ?? i.vehicle_id),
        tsvCell(veh ? `${veh.make} ${veh.model}` : ''),
        tsvCell(i.inspection_type),
        tsvCell(ans?.siteAllocation),
        tsvCell(i.inspector?.name),
        tsvCell(i.status === 'requires_attention' ? 'Requires Attention' : i.status),
        ans?.deviations?.length ?? 0,
        ans?.monthlyBreakdowns?.length ?? 0,
        tsvCell(ans?.currentHours),
      ].join(T);
    });

  } else if (reportType === 'costs') {
    header = ['Date','Vehicle Reg','Category','Amount (R)','Description','Supplier','Invoice #','PO #','Quote #','RTO #','KM Reading'].join(T);
    rows = filteredCosts.map(c => [
      tsvCell(c.date),
      tsvCell(c.vehicle?.registration ?? c.vehicle_id),
      tsvCell(c.category),
      c.amount.toFixed(2),
      tsvCell(c.description),
      tsvCell(c.supplier),
      tsvCell(c.invoice_number),
      tsvCell(c.po_number),
      tsvCell(c.quote_number),
      tsvCell(c.rto_number),
      tsvCell(c.km_reading),
    ].join(T));

  } else if (reportType === 'compliance') {
    header = ['Inspection Type','Vehicle Reg','Due Date','Scheduled Date','Completed Date','Status','Assigned To','Notes'].join(T);
    rows = compliance.map(c => [
      tsvCell(c.inspection_type),
      tsvCell(c.vehicle?.registration ?? c.vehicle_id),
      tsvCell(c.due_date),
      tsvCell(c.scheduled_date),
      tsvCell(c.completed_date),
      tsvCell(c.status),
      tsvCell(c.assignee?.name ?? c.assigned_to),
      tsvCell(c.notes),
    ].join(T));

  } else if (reportType === 'utilization') {
    header = ['Vehicle Reg','Make & Model','Site','Driver','Total Inspections','Pass','Requires Attention','Fail','Pass Rate %','Last Inspection'].join(T);
    const map: Record<string, { reg: string; makeModel: string; site: string; driver: string; total: number; pass: number; attn: number; fail: number; last: string }> = {};
    filteredInsp.forEach(i => {
      const reg = i.vehicle?.registration ?? i.vehicle_id;
      const veh = vehicles.find(v => v.id === i.vehicle_id);
      if (!map[reg]) map[reg] = { reg, makeModel: veh ? `${veh.make} ${veh.model}` : '', site: veh?.site?.name ?? '', driver: veh?.driver?.name ?? '', total: 0, pass: 0, attn: 0, fail: 0, last: '' };
      map[reg].total++;
      if (i.status === 'pass') map[reg].pass++;
      else if (i.status === 'requires_attention') map[reg].attn++;
      else map[reg].fail++;
      if (i.started_at > map[reg].last) map[reg].last = i.started_at.slice(0, 10);
    });
    rows = Object.values(map).sort((a, b) => b.total - a.total).map(r => {
      const rate = r.total > 0 ? ((r.pass + r.attn) / r.total * 100).toFixed(1) : '0';
      return [tsvCell(r.reg), tsvCell(r.makeModel), tsvCell(r.site), tsvCell(r.driver), r.total, r.pass, r.attn, r.fail, rate, tsvCell(r.last)].join(T);
    });

  } else if (reportType === 'deviations') {
    header = ['Inspection Date','Vehicle Reg','Make & Model','Inspection Type','Site','Deviation Item','Deviation Description'].join(T);
    filteredInsp.forEach(i => {
      const devs: { item?: string; deviation?: string }[] = (i.answers as any)?.deviations ?? [];
      const veh = vehicles.find(v => v.id === i.vehicle_id);
      devs.forEach(d => {
        rows.push([
          tsvCell(i.started_at.slice(0, 10)),
          tsvCell(i.vehicle?.registration ?? i.vehicle_id),
          tsvCell(veh ? `${veh.make} ${veh.model}` : ''),
          tsvCell(i.inspection_type),
          tsvCell((i.answers as any)?.siteAllocation),
          tsvCell(d.item),
          tsvCell(d.deviation),
        ].join(T));
      });
    });

  } else if (reportType === 'pervehicle') {
    header = ['Vehicle Reg','Make & Model','Site','Fuel (R)','Maintenance (R)','Other (R)','Total (R)'].join(T);
    const map: Record<string, { reg: string; makeModel: string; site: string; fuel: number; maint: number; other: number }> = {};
    filteredCosts.forEach(c => {
      const reg = c.vehicle?.registration ?? c.vehicle_id;
      const veh = vehicles.find(v => v.id === c.vehicle_id);
      if (!map[reg]) map[reg] = { reg, makeModel: veh ? `${veh.make} ${veh.model}` : '', site: veh?.site?.name ?? '', fuel: 0, maint: 0, other: 0 };
      if (c.category === 'Fuel') map[reg].fuel += c.amount;
      else if (c.category === 'Maintenance') map[reg].maint += c.amount;
      else map[reg].other += c.amount;
    });
    rows = Object.values(map).sort((a, b) => (b.fuel + b.maint + b.other) - (a.fuel + a.maint + a.other)).map(r => [
      tsvCell(r.reg), tsvCell(r.makeModel), tsvCell(r.site),
      r.fuel.toFixed(2), r.maint.toFixed(2), r.other.toFixed(2),
      (r.fuel + r.maint + r.other).toFixed(2),
    ].join(T));

  } else {
    // summary
    const total = filteredInsp.length;
    const passed = filteredInsp.filter(i => i.status === 'pass').length;
    const attn   = filteredInsp.filter(i => i.status === 'requires_attention').length;
    const failed = filteredInsp.filter(i => i.status === 'fail').length;
    const totalCost = filteredCosts.reduce((s, c) => s + c.amount, 0);
    header = ['Category','Metric','Value'].join(T);
    rows = [
      ['Fleet','Total Vehicles',vehicles.length].join(T),
      ['Fleet','Active',vehicles.filter(v => v.status === 'Active').length].join(T),
      ['Fleet','In Maintenance',vehicles.filter(v => v.status === 'In Maintenance').length].join(T),
      ['Fleet','Inactive / Decommissioned',vehicles.filter(v => v.status === 'Inactive' || v.status === 'Decommissioned').length].join(T),
      ['Inspections','Period',DATE_RANGE_LABELS[dateRange]].join(T),
      ['Inspections','Total',total].join(T),
      ['Inspections','Pass',passed].join(T),
      ['Inspections','Requires Attention',attn].join(T),
      ['Inspections','Fail',failed].join(T),
      ['Inspections','Pass Rate',(total > 0 ? ((passed + attn) / total * 100).toFixed(1) : 0) + '%'].join(T),
      ['Costs','Total (R)',totalCost.toFixed(2)].join(T),
      ['Costs','Fuel (R)',filteredCosts.filter(c => c.category === 'Fuel').reduce((s,c) => s+c.amount,0).toFixed(2)].join(T),
      ['Costs','Maintenance (R)',filteredCosts.filter(c => c.category === 'Maintenance').reduce((s,c) => s+c.amount,0).toFixed(2)].join(T),
      ['Costs','Other (R)',filteredCosts.filter(c => c.category !== 'Fuel' && c.category !== 'Maintenance').reduce((s,c) => s+c.amount,0).toFixed(2)].join(T),
      ['Compliance','Total Items',compliance.length].join(T),
      ['Compliance','Overdue',compliance.filter(c => c.status === 'Overdue').length].join(T),
      ['Compliance','Due Soon',compliance.filter(c => c.status === 'Due Soon').length].join(T),
      ['Compliance','Scheduled',compliance.filter(c => c.status === 'Scheduled').length].join(T),
      ['Compliance','Completed',compliance.filter(c => c.status === 'Completed').length].join(T),
    ];
  }

  const tsv  = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `enprotec-${reportType}-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Component ──────────────────────────────────────────────── */
const FleetReports: React.FC = () => {
  const [dateRange, setDateRange]   = React.useState('quarter');
  const [reportType, setReportType] = React.useState('summary');
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState<string | null>(null);

  const [allInspections, setAllInspections] = React.useState<InspectionRow[]>([]);
  const [vehicles, setVehicles]             = React.useState<VehicleRow[]>([]);
  const [monthlyCosts, setMonthlyCosts]     = React.useState<{ month: string; total: number; fuel: number; maintenance: number; other: number }[]>([]);
  const [compliance, setCompliance]         = React.useState<ComplianceRow[]>([]);
  const [allCosts, setAllCosts]             = React.useState<CostRow[]>([]);

  /* load on mount and when dateRange changes */
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const months = DATE_RANGE_MONTHS[dateRange] ?? 3;

    Promise.all([
      getInspections(500),
      getVehicles(),
      getMonthlyCostTotals(months),
      getComplianceSchedule(),
      getCosts(1000),
    ])
      .then(([insp, veh, costs, comp, rawCosts]) => {
        if (cancelled) return;
        setAllInspections(insp);
        setVehicles(veh);
        setMonthlyCosts(costs);
        setCompliance(comp);
        setAllCosts(rawCosts);
      })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Failed to load data'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [dateRange]);

  /* derived data */
  const months            = DATE_RANGE_MONTHS[dateRange] ?? 3;
  const filteredInsp      = filterByDateRange(allInspections, months);
  const monthlyInspections = groupByMonth(filteredInsp);
  const vehicleUtilisation = groupByVehicle(filteredInsp);
  const complianceData    = compliancePieData(compliance);

  const totalInspections  = filteredInsp.length;
  const totalFailed       = filteredInsp.filter(i => i.status === 'fail').length;
  const passRate          = totalInspections > 0
    ? ((totalInspections - totalFailed) / totalInspections * 100).toFixed(1)
    : '0';
  const totalCost         = monthlyCosts.reduce((s, r) => s + r.total, 0);
  const totalFuel         = monthlyCosts.reduce((s, r) => s + r.fuel, 0);
  const totalMaintenance  = monthlyCosts.reduce((s, r) => s + r.maintenance, 0);
  const compliantCount    = compliance.filter(c => c.status === 'Completed' || c.status === 'Scheduled').length;
  const complianceScore   = compliance.length > 0
    ? Math.round(compliantCount / compliance.length * 100)
    : 0;
  const overdueCompliance = compliance.filter(c => c.status === 'Overdue').length;
  const activeVehicles    = vehicles.filter(v => v.status === 'Active').length;
  const inMaintenance     = vehicles.filter(v => v.status === 'In Maintenance').length;

  const typeOf = (t: string) => { const l = t.toLowerCase(); return l.includes('forklift') ? 'forklift' : l === 'generator' ? 'generator' : 'general'; };
  const generalCount   = filteredInsp.filter(i => typeOf(i.inspection_type ?? '') === 'general').length;
  const forkliftCount  = filteredInsp.filter(i => typeOf(i.inspection_type ?? '') === 'forklift').length;
  const generatorCount = filteredInsp.filter(i => typeOf(i.inspection_type ?? '') === 'generator').length;

  const rangeLabel      = DATE_RANGE_LABELS[dateRange];
  const vehicleCosts    = groupCostsByVehicle(allCosts, months);
  const deviationSummary = groupDeviations(filteredInsp);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600" />
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
      Failed to load reports: {error}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-900">Fleet Reports</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 border border-zinc-300 text-zinc-700 px-4 py-2 rounded-lg hover:bg-zinc-50 text-sm font-medium">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            onClick={() => exportCSV(reportType, dateRange, filteredInsp, allCosts, compliance, vehicles)}
            className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 text-sm font-medium">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500">
              <option value="summary">Fleet Summary</option>
              <option value="inspections">Inspections Report</option>
              <option value="costs">Cost Analysis</option>
              <option value="compliance">Compliance Status</option>
              <option value="utilization">Vehicle Utilisation</option>
              <option value="pervehicle">Cost Per Vehicle</option>
              <option value="deviations">Deviation Summary</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Date Range</label>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500">
              <option value="month">Last 30 days</option>
              <option value="quarter">Last 90 days</option>
              <option value="half">Last 6 months</option>
              <option value="year">Last 12 months</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Data refreshes automatically when date range changes.</p>
            <button
              onClick={() => setDateRange(d => d)} // trigger re-render / manual refresh
              className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-700 px-4 py-2 rounded-lg hover:bg-zinc-200 text-sm font-medium w-full justify-center">
              <Filter className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary ── */}
      {reportType === 'summary' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Vehicles',      value: String(vehicles.length),      sub: `${activeVehicles} active, ${inMaintenance} in maintenance` },
              { label: `Inspections (${rangeLabel})`, value: String(totalInspections), sub: `Pass rate ${passRate}%` },
              { label: `Total Cost (${rangeLabel})`,  value: fmtR(totalCost),           sub: 'All categories' },
              { label: 'Compliance Score',    value: `${complianceScore}%`,        sub: `${overdueCompliance} item${overdueCompliance !== 1 ? 's' : ''} overdue` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white rounded-lg shadow p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Inspection type breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'General Inspections',   value: generalCount,   color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Forklift Inspections',  value: forkliftCount,  color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Generator Inspections', value: generatorCount, color: 'text-green-600',  bg: 'bg-green-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-lg p-4 text-center`}>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className={`text-3xl font-bold ${color} mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-base font-semibold text-zinc-800 mb-4">Monthly Inspections</h3>
              {monthlyInspections.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-12">No inspection data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyInspections}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed"    name="Failed"    fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-base font-semibold text-zinc-800 mb-4">Monthly Cost Trend (R)</h3>
              {monthlyCosts.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-12">No cost data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={monthlyCosts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#888" tick={{ fontSize: 12 }} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtR(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="fuel"        name="Fuel"        stroke="#f97316" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="maintenance" name="Maintenance"  stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="other"       name="Other"        stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Inspections Report ── */}
      {reportType === 'inspections' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'General',   value: generalCount,   color: 'bg-blue-50 text-blue-700' },
              { label: 'Forklift',  value: forkliftCount,  color: 'bg-orange-50 text-orange-700' },
              { label: 'Generator', value: generatorCount, color: 'bg-green-50 text-green-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${color} rounded-lg p-4 text-center`}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <h3 className="text-base font-semibold text-zinc-800 mb-4">Inspections per Month</h3>
              {monthlyInspections.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-16">No inspection data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyInspections}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#888" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed"    name="Failed"    fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h3 className="text-base font-semibold text-zinc-800">Summary</h3>
              {[
                { label: 'Total Inspections', value: totalInspections },
                { label: 'Passed',            value: totalInspections - totalFailed },
                { label: 'Failed',            value: totalFailed },
                { label: 'Pass Rate',         value: `${passRate}%` },
                { label: 'General',           value: generalCount },
                { label: 'Forklift',          value: forkliftCount },
                { label: 'Generator',         value: generatorCount },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-zinc-600">{label}</span>
                  <span className="font-semibold text-zinc-900">{value}</span>
                </div>
              ))}
              <div className="pt-2">
                <div className="w-full bg-zinc-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${passRate}%` }} />
                </div>
                <p className="text-xs text-zinc-500 mt-1">{passRate}% pass rate</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Cost Analysis ── */}
      {reportType === 'costs' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: `Total (${rangeLabel})`,       value: fmtR(totalCost)       },
              { label: `Fuel (${rangeLabel})`,        value: fmtR(totalFuel)        },
              { label: `Maintenance (${rangeLabel})`, value: fmtR(totalMaintenance) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg shadow p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-zinc-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-zinc-800 mb-4">Cost Breakdown by Month (R)</h3>
            {monthlyCosts.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-16">No cost data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyCosts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#888" tick={{ fontSize: 12 }} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtR(v)} />
                  <Legend />
                  <Bar dataKey="fuel"        name="Fuel"        fill="#f97316" stackId="a" />
                  <Bar dataKey="maintenance" name="Maintenance"  fill="#3b82f6" stackId="a" />
                  <Bar dataKey="other"       name="Other"        fill="#8b5cf6" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* ── Compliance Status ── */}
      {reportType === 'compliance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-base font-semibold text-zinc-800 mb-4">Compliance Overview</h3>
            {complianceData.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-16">No compliance data</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={complianceData} cx="50%" cy="50%"
                    innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {complianceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6 space-y-3">
            <h3 className="text-base font-semibold text-zinc-800 mb-2">Breakdown</h3>
            {complianceData.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="flex-1 text-sm text-zinc-700">{d.name}</span>
                <span className="font-semibold text-zinc-900">{d.value}</span>
              </div>
            ))}
            <hr className="my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Total tracked</span>
              <span className="font-semibold">{compliance.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Compliance rate</span>
              <span className={`font-semibold ${complianceScore >= 80 ? 'text-green-600' : complianceScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {complianceScore}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Vehicle Utilisation ── */}
      {reportType === 'utilization' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-semibold text-zinc-800 mb-4">
            Inspections per Vehicle ({rangeLabel})
          </h3>
          {vehicleUtilisation.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-16">No inspection data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, vehicleUtilisation.length * 40)}>
              <BarChart data={vehicleUtilisation} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" stroke="#888" tick={{ fontSize: 12 }} />
                <YAxis dataKey="vehicle" type="category" stroke="#888" tick={{ fontSize: 12 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" name="Inspections" fill="#3b82f6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Cost Per Vehicle ── */}
      {reportType === 'pervehicle' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-base font-semibold text-zinc-800 mb-4">Cost Per Vehicle ({rangeLabel})</h3>
          {vehicleCosts.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">No cost data for this period</p>
          ) : (
            <>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-zinc-100">
                      <th className="text-left px-4 py-2 font-semibold text-zinc-600">Vehicle</th>
                      <th className="text-right px-4 py-2 font-semibold text-zinc-600">Fuel (R)</th>
                      <th className="text-right px-4 py-2 font-semibold text-zinc-600">Maintenance (R)</th>
                      <th className="text-right px-4 py-2 font-semibold text-zinc-600">Other (R)</th>
                      <th className="text-right px-4 py-2 font-semibold text-zinc-600">Total (R)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleCosts.map((row, i) => {
                      const veh = vehicles.find(v => v.id === row.vehicle) ?? null;
                      const label = veh?.registration ?? row.vehicle.slice(0, 8);
                      return (
                        <tr key={row.vehicle} className={i % 2 === 0 ? '' : 'bg-zinc-50'}>
                          <td className="px-4 py-2 font-medium text-zinc-800">{label}</td>
                          <td className="px-4 py-2 text-right text-zinc-600">{fmtR(row.fuel)}</td>
                          <td className="px-4 py-2 text-right text-zinc-600">{fmtR(row.maintenance)}</td>
                          <td className="px-4 py-2 text-right text-zinc-600">{fmtR(row.other)}</td>
                          <td className="px-4 py-2 text-right font-bold text-zinc-900">{fmtR(row.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                      <td className="px-4 py-2 font-bold">Total</td>
                      <td className="px-4 py-2 text-right font-bold">{fmtR(vehicleCosts.reduce((s,r)=>s+r.fuel,0))}</td>
                      <td className="px-4 py-2 text-right font-bold">{fmtR(vehicleCosts.reduce((s,r)=>s+r.maintenance,0))}</td>
                      <td className="px-4 py-2 text-right font-bold">{fmtR(vehicleCosts.reduce((s,r)=>s+r.other,0))}</td>
                      <td className="px-4 py-2 text-right font-bold text-sky-700">{fmtR(vehicleCosts.reduce((s,r)=>s+r.total,0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vehicleCosts.map(r => ({ ...r, vehicle: vehicles.find(v=>v.id===r.vehicle)?.registration ?? r.vehicle.slice(0,8) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="vehicle" stroke="#888" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#888" tick={{ fontSize: 12 }} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtR(v)} />
                  <Legend />
                  <Bar dataKey="fuel"        name="Fuel"        fill="#f97316" stackId="a" />
                  <Bar dataKey="maintenance" name="Maintenance"  fill="#3b82f6" stackId="a" />
                  <Bar dataKey="other"       name="Other"        fill="#8b5cf6" stackId="a" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* ── Deviation Summary ── */}
      {reportType === 'deviations' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Deviations', value: deviationSummary.reduce((s, r) => s + r.count, 0), color: 'bg-red-100', text: 'text-red-600' },
              { label: 'Unique Defect Types', value: deviationSummary.length, color: 'bg-orange-100', text: 'text-orange-600' },
              { label: 'Vehicles Affected', value: new Set(filteredInsp.filter(i => ((i.answers as any)?.deviations?.length ?? 0) > 0).map(i => i.vehicle?.registration ?? i.vehicle_id)).size, color: 'bg-yellow-100', text: 'text-yellow-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
                <div className={`${s.color} p-3 rounded-full`}>
                  <span className={`text-xl font-bold ${s.text}`}>{s.value}</span>
                </div>
                <p className="text-sm font-medium text-zinc-600">{s.label} ({rangeLabel})</p>
              </div>
            ))}
          </div>

          {deviationSummary.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-zinc-400">No deviations recorded in this period — fleet is in good shape!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-base font-semibold text-zinc-800 mb-4">Top Defects by Frequency</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={deviationSummary.slice(0, 10).map(r => ({ ...r, item: r.item.length > 22 ? r.item.slice(0, 22) + '…' : r.item }))}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" stroke="#888" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="item" width={150} stroke="#888" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v} occurrence${v !== 1 ? 's' : ''}`, 'Count']} />
                    <Bar dataKey="count" name="Occurrences" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ranked table */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-base font-semibold text-zinc-800 mb-4">Ranked Defect Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-zinc-100">
                        <th className="text-center px-3 py-2 font-semibold text-zinc-600 w-10">#</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-600">Deviation Item</th>
                        <th className="text-center px-3 py-2 font-semibold text-zinc-600">Count</th>
                        <th className="text-center px-3 py-2 font-semibold text-zinc-600">Vehicles</th>
                        <th className="text-left px-3 py-2 font-semibold text-zinc-600 w-28">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviationSummary.map((row, i) => {
                        const total = deviationSummary.reduce((s, r) => s + r.count, 0);
                        const pct = total > 0 ? Math.round(row.count / total * 100) : 0;
                        return (
                          <tr key={row.item} className={i % 2 === 0 ? '' : 'bg-zinc-50'}>
                            <td className="px-3 py-2 text-center text-zinc-400 font-mono text-xs">{i + 1}</td>
                            <td className="px-3 py-2 text-zinc-800 font-medium">{row.item}</td>
                            <td className="px-3 py-2 text-center font-bold text-red-600">{row.count}</td>
                            <td className="px-3 py-2 text-center text-zinc-600">{row.vehicles}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-zinc-100 rounded-full h-2">
                                  <div className="bg-red-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-zinc-500 w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Exports log */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-zinc-200">
          <h2 className="text-base font-semibold text-zinc-800">Quick Export</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {(['summary', 'inspections', 'costs', 'compliance', 'utilization'] as const).map(type => {
            const labels: Record<string, string> = {
              summary: 'Fleet Summary', inspections: 'Inspections Report',
              costs: 'Cost Analysis', compliance: 'Compliance Status',
              utilization: 'Vehicle Utilisation',
            };
            return (
              <div key={type} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{labels[type]} — {rangeLabel}</p>
                    <p className="text-xs text-zinc-500">Live data · {new Date().toLocaleDateString('en-ZA')}</p>
                  </div>
                </div>
                <button
                  onClick={() => exportCSV(type, dateRange, filteredInsp, allCosts, compliance, vehicles)}
                  className="text-sky-600 hover:text-sky-800">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FleetReports;
