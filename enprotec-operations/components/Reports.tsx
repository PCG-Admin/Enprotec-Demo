import React, { useState, useCallback } from 'react';
import Card from './Card';
import { generateReportSummary, askStockQuestion, aiAvailable } from '../services/geminiService';
import { supabase } from '../supabase/client';
import { getMappedRole, WorkflowRequest, StockItem, User, UserRole, departmentToStoreMap, Store } from '../types';

interface ReportsProps {
    user: User;
}

type DateRange = '30' | '60' | '90';

const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const handleGenerateSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSummary('');
    try {
      const isAdmin = getMappedRole(user.role) === UserRole.Admin;
      const userStores = user.departments || [];

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(dateRange, 10));
      const cutoffIso = cutoff.toISOString();

      let workflowsQuery = supabase.from('enprotec_workflows_view').select('*')
        .gte('createdAt', cutoffIso);
      if (!isAdmin && userStores.length > 0) {
        workflowsQuery = workflowsQuery.in('department', userStores);
      }

      const visibleStores = userStores.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);
      let stockQuery = supabase.from('enprotec_stock_view').select('*');
      if (!isAdmin && visibleStores.length > 0) {
        stockQuery = stockQuery.in('store', visibleStores);
      }

      const [workflowsRes, stockRes] = await Promise.all([
        workflowsQuery,
        stockQuery,
      ]);

      if (workflowsRes.error) throw new Error('Failed to fetch workflow data for report.');
      if (stockRes.error) throw new Error('Failed to fetch stock data for report.');

      const result = await generateReportSummary(
        (workflowsRes.data as unknown as WorkflowRequest[]) || [],
        (stockRes.data as unknown as StockItem[]) || []
      );
      setSummary(result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user, dateRange]);

  const handleAskQuestion = useCallback(async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    setError('');
    setAnswer(null);

    try {
      const isAdmin = getMappedRole(user.role) === UserRole.Admin;
      const userStores = user.departments || [];
      const visibleStores = userStores.map(dep => departmentToStoreMap[dep as Store]).filter(Boolean);

      const receiptsQuery = supabase
        .from('enprotec_stock_receipts_view')
        .select('*')
        .order('receivedAt', { ascending: false })
        .limit(50);
      const receiptsRes = getMappedRole(user.role) === UserRole.Admin || visibleStores.length === 0
        ? await receiptsQuery
        : await receiptsQuery.in('store', visibleStores);
      if (receiptsRes.error) throw receiptsRes.error;

      let issuesQuery = supabase
        .from('enprotec_workflows_view')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50);
      if (!isAdmin && userStores.length > 0) {
        issuesQuery = issuesQuery.in('department', userStores);
      }
      const issuesRes = await issuesQuery;
      if (issuesRes.error) throw issuesRes.error;

      const aiResult = await askStockQuestion(question.trim(), {
        receipts: receiptsRes.data || [],
        issues: (issuesRes.data as unknown as WorkflowRequest[]) || [],
      });
      setAnswer(aiResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to process your question. Please try again.';
      setError(message);
      console.error(err);
    } finally {
      setIsAsking(false);
    }
  }, [question, user]);

  return (
    <div className="space-y-6">
      <Card title="Reporting & Analytics">
        <p className="text-zinc-400">
          Generate reports and gain insights into your operational efficiency, stock levels, and procurement costs.
        </p>
      </Card>

      <Card title="Operational Summary">
        <div className="space-y-4">
            <p className="text-zinc-400">
                Generate a real-time summary of current workflows and stock levels.
            </p>
            {!aiAvailable() ? (
              <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-sm">
                This assistant is currently unavailable. Please contact your administrator.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-zinc-500">Date range:</label>
                  <select
                    value={dateRange}
                    onChange={e => setDateRange(e.target.value as DateRange)}
                    className="p-2 bg-white border border-zinc-300 rounded-md text-sm text-zinc-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="30">Last 30 days</option>
                    <option value="60">Last 60 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </div>
                <button
                    onClick={handleGenerateSummary}
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-400 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                        </>
                    ) : (
                        'Generate Summary'
                    )}
                </button>
                {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">{error}</div>}
                {summary && (
                    <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-md">
                        <h4 className="font-bold text-zinc-100 mb-2">Summary:</h4>
                        <div className="prose prose-sm max-w-none text-zinc-300 whitespace-pre-wrap">{summary}</div>
                    </div>
                )}
              </>
            )}
        </div>
      </Card>

      <Card title="Ask Questions">
        <div className="space-y-4">
          <p className="text-zinc-400">Ask questions about recent receipts and issues (last 50 of each in your scope).</p>
          {!aiAvailable() ? (
            <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-sm">
              This assistant is currently unavailable. Please contact your administrator.
            </div>
          ) : (
            <>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                rows={3}
                className="w-full p-3 border border-zinc-300 rounded-md text-sm bg-white text-zinc-900"
                placeholder="Ask about stock or requests…"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAskQuestion}
                  disabled={isAsking || !question.trim()}
                  className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 disabled:bg-zinc-300"
                >
                  {isAsking ? 'Processing...' : 'Ask Question'}
                </button>
                {answer && <span className="text-xs text-zinc-500">Answer generated</span>}
              </div>
              {error && <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md">{error}</div>}
              {answer && (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-md text-sm whitespace-pre-wrap text-zinc-800">
                  {answer}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Reports;
