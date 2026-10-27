import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Download, Filter } from 'lucide-react';
import { Category, ReportData } from '../types.ts';
import { apiFetch, formatInr, AVAILABLE_MONTHS } from '../utils/format.ts';

interface ReportsViewProps {
  categories: Category[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ categories }) => {
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [refValue, setRefValue] = useState('2026-10');
  const [categoryFilter, setCategoryFilter] = useState(0);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePeriodTypeChange = (nextType: 'weekly' | 'monthly' | 'yearly') => {
    setPeriodType(nextType);
    if (nextType === 'weekly') {
      setRefValue('2026-10-19');
    } else if (nextType === 'monthly') {
      setRefValue('2026-10');
    } else {
      setRefValue('2026');
    }
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period: periodType,
        ref: refValue,
      });
      if (categoryFilter > 0) {
        params.set('category_id', String(categoryFilter));
      }
      const res = await apiFetch<ReportData>(`/api/reports?${params.toString()}`);
      setReport(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [periodType, refValue, categoryFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleDownloadCsv = () => {
    if (!report) return;
    const headers = [
      'ID',
      'Date',
      'Type',
      'Category_Or_Source',
      'Payment_Method',
      'Description',
      'Amount_INR',
      'Notes',
    ];
    const lines = report.transactions.map((t) =>
      [
        t.id,
        t.transaction_date,
        t.type,
        `"${String((t.type === 'income' ? t.income_source : t.category_name) || '').replace(/"/g, '""')}"`,
        `"${String(t.payment_method || '').replace(/"/g, '""')}"`,
        `"${String(t.description || '').replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        `"${String(t.notes || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csvContent = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger_report_${report.periodType}_${report.refValue}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1e2624]">
        <div>
          <div className="text-xs font-mono text-[#4ff0b7]">
            MODULE 06 · WEEKLY, MONTHLY &amp; YEARLY FINANCIAL REPORTS
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            Financial Reports &amp; Period Analytics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Period Selector */}
          <div className="flex items-center p-1 bg-[#101513] border border-[#1e2624]">
            {(['weekly', 'monthly', 'yearly'] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => handlePeriodTypeChange(pt)}
                className={`px-3 py-1.5 text-xs font-mono capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  periodType === pt
                    ? 'bg-[#4ff0b7] text-[#06120d] font-semibold'
                    : 'text-[#8ba39a] hover:text-[#e9efec]'
                }`}
              >
                {pt}
              </button>
            ))}
          </div>

          {/* Reference Date / Month / Year Picker */}
          <div className="flex items-center gap-2 bg-[#101513] border border-[#1e2624] px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#4ff0b7]" />
            {periodType === 'weekly' && (
              <input
                type="date"
                aria-label="Week start date"
                value={refValue}
                onChange={(e) => setRefValue(e.target.value)}
                className="bg-transparent text-xs font-mono text-[#e9efec] focus:outline-none"
              />
            )}
            {periodType === 'monthly' && (
              <select
                aria-label="Report month"
                value={refValue}
                onChange={(e) => setRefValue(e.target.value)}
                className="bg-transparent text-xs font-mono text-[#e9efec] focus:outline-none cursor-pointer"
              >
                {AVAILABLE_MONTHS.map((m) => (
                  <option key={m} value={m} className="bg-[#101513]">
                    {m}
                  </option>
                ))}
              </select>
            )}
            {periodType === 'yearly' && (
              <select
                aria-label="Report year"
                value={refValue}
                onChange={(e) => setRefValue(e.target.value)}
                className="bg-transparent text-xs font-mono text-[#e9efec] focus:outline-none cursor-pointer"
              >
                <option value="2026" className="bg-[#101513]">
                  2026
                </option>
                <option value="2025" className="bg-[#101513]">
                  2025
                </option>
              </select>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-[#101513] border border-[#1e2624] px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8ba39a]" />
            <select
              aria-label="Filter report by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(Number(e.target.value))}
              className="bg-transparent text-xs font-mono text-[#e9efec] focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-[#101513]">
                All Categories
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#101513]">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!report || report.transactions.length === 0}
            className="px-3.5 py-2 text-xs font-mono text-[#e9efec] border border-[#1e2624] bg-[#101513] hover:border-[#4ff0b7] hover:text-[#4ff0b7] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs">
          {error}
        </div>
      )}

      {loading || !report ? (
        <div className="p-10 text-center text-xs font-mono text-[#8ba39a] border border-[#1e2624] bg-[#101513]">
          Generating financial report...
        </div>
      ) : (
        <>
          {/* Period Boundary Banner */}
          <div className="p-4 border border-[#1e2624] bg-[#101513] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-[#8ba39a]">SELECTED REPORTING WINDOW: </span>
              <span className="text-[#4ff0b7] font-semibold">{report.periodLabel}</span>
            </div>
            <div className="text-[#5a6b65]">
              Date Boundaries: {report.startDate} to {report.endDate} (Inclusive)
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-[#1e2624] bg-[#101513] p-5">
              <div className="text-xs text-[#8ba39a] mb-1">Period Total Income</div>
              <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
                {formatInr(report.summary.totalIncome)}
              </div>
              <div className="text-xs text-[#5a6b65] mt-1">
                Verified income within {report.startDate} – {report.endDate}
              </div>
            </div>

            <div className="border border-[#1e2624] bg-[#101513] p-5">
              <div className="text-xs text-[#8ba39a] mb-1">Period Total Expenses</div>
              <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
                {formatInr(report.summary.totalExpenses)}
              </div>
              <div className="text-xs text-[#5a6b65] mt-1">
                Verified expenses within {report.startDate} – {report.endDate}
              </div>
            </div>

            <div className="border border-[#1e2624] bg-[#101513] p-5">
              <div className="text-xs text-[#8ba39a] mb-1">Period-Based Net Savings</div>
              <div
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  report.summary.netSavings >= 0 ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
                }`}
              >
                {formatInr(report.summary.netSavings)}
              </div>
              <div className="text-xs text-[#5a6b65] mt-1">
                Period Total Income − Period Total Expenses
              </div>
            </div>

            <div className="border border-[#1e2624] bg-[#101513] p-5">
              <div className="text-xs text-[#8ba39a] mb-1">Transactions Included</div>
              <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
                {report.summary.transactionCount}
              </div>
              <div className="text-xs text-[#5a6b65] mt-1">
                Zero duplicate counting · User-scoped
              </div>
            </div>
          </div>

          {/* Category-Wise Expense Totals vs. Monthly Budget Reference */}
          <div className="border border-[#1e2624] bg-[#101513]">
            <div className="p-5 border-b border-[#1e2624]">
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Category-Wise Expense Summary &amp; Budget Comparison
              </h2>
              <p className="text-xs text-[#8ba39a]">
                Clearly distinguishes selected Period Expense Total ({report.periodLabel}) from the
                Reference Monthly Budget Figure ({report.budgetMonthForComparison})
              </p>
            </div>

            {report.categoryReport.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8ba39a]">
                No category expenses or budgets found for this reporting period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Transactions</th>
                      <th className="py-3 px-4 text-right">
                        Period Expense Total ({report.periodType})
                      </th>
                      <th className="py-3 px-4 text-right">Share of Period Spending</th>
                      <th className="py-3 px-4 text-right">
                        Monthly Budget Figure ({report.budgetMonthForComparison})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2624]">
                    {report.categoryReport.map((row) => (
                      <tr key={row.category_id} className="hover:bg-[#151c19]">
                        <td className="py-3 px-4 font-medium text-[#e9efec]">
                          {row.category_name}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                          {row.transaction_count}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#e9efec]">
                          {formatInr(row.period_expense)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                          {row.share_pct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4ff0b7]">
                          {row.monthly_budget_reference !== null
                            ? formatInr(row.monthly_budget_reference)
                            : 'Not Budgeted'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Transaction Ledger for the Selected Period */}
          <div className="border border-[#1e2624] bg-[#101513]">
            <div className="p-5 border-b border-[#1e2624]">
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Transaction Details for Selected Period ({report.transactions.length} entries)
              </h2>
            </div>

            {report.transactions.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#8ba39a]">
                No transactions recorded during {report.periodLabel}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category / Source</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2624]">
                    {report.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-[#151c19]">
                        <td className="py-3 px-4 font-mono tabular-nums text-[#8ba39a]">
                          {t.transaction_date}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={
                              t.type === 'income' ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
                            }
                          >
                            {t.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#e9efec] font-medium">{t.description}</td>
                        <td className="py-3 px-4 text-[#8ba39a]">
                          {t.type === 'income' ? t.income_source : t.category_name}
                        </td>
                        <td className="py-3 px-4 text-[#8ba39a]">{t.payment_method || '—'}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                            t.type === 'income' ? 'text-[#4ff0b7]' : 'text-[#e9efec]'
                          }`}
                        >
                          {formatInr(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
