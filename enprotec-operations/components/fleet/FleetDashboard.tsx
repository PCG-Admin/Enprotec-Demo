import * as React from 'react';
import {
  Truck, ClipboardCheck, AlertTriangle, DollarSign,
  ArrowUpRight, Calendar, Loader2, X, Bell, ShieldAlert, Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import type { User } from '../../types';
import { UserRole } from '../../types';
import { getVehicles } from '../../supabase/services/vehicles.service';
import { getInspections, getInspectionsByInspector } from '../../supabase/services/inspections.service';
import { downloadInspection, type InspectionRecord } from '../../utils/printInspection';
import { getMonthlyCostTotals } from '../../supabase/services/costs.service';
import { getComplianceSchedule } from '../../supabase/services/compliance.service';
import { getExpiringLicenses } from '../../supabase/services/licenses.service';
import type { InspectionRow } from '../../supabase/database.types';
import type { LicenseRow } from '../../supabase/database.types';
import type { ComplianceRow } from '../../supabase/database.types';

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#10b981', '#8b5cf6'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const daysLeft = (exp: string) =>
  Math.ceil((new Date(exp).getTime() - Date.now()) / 86_400_000);

interface Props { user: User | null; }

const FleetDashboard: React.FC<Props> = ({ user }) => {
  const isDriver = user?.role === UserRole.Driver && user?.fleet_role == null; // pure driver only; dual-role gets full fleet view
  const [loading, setLoading]                   = React.useState(true);
  const [totalVehicles, setTotalVehicles]       = React.useState(0);
  const [vehicleStatusData, setVehicleStatus]   = React.useState<{ name: string; value: number }[]>([]);
  const [inspectionsToday, setInspectionsToday] = React.useState(0);
  const [overdue, setOverdue]                   = React.useState(0);
  const [monthlyCost, setMonthlyCost]           = React.useState(0);
  const [weeklyTrend, setWeeklyTrend]           = React.useState<{ day: string; completed: number }[]>([]);
  const [recentInspections, setRecent]          = React.useState<InspectionRow[]>([]);
  const [complianceScore, setComplianceScore]   = React.useState(100);
  const [complianceCounts, setComplianceCounts] = React.useState({ compliant: 0, expiring: 0, overdue: 0 });
  const [expiringLicenses, setExpiringLicenses] = React.useState<LicenseRow[]>([]);
  const [overdueVehicles, setOverdueVehicles]   = React.useState<string[]>([]);
  const [dismissed, setDismissed]               = React.useState<Set<string>>(new Set());

  const dismiss = (key: string) => setDismissed(prev => new Set([...prev, key]));

  const [date] = React.useState(new Date());
  const formattedDate = date.toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    if (isDriver && user) {
      // Driver view: assigned vehicles + their own inspections (by inspector_id)
      Promise.all([
        getInspectionsByInspector(user.id),
        getVehicles(),
      ]).then(([all, allVehicles]) => {
        // Filter vehicles assigned to this driver by FK
        const myVehicles = allVehicles.filter(v => v.assigned_driver_id === user.id);
        const vehicleIds = myVehicles.length > 0
          ? myVehicles.map(v => v.id)
          : [...new Set(all.map(i => i.vehicle_id).filter(Boolean))];
        setTotalVehicles(vehicleIds.length);

        // Status breakdown from their inspections (most recent per vehicle)
        const statusCounts: Record<string, number> = {};
        vehicleIds.forEach(vid => {
          const latest = all.find(i => i.vehicle_id === vid);
          const s = latest?.status ?? 'pass';
          statusCounts[s] = (statusCounts[s] ?? 0) + 1;
        });
        setVehicleStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

        const todayInspections = all.filter(i => i.started_at.startsWith(today));
        setInspectionsToday(todayInspections.length);
        setRecent(all.slice(0, 5));

        const trend = DAYS.map((day, i) => ({
          day,
          completed: all.filter(insp => new Date(insp.started_at).getDay() === i).length,
        }));
        setWeeklyTrend(trend);
      }).catch(() => {}).finally(() => setLoading(false));

    } else {
      // Admin / Fleet Coordinator: full fleet view (most recent 10, no date cutoff)
      Promise.all([
        getVehicles(),
        getInspections(10),
        getMonthlyCostTotals(1),
        getComplianceSchedule(),
        getExpiringLicenses(30),
      ]).then(([vehicles, inspections, costs, compliance, expLicenses]) => {

        setTotalVehicles(vehicles.length);
        const statusCounts: Record<string, number> = {};
        vehicles.forEach(v => { statusCounts[v.status] = (statusCounts[v.status] ?? 0) + 1; });
        setVehicleStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

        const todayInspections = inspections.filter(i => i.started_at.startsWith(today));
        setInspectionsToday(todayInspections.length);
        setRecent(inspections.slice(0, 5));

        const trend = DAYS.map((day, i) => ({
          day,
          completed: inspections.filter(insp => new Date(insp.started_at).getDay() === i).length,
        }));
        setWeeklyTrend(trend);

        const costTotal = costs.reduce((s, c) => s + c.total, 0);
        setMonthlyCost(costTotal);

        const overdueCount = compliance.filter((c: ComplianceRow) => c.status === 'Overdue').length;
        const dueSoonCount = compliance.filter((c: ComplianceRow) => c.status === 'Due Soon').length;
        const compliantCount = compliance.filter((c: ComplianceRow) => c.status === 'Scheduled' || c.status === 'Completed').length;
        setOverdue(overdueCount);
        setComplianceCounts({ compliant: compliantCount, expiring: dueSoonCount, overdue: overdueCount });
        const total = compliance.length;
        setComplianceScore(total > 0 ? Math.round(((total - overdueCount) / total) * 100) : 100);

        setExpiringLicenses(expLicenses.slice(0, 4));

        // Vehicles with overdue next_inspection_date
        const todayStr = new Date().toISOString().slice(0, 10);
        const overdueVehs = vehicles
          .filter(v => v.next_inspection_date && v.next_inspection_date < todayStr)
          .map(v => v.registration);
        setOverdueVehicles(overdueVehs);

      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [isDriver, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fleet Dashboard</h1>
          <p className="text-gray-500 mt-1">{formattedDate}</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
            Fleet Status: Operational
          </span>
        </div>
      </div>

      {/* ── Alert Banners (T36 / T41) ── */}
      {!isDriver && (() => {
        const critical7  = expiringLicenses.filter(l => daysLeft(l.expiry_date) <= 7);
        const warning14  = expiringLicenses.filter(l => { const d = daysLeft(l.expiry_date); return d > 7 && d <= 14; });
        const info30     = expiringLicenses.filter(l => { const d = daysLeft(l.expiry_date); return d > 14 && d <= 30; });

        const alerts: { key: string; icon: React.ReactNode; bg: string; border: string; text: string; msg: string }[] = [];

        if (overdueVehicles.length > 0)
          alerts.push({ key:'insp-overdue', icon:<ShieldAlert className="h-5 w-5"/>, bg:'bg-red-50', border:'border-red-400', text:'text-red-800', msg:`${overdueVehicles.length} vehicle${overdueVehicles.length>1?'s':''} with overdue inspection: ${overdueVehicles.join(', ')}` });

        if (complianceCounts.overdue > 0)
          alerts.push({ key:'comp-overdue', icon:<AlertTriangle className="h-5 w-5"/>, bg:'bg-orange-50', border:'border-orange-400', text:'text-orange-800', msg:`${complianceCounts.overdue} compliance item${complianceCounts.overdue>1?'s':''} are overdue — review the Compliance page.` });

        if (critical7.length > 0)
          alerts.push({ key:'lic-7', icon:<Bell className="h-5 w-5"/>, bg:'bg-red-50', border:'border-red-400', text:'text-red-800', msg:`URGENT: ${critical7.length} license${critical7.length>1?'s':''} expire within 7 days: ${critical7.map(l=>l.license_number||l.license_type).join(', ')}` });

        if (warning14.length > 0)
          alerts.push({ key:'lic-14', icon:<Bell className="h-5 w-5"/>, bg:'bg-yellow-50', border:'border-yellow-400', text:'text-yellow-800', msg:`${warning14.length} license${warning14.length>1?'s':''} expire within 14 days.` });

        if (info30.length > 0)
          alerts.push({ key:'lic-30', icon:<Bell className="h-5 w-5"/>, bg:'bg-blue-50', border:'border-blue-400', text:'text-blue-800', msg:`${info30.length} license${info30.length>1?'s':''} expire within 30 days — review the Licenses page.` });

        const visible = alerts.filter(a => !dismissed.has(a.key));
        if (visible.length === 0) return null;
        return (
          <div className="space-y-2">
            {visible.map(a => (
              <div key={a.key} className={`flex items-start gap-3 ${a.bg} border-l-4 ${a.border} ${a.text} rounded-lg px-4 py-3`}>
                <span className="flex-shrink-0 mt-0.5">{a.icon}</span>
                <p className="flex-1 text-sm font-medium">{a.msg}</p>
                <button onClick={() => dismiss(a.key)} className="flex-shrink-0 hover:opacity-70">
                  <X className="h-4 w-4"/>
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isDriver ? 'My Vehicles' : 'Total Vehicles'}</p>
              <p className="text-3xl font-bold text-gray-900">{totalVehicles}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">{isDriver ? 'Vehicles you\'ve inspected' : 'All fleet vehicles'}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{isDriver ? 'My Inspections Today' : 'Inspections Today'}</p>
              <p className="text-3xl font-bold text-gray-900">{inspectionsToday}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <ClipboardCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400">Submitted today</span>
          </div>
        </div>

        {!isDriver && (
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-gray-900">{overdue}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={overdue > 0 ? 'text-red-600 flex items-center' : 'text-green-600 flex items-center'}>
                {overdue > 0 ? 'Action required' : 'All compliant'}
              </span>
            </div>
          </div>
        )}

        {!isDriver && (
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Cost</p>
                <p className="text-3xl font-bold text-gray-900">R {monthlyCost.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-400">Current month</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart - Weekly Inspections */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Inspections This Week</h3>
          {weeklyTrend.some(d => d.completed > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#888888" />
                <YAxis stroke="#888888" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No inspections this week yet</div>
          )}
        </div>

        {/* Pie Chart - Vehicle Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Vehicle Status</h3>
          {vehicleStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                  fill="#8884d8" paddingAngle={5} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {vehicleStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">No vehicle data</div>
          )}
        </div>
      </div>

      {/* Compliance & License Expiry Widgets — Admin/Coordinator only */}
      {!isDriver && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Compliance Score</h3>
          <div className="flex items-center gap-6 mb-4">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={complianceScore >= 80 ? '#10b981' : complianceScore >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${complianceScore} ${100 - complianceScore}`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900">
                {complianceScore}%
              </span>
            </div>
            <div className="space-y-2 flex-1">
              {[
                { label: 'Compliant',      count: complianceCounts.compliant, color: 'text-green-600' },
                { label: 'Due Soon',       count: complianceCounts.expiring,  color: 'text-amber-600' },
                { label: 'Overdue',        count: complianceCounts.overdue,   color: 'text-red-600'   },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className={`font-semibold ${color}`}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${complianceScore >= 80 ? 'bg-green-500' : complianceScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
              style={{ width: `${complianceScore}%` }} />
          </div>
        </div>

        {/* License Expiry Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">License Expiry Alerts</h3>
          {expiringLicenses.length === 0 ? (
            <p className="text-gray-400 text-sm">No licenses expiring within 30 days.</p>
          ) : (
            <div className="space-y-3">
              {expiringLicenses.map(l => {
                const days = daysLeft(l.expiry_date);
                const name = l.category === 'Vehicle' ? `Vehicle ${l.vehicle_id?.slice(0, 6) ?? '—'}` : (l.driver_name ?? '—');
                return (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{name} — {l.license_type}</p>
                      <p className="text-xs text-gray-500">Expires {l.expiry_date}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      days <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>}

      {/* Recent Inspections */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Recent Inspections</h3>
          {recentInspections.length > 0 && (
            <button
              onClick={() => {
                const header = ['Date', 'Vehicle', 'Inspector', 'Type', 'Status'];
                const rows = recentInspections.map(i => [
                  i.started_at.slice(0, 10),
                  i.vehicle?.registration ?? i.vehicle_id ?? '',
                  i.inspector?.name ?? '',
                  i.inspection_type ?? '',
                  i.status,
                ]);
                const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'inspections.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />Export CSV
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-200">
          {recentInspections.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">No inspections yet.</div>
          ) : (
            recentInspections.map(insp => (
              <div key={insp.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    insp.status === 'pass' ? 'bg-green-500' :
                    insp.status === 'fail' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{insp.vehicle?.registration ?? insp.vehicle_id}</p>
                    <p className="text-sm text-gray-500">
                      {insp.inspector?.name ? `Inspected by ${insp.inspector.name}` : insp.inspection_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    insp.status === 'pass' ? 'bg-green-100 text-green-800' :
                    insp.status === 'fail' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {insp.status.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-500">{insp.started_at.slice(0, 10)}</span>
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <button
                    title="Download / Print PDF"
                    onClick={() => {
                      const record = {
                        id: insp.id,
                        ...((insp.answers as unknown as Omit<InspectionRecord, 'id' | 'result'>) ?? {}),
                        result: (insp.status as InspectionRecord['result']) ?? 'pass',
                      } as InspectionRecord;
                      downloadInspection(record);
                    }}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200">
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
            View all inspections
            <ArrowUpRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FleetDashboard;
