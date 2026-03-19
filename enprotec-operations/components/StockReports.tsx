import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { WorkflowAttachment, WorkflowRequest, WorkflowStatus, User, WorkflowItem } from '../types';
import { askStockQuestion, aiAvailable } from '../services/geminiService';

interface StockReportsProps {
  user: User;
}

interface ReceiptRow {
  id: string;
  partNumber: string;
  description: string;
  quantityReceived: number;
  receivedAt: string;
  store: string;
  deliveryNotePO: string;
  attachmentUrl?: string | null;
}

interface IssueRow {
  id: string;
  requestNumber: string;
  projectCode: string;
  department: string;
  createdAt: string;
  status: WorkflowStatus;
  items: WorkflowItem[];
  attachments?: WorkflowAttachment[];
}

const issueStatuses: WorkflowStatus[] = [
  WorkflowStatus.AWAITING_PICKING,
  WorkflowStatus.PICKED_AND_LOADED,
  WorkflowStatus.DISPATCHED,
  WorkflowStatus.EPOD_CONFIRMED,
  WorkflowStatus.COMPLETED,
];

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const StockReports: React.FC<StockReportsProps> = ({ user }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiAnswer(null);
    try {
      const startISO = new Date(startDate).toISOString();
      const endISO = new Date(endDate).toISOString();

      const [receiptsRes, issuesRes] = await Promise.all([
        supabase
          .from('enprotec_stock_receipts_view')
          .select('*')
          .gte('receivedAt', startISO)
          .lte('receivedAt', endISO)
          .order('receivedAt', { ascending: false }),
        supabase
          .from('enprotec_workflows_view')
          .select('*')
          .gte('createdAt', startISO)
          .lte('createdAt', endISO)
          .in('currentStatus', issueStatuses),
      ]);

      if (receiptsRes.error) throw receiptsRes.error;
      if (issuesRes.error) throw issuesRes.error;

      setReceipts((receiptsRes.data as ReceiptRow[]) || []);
      setIssues(((issuesRes.data as unknown as WorkflowRequest[]) || []).map(w => ({
        id: w.id,
        requestNumber: w.requestNumber,
        projectCode: w.projectCode,
        department: w.department,
        createdAt: w.createdAt,
        status: w.currentStatus,
        items: w.items || [],
        attachments: w.attachments || (w.attachmentUrl ? [{ id: 'legacy', url: w.attachmentUrl, fileName: 'Attachment' }] : []),
      })));
    } catch (err) {
      setError('Failed to load stock reports.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

const inboundQty = useMemo(() => receipts.reduce((sum, r) => sum + (r.quantityReceived || 0), 0), [receipts]);
const outboundQty = useMemo(
    () =>
      issues.reduce((sum, issue) => {
        const itemQty = issue.items?.reduce((s, i) => s + (i.quantityRequested || 0), 0) ?? 0;
        return sum + itemQty;
      }, 0),
    [issues]
  );

const maxBar = Math.max(inboundQty, outboundQty, 1);

  const inboundByStore = useMemo(() => {
    const map = new Map<string, number>();
    receipts.forEach(r => {
      const current = map.get(r.store) ?? 0;
      map.set(r.store, current + (r.quantityReceived || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [receipts]);

  const outboundByStore = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach(i => {
      const qty = i.items?.reduce((s, it) => s + (it.quantityRequested || 0), 0) ?? 0;
      const current = map.get(i.department) ?? 0;
      map.set(i.department, current + qty);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const topInboundParts = useMemo(() => {
    const map = new Map<string, { part: string; desc: string; qty: number }>();
    receipts.forEach(r => {
      const key = r.partNumber;
      const current = map.get(key)?.qty ?? 0;
      map.set(key, { part: r.partNumber, desc: r.description ?? '', qty: current + (r.quantityReceived || 0) });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [receipts]);

  const topOutboundParts = useMemo(() => {
    const map = new Map<string, { part: string; qty: number }>();
    issues.forEach(issue => {
      issue.items?.forEach(it => {
        const current = map.get(it.partNumber)?.qty ?? 0;
        map.set(it.partNumber, { part: it.partNumber, qty: current + (it.quantityRequested || 0) });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [issues]);

  const attachmentCount = useMemo(() => {
    const inboundAtt = receipts.filter(r => !!r.attachmentUrl).length;
    const outboundAtt = issues.reduce((count, i) => count + ((i.attachments?.length ?? 0) > 0 ? 1 : 0), 0);
    return inboundAtt + outboundAtt;
  }, [receipts, issues]);

  const downloadCsv = () => {
    const rows: string[] = [];
    rows.push('Type,Date,Reference,Part/Request,Description/Site,Quantity,Store,Status,Attachments');

    receipts.forEach(r => {
      rows.push([
        'IN',
        new Date(r.receivedAt).toISOString(),
        r.deliveryNotePO ?? '',
        r.partNumber,
        r.description ?? '',
        r.quantityReceived,
        r.store ?? '',
        'Received',
        (r.attachmentUrl ?? '').replace(/,/g, ';'),
      ].join(','));
    });

    issues.forEach(w => {
      const qty = w.items?.reduce((s, i) => s + (i.quantityRequested || 0), 0) ?? 0;
      const attachmentLinks = (w.attachments || []).map(a => a.url).join(';');
      rows.push([
        'OUT',
        new Date(w.createdAt).toISOString(),
        w.requestNumber,
        w.projectCode,
        w.department,
        qty,
        w.department,
        w.status,
        attachmentLinks.replace(/,/g, ';'),
      ].join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stock-report-${startDate}-to-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer(null);
    try {
      const answer = await askStockQuestion(aiQuestion.trim(), {
        receipts: receipts.slice(0, 50),
        issues: issues.slice(0, 50),
      });
      setAiAnswer(answer);
    } catch (err) {
      console.error(err);
      setAiAnswer('We could not generate an answer right now. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Stock Reports</h1>
          <p className="text-sm text-zinc-500">Inbound receipts and outbound issues for the selected period.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-600">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1 text-sm" />
          <label className="text-sm text-zinc-600">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1 text-sm" />
          <button onClick={fetchData} className="px-3 py-2 text-sm bg-sky-500 text-white rounded-md hover:bg-sky-600">Refresh</button>
          <button onClick={downloadCsv} className="px-3 py-2 text-sm bg-zinc-200 text-zinc-800 rounded-md hover:bg-zinc-300">Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase">Inbound Qty</p>
          <p className="text-2xl font-bold text-emerald-700">{inboundQty}</p>
          <div className="mt-2 h-2 bg-zinc-100 rounded">
            <div className="h-full bg-emerald-500 rounded" style={{ width: `${(inboundQty / maxBar) * 100}%` }}></div>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase">Outbound Qty</p>
          <p className="text-2xl font-bold text-sky-700">{outboundQty}</p>
          <div className="mt-2 h-2 bg-zinc-100 rounded">
            <div className="h-full bg-sky-500 rounded" style={{ width: `${(outboundQty / maxBar) * 100}%` }}></div>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase">Net Movement</p>
          <p className={`text-2xl font-bold ${inboundQty - outboundQty >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{inboundQty - outboundQty}</p>
          <p className="text-xs text-zinc-500 mt-1">Inbound minus outbound</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase">Docs Attached</p>
          <p className="text-2xl font-bold text-amber-700">{attachmentCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Receipts + outbound requests with files</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Inbound by Store</h3>
            <span className="text-xs text-zinc-500">Top {Math.min(inboundByStore.length, 4)}</span>
          </div>
          {inboundByStore.length === 0 ? (
            <p className="text-sm text-zinc-500">No receipts in range.</p>
          ) : (
            <div className="space-y-2">
              {inboundByStore.slice(0, 4).map(([store, qty]) => (
                <div key={store}>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>{store}</span>
                    <span>{qty}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded">
                    <div className="h-full bg-emerald-500 rounded" style={{ width: `${Math.min((qty / (inboundByStore[0]?.[1] || 1)) * 100, 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Outbound by Store</h3>
            <span className="text-xs text-zinc-500">Top {Math.min(outboundByStore.length, 4)}</span>
          </div>
          {outboundByStore.length === 0 ? (
            <p className="text-sm text-zinc-500">No outbound in range.</p>
          ) : (
            <div className="space-y-2">
              {outboundByStore.slice(0, 4).map(([store, qty]) => (
                <div key={store}>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>{store}</span>
                    <span>{qty}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded">
                    <div className="h-full bg-sky-500 rounded" style={{ width: `${Math.min((qty / (outboundByStore[0]?.[1] || 1)) * 100, 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900">Top Inbound Parts</h3>
          {topInboundParts.length === 0 ? (
            <p className="text-sm text-zinc-500">No receipts in range.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-800">
              {topInboundParts.map(item => (
                <li key={item.part} className="flex justify-between">
                  <span className="font-mono">{item.part}</span>
                  <span className="text-zinc-500">{item.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900">Top Outbound Parts</h3>
          {topOutboundParts.length === 0 ? (
            <p className="text-sm text-zinc-500">No outbound in range.</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-800">
              {topOutboundParts.map(item => (
                <li key={item.part} className="flex justify-between">
                  <span className="font-mono">{item.part}</span>
                  <span className="text-zinc-500">{item.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Inbound (Receipts)</h2>
          <span className="text-sm text-zinc-500">{receipts.length} records</span>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-zinc-500">No receipts in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Part</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-left">Store</th>
                  <th className="px-4 py-2 text-left">Attachment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(r.receivedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-mono">{r.partNumber}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className="px-4 py-2 text-center font-semibold">{r.quantityReceived}</td>
                    <td className="px-4 py-2">{r.store}</td>
                    <td className="px-4 py-2">
                      {r.attachmentUrl ? (
                        <a className="text-sky-600 hover:underline" href={r.attachmentUrl} target="_blank" rel="noopener noreferrer">View</a>
                      ) : (
                        <span className="text-xs text-zinc-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Outbound (Issues / Dispatch)</h2>
          <span className="text-sm text-zinc-500">{issues.length} requests</span>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-zinc-500">No outbound movements in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Request #</th>
                  <th className="px-4 py-2 text-left">Site</th>
                  <th className="px-4 py-2 text-left">Store</th>
                  <th className="px-4 py-2 text-center">Total Qty</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Attachments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {issues.map(issue => {
                  const qty = issue.items?.reduce((s, i) => s + (i.quantityRequested || 0), 0) ?? 0;
                  return (
                    <tr key={issue.id}>
                      <td className="px-4 py-2 whitespace-nowrap">{new Date(issue.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap font-semibold">{issue.requestNumber}</td>
                      <td className="px-4 py-2">{issue.projectCode}</td>
                      <td className="px-4 py-2">{issue.department}</td>
                      <td className="px-4 py-2 text-center font-semibold">{qty}</td>
                      <td className="px-4 py-2">{issue.status}</td>
                      <td className="px-4 py-2">
                        {issue.attachments && issue.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {issue.attachments.map(att => (
                              <a key={att.id} className="text-sky-600 hover:underline text-xs" href={att.url} target="_blank" rel="noopener noreferrer">
                                {att.fileName || 'Attachment'}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Stock Q&A</h2>
        </div>
        {!aiAvailable() ? (
          <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-sm">
            This assistant is currently unavailable. Please contact your administrator.
          </div>
        ) : (
          <>
            <textarea
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              rows={3}
              className="w-full border border-zinc-300 rounded-md p-2 text-sm"
              placeholder="Ask about stock or issues…"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleAskAi}
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-4 py-2 bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:bg-zinc-300"
              >
                {aiLoading ? 'Processing...' : 'Ask Question'}
              </button>
              {aiAnswer && <span className="text-xs text-zinc-500">Answer generated</span>}
            </div>
            {aiAnswer && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3 text-sm whitespace-pre-wrap">
                {aiAnswer}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StockReports;
