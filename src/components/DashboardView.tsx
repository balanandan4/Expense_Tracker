import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Sparkles,
  Plus,
  ArrowUpRight,
  Calendar,
  Eye,
  X,
} from 'lucide-react';
import { DashboardData, Transaction, AiInsights } from '../types.ts';
import {
  apiFetch,
  formatInr,
  formatMonthLabel,
  AVAILABLE_MONTHS,
} from '../utils/format.ts';

interface DashboardViewProps {
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onNavigateTab: (tab: 'income' | 'expenses' | 'budgets' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedMonth,
  onChangeMonth,
  onNavigateTab,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Gemini AI Financial Analyst state
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>(
        `/api/dashboard?month=${encodeURIComponent(selectedMonth)}`
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchDashboard();
    setAiInsights(null);
  }, [fetchDashboard]);

  const handleRunAiAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiFetch<{ insights: AiInsights }>('/api/ai/analyze-finances', {
        method: 'POST',
        body: JSON.stringify({ month: selectedMonth }),
      });
      setAiInsights(res.insights);
    } catch (err: any) {
      setAiError(err.message || 'Gemini analysis unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-28 border border-[#1e2624] bg-[#101513] animate-pulse p-5"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-sm">
        {error || 'Unable to load dashboard.'}
      </div>
    );
  }

  const { summary, categoryBreakdown, monthlyTrend, budgetAnalysis, recentTransactions } = data;
  const exceededBudgets = budgetAnalysis.budgets.filter((b) => b.status === 'exceeded');
  const warningBudgets = budgetAnalysis.budgets.filter((b) => b.status === 'warning');
  const maxTrendVal = Math.max(
    1,
    ...monthlyTrend.map((m) => Math.max(m.income, m.expense))
  );

  return (
    <div className="space-y-6">
      {/* Period Control & Quick Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e2624]">
        <div>
          <div className="text-xs font-mono text-[#8ba39a]">
            REPORTING PERIOD · {formatMonthLabel(selectedMonth).toUpperCase()}
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            Personal Financial Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#101513] border border-[#1e2624] px-3 py-1.5">
            <Calendar className="w-4 h-4 text-[#4ff0b7]" />
            <label htmlFor="dash-month-select" className="text-xs font-mono text-[#8ba39a]">
              Month:
            </label>
            <select
              id="dash-month-select"
              value={selectedMonth}
              onChange={(e) => onChangeMonth(e.target.value)}
              className="bg-transparent text-xs font-mono text-[#e9efec] focus:outline-none cursor-pointer"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m} value={m} className="bg-[#101513] text-[#e9efec]">
                  {formatMonthLabel(m)} ({m})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('income')}
            className="px-3.5 py-2 text-xs font-mono bg-[#101513] text-[#e9efec] border border-[#1e2624] hover:border-[#4ff0b7] hover:text-[#4ff0b7] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Income
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('expenses')}
            className="px-3.5 py-2 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Expense
          </button>
        </div>
      </div>

      {/* Active Budget Utilization & Overspending Alert Banner */}
      {(exceededBudgets.length > 0 ||
        warningBudgets.length > 0 ||
        budgetAnalysis.unbudgetedCategories.length > 0) && (
        <div className="border border-[#f0b429]/50 bg-[#101513] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#f0b429]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                BUDGET UTILIZATION ALERTS FOR {formatMonthLabel(selectedMonth).toUpperCase()} (WARNING THRESHOLD: {summary.warningThreshold}%)
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('budgets')}
              className="text-xs font-mono text-[#4ff0b7] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              Manage Budgets <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {exceededBudgets.map((b) => (
              <div
                key={b.id}
                className="p-2.5 bg-[#ff6b6b]/10 border border-[#ff6b6b]/40 text-[#e9efec] flex items-center justify-between"
              >
                <span>
                  <strong className="text-[#ff6b6b]">Exceeded: {b.category_name}</strong> · Spent{' '}
                  {formatInr(b.actual_spending)} of {formatInr(b.budget_amount)}
                </span>
                <span className="font-mono text-[#ff6b6b] font-semibold tabular-nums">
                  {b.utilization_pct.toFixed(1)}% ({formatInr(b.remaining_budget)})
                </span>
              </div>
            ))}
            {warningBudgets.map((b) => (
              <div
                key={b.id}
                className="p-2.5 bg-[#f0b429]/10 border border-[#f0b429]/40 text-[#e9efec] flex items-center justify-between"
              >
                <span>
                  <strong className="text-[#f0b429]">Approaching Limit: {b.category_name}</strong> ·
                  Spent {formatInr(b.actual_spending)} of {formatInr(b.budget_amount)}
                </span>
                <span className="font-mono text-[#f0b429] font-semibold tabular-nums">
                  {b.utilization_pct.toFixed(1)}% ({formatInr(b.remaining_budget)} left)
                </span>
              </div>
            ))}
            {budgetAnalysis.unbudgetedCategories.map((u) => (
              <div
                key={u.category_id}
                className="p-2.5 bg-[#0a0d0c] border border-[#1e2624] text-[#8ba39a] flex items-center justify-between"
              >
                <span>
                  <strong className="text-[#e9efec]">Unbudgeted Spending: {u.category_name}</strong>{' '}
                  · {u.transaction_count} expense(s) with no monthly budget set
                </span>
                <span className="font-mono text-[#f0b429] tabular-nums">
                  {formatInr(u.actual_spending)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Total Income ({selectedMonth})</span>
            <TrendingUp className="w-4 h-4 text-[#4ff0b7]" />
          </div>
          <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
            {formatInr(summary.totalIncome)}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Sum of persisted income records in period
          </div>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Total Expenses ({selectedMonth})</span>
            <TrendingDown className="w-4 h-4 text-[#ff6b6b]" />
          </div>
          <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
            {formatInr(summary.totalExpenses)}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Sum of persisted expense records in period
          </div>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Period Net Savings</span>
            <Wallet className="w-4 h-4 text-[#4ff0b7]" />
          </div>
          <div
            className={`font-mono text-2xl font-semibold tabular-nums ${
              summary.netSavings >= 0 ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
            }`}
          >
            {formatInr(summary.netSavings)}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Total Income − Total Expenses (Period Net Figure)
          </div>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Transactions in Period</span>
            <span className="font-mono text-xs text-[#4ff0b7]">COUNT</span>
          </div>
          <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
            {summary.transactionCount}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Verified user records in {formatMonthLabel(selectedMonth)}
          </div>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Total Budget Allocated</span>
            <span className="font-mono text-xs text-[#8ba39a]">{selectedMonth}</span>
          </div>
          <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
            {formatInr(summary.totalBudgetAllocated)}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Across {budgetAnalysis.budgets.length} budgeted categories
          </div>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] p-5">
          <div className="flex items-center justify-between text-xs text-[#8ba39a] mb-2">
            <span>Aggregate Budget Utilization</span>
            <span
              className={`font-mono text-xs ${
                summary.budgetUtilizationPct >= 100
                  ? 'text-[#ff6b6b]'
                  : summary.budgetUtilizationPct >= summary.warningThreshold
                  ? 'text-[#f0b429]'
                  : 'text-[#4ff0b7]'
              }`}
            >
              {summary.budgetUtilizationPct >= 100
                ? 'Exceeded'
                : summary.budgetUtilizationPct >= summary.warningThreshold
                ? 'Approaching'
                : 'Nominal'}
            </span>
          </div>
          <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
            {summary.totalBudgetAllocated > 0
              ? `${summary.budgetUtilizationPct.toFixed(1)}%`
              : 'No Budget Set'}
          </div>
          <div className="text-xs text-[#5a6b65] mt-1.5">
            Budgeted spending: {formatInr(summary.totalBudgetedSpending)}
          </div>
        </div>
      </div>

      {/* Charts Row 1: 6-Month Income vs Expense Trend & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 6-Month Income vs Expense Trend Chart */}
        <div className="lg:col-span-7 border border-[#1e2624] bg-[#101513] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Income vs. Expense &amp; 6-Month Spending Trend
              </h2>
              <p className="text-xs text-[#8ba39a]">
                Monthly comparison ending {formatMonthLabel(selectedMonth)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-[#4ff0b7]">■ Income</span>
              <span className="text-[#ff6b6b]">■ Expense</span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 items-end h-52 pt-4 pb-2 border-b border-[#1e2624]">
            {monthlyTrend.map((m) => {
              const incHeight = Math.max(4, Math.round((m.income / maxTrendVal) * 160));
              const expHeight = Math.max(4, Math.round((m.expense / maxTrendVal) * 160));
              return (
                <div key={m.month} className="flex flex-col items-center h-full justify-end group">
                  <div className="flex items-end gap-1.5 w-full justify-center">
                    <div
                      title={`${m.label} Income: ${formatInr(m.income)}`}
                      style={{ height: `${incHeight}px` }}
                      className="w-3.5 sm:w-4 bg-[#4ff0b7] transition-opacity group-hover:opacity-90"
                    />
                    <div
                      title={`${m.label} Expense: ${formatInr(m.expense)}`}
                      style={{ height: `${expHeight}px` }}
                      className="w-3.5 sm:w-4 bg-[#ff6b6b] transition-opacity group-hover:opacity-90"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-6 gap-2 pt-2 text-center">
            {monthlyTrend.map((m) => (
              <div key={m.month} className="text-[11px] font-mono text-[#8ba39a]">
                <div>{m.label}</div>
                <div
                  className={`text-[10px] tabular-nums ${
                    m.netSavings >= 0 ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
                  }`}
                >
                  {formatInr(m.netSavings, false)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category-wise Expense Breakdown */}
        <div className="lg:col-span-5 border border-[#1e2624] bg-[#101513] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Category-Wise Expense Breakdown
              </h2>
              <p className="text-xs text-[#8ba39a]">
                Share of {formatInr(summary.totalExpenses)} total spending
              </p>
            </div>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8ba39a] border border-dashed border-[#1e2624]">
              No expenses recorded in {formatMonthLabel(selectedMonth)}.
            </div>
          ) : (
            <div className="space-y-3.5">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#e9efec] font-medium">{cat.category_name}</span>
                    <span className="font-mono text-[#8ba39a] tabular-nums">
                      {formatInr(cat.amount)} · {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0d0c] border border-[#1e2624] overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      className="h-full bg-[#4ff0b7]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category-Wise Budget vs. Actual Spending Utilization */}
      <div className="border border-[#1e2624] bg-[#101513] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Category-Wise Budget vs. Actual Spending ({selectedMonth})
            </h2>
            <p className="text-xs text-[#8ba39a]">
              Remaining = Budget − Actual · Utilization (%) = (Actual ÷ Budget) × 100
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('budgets')}
            className="text-xs font-mono text-[#4ff0b7] hover:underline cursor-pointer self-start sm:self-auto"
          >
            Configure Monthly Budgets →
          </button>
        </div>

        {budgetAnalysis.budgets.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#1e2624] text-xs text-[#8ba39a]">
            <p className="mb-3">No category budgets configured for {formatMonthLabel(selectedMonth)}.</p>
            <button
              type="button"
              onClick={() => onNavigateTab('budgets')}
              className="px-4 py-2 font-mono text-xs bg-[#4ff0b7] text-[#06120d] font-semibold cursor-pointer"
            >
              Set Monthly Budgets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetAnalysis.budgets.map((b) => {
              const barColor =
                b.status === 'exceeded'
                  ? 'bg-[#ff6b6b]'
                  : b.status === 'warning'
                  ? 'bg-[#f0b429]'
                  : 'bg-[#4ff0b7]';
              const statusText =
                b.status === 'exceeded'
                  ? 'Exceeded Limit'
                  : b.status === 'warning'
                  ? 'Approaching Limit'
                  : 'Nominal';

              return (
                <div key={b.id} className="p-4 border border-[#1e2624] bg-[#0a0d0c] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#e9efec]">
                      {b.category_name} ·{' '}
                      <span
                        className={
                          b.status === 'exceeded'
                            ? 'text-[#ff6b6b]'
                            : b.status === 'warning'
                            ? 'text-[#f0b429]'
                            : 'text-[#4ff0b7]'
                        }
                      >
                        {statusText}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-[#e9efec]">
                      {b.utilization_pct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-[#101513] border border-[#1e2624] overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, b.utilization_pct)}%` }}
                      className={`h-full ${barColor}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-[#8ba39a] tabular-nums">
                    <span>
                      Spent: {formatInr(b.actual_spending)} / {formatInr(b.budget_amount)}
                    </span>
                    <span
                      className={
                        b.remaining_budget < 0 ? 'text-[#ff6b6b]' : 'text-[#8ba39a]'
                      }
                    >
                      Remaining: {formatInr(b.remaining_budget)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gemini AI Financial Intelligence Panel */}
      <div className="border border-[#1e2624] bg-[#101513] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#4ff0b7]">
              <Sparkles className="w-4 h-4" />
              <span>GEMINI FINANCIAL INTELLIGENCE · REAL-TIME LEDGER AUDITOR</span>
            </div>
            <h2 className="font-display text-base font-semibold text-[#e9efec] mt-1">
              AI Spending &amp; Budget Optimization Analysis ({formatMonthLabel(selectedMonth)})
            </h2>
          </div>

          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={aiLoading}
            className="px-4 py-2 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {aiLoading ? 'Analyzing Ledger...' : 'Generate AI Budget Analysis'}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 p-3 border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-xs text-[#ff6b6b]">
            {aiError}
          </div>
        )}

        {aiInsights && (
          <div className="mt-5 pt-5 border-t border-[#1e2624] space-y-4 text-xs">
            <div className="p-4 border border-[#1e2624] bg-[#0a0d0c]">
              <div className="font-semibold text-[#4ff0b7] mb-1">{aiInsights.headline}</div>
              <p className="text-[#8ba39a]">{aiInsights.savingsAssessment}</p>
            </div>

            {aiInsights.priorityAlerts?.length > 0 && (
              <div>
                <div className="font-mono text-[#f0b429] mb-2">PRIORITY UTILIZATION FINDINGS</div>
                <ul className="space-y-1.5 text-[#8ba39a]">
                  {aiInsights.priorityAlerts.map((alert, i) => (
                    <li key={i} className="p-2.5 border border-[#1e2624] bg-[#0a0d0c]">
                      {alert}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiInsights.recommendations?.length > 0 && (
              <div>
                <div className="font-mono text-[#4ff0b7] mb-2">RECOMMENDED BUDGET ACTIONS</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {aiInsights.recommendations.map((rec, i) => (
                    <div key={i} className="p-3.5 border border-[#1e2624] bg-[#0a0d0c] space-y-1.5">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-[#e9efec] font-semibold">{rec.category}</span>
                        <span className="text-[#4ff0b7] tabular-nums">
                          Est. {formatInr(rec.estimatedMonthlyImpactInr)}/mo
                        </span>
                      </div>
                      <p className="text-[#8ba39a] leading-relaxed">{rec.suggestedAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Transactions List */}
      <div className="border border-[#1e2624] bg-[#101513]">
        <div className="p-5 border-b border-[#1e2624] flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Recent Transactions ({formatMonthLabel(selectedMonth)})
            </h2>
            <p className="text-xs text-[#8ba39a]">
              Showing latest entries recorded in the selected period
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <button
              type="button"
              onClick={() => onNavigateTab('income')}
              className="text-[#8ba39a] hover:text-[#4ff0b7] cursor-pointer"
            >
              All Income →
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => onNavigateTab('expenses')}
              className="text-[#4ff0b7] hover:underline cursor-pointer"
            >
              All Expenses →
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#8ba39a]">
            <p className="mb-3">No transactions recorded in {formatMonthLabel(selectedMonth)} yet.</p>
            <button
              type="button"
              onClick={() => onNavigateTab('expenses')}
              className="px-4 py-2 font-mono text-xs bg-[#4ff0b7] text-[#06120d] font-semibold cursor-pointer"
            >
              Log First Transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category / Source</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2624]">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#151c19] transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-[#8ba39a] whitespace-nowrap">
                      {tx.transaction_date}
                    </td>
                    <td className="py-3 px-4 text-[#e9efec] font-medium">{tx.description}</td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={
                          tx.type === 'income' ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
                        }
                      >
                        {tx.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#8ba39a]">
                      {tx.type === 'income' ? tx.income_source : tx.category_name}
                    </td>
                    <td className="py-3 px-4 text-[#8ba39a]">
                      {tx.payment_method || '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'income' ? 'text-[#4ff0b7]' : 'text-[#e9efec]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : ''}
                      {formatInr(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTx(tx)}
                        className="p-1 text-[#8ba39a] hover:text-[#4ff0b7] cursor-pointer"
                        title="View Transaction Details"
                      >
                        <Eye className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#1e2624] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2624]">
              <h3 className="font-display text-base font-semibold text-[#e9efec]">
                Transaction Record #{selectedTx.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">Type:</span>
                <span
                  className={
                    selectedTx.type === 'income' ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
                  }
                >
                  {selectedTx.type.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">Amount (INR):</span>
                <span className="text-[#e9efec] font-semibold tabular-nums">
                  {formatInr(selectedTx.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">Transaction Date:</span>
                <span className="text-[#e9efec] tabular-nums">{selectedTx.transaction_date}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">
                  {selectedTx.type === 'income' ? 'Income Source:' : 'Expense Category:'}
                </span>
                <span className="text-[#e9efec]">
                  {selectedTx.type === 'income'
                    ? selectedTx.income_source
                    : selectedTx.category_name}
                </span>
              </div>
              {selectedTx.type === 'expense' && (
                <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                  <span className="text-[#8ba39a]">Payment Method:</span>
                  <span className="text-[#e9efec]">{selectedTx.payment_method}</span>
                </div>
              )}
              <div className="py-1.5 border-b border-[#1e2624]">
                <div className="text-[#8ba39a] mb-1">Description:</div>
                <div className="text-[#e9efec] font-sans">{selectedTx.description}</div>
              </div>
              {selectedTx.notes && (
                <div className="py-1.5 border-b border-[#1e2624]">
                  <div className="text-[#8ba39a] mb-1">Notes:</div>
                  <div className="text-[#e9efec] font-sans">{selectedTx.notes}</div>
                </div>
              )}
              <div className="flex justify-between py-1 text-[11px] text-[#5a6b65]">
                <span>Recorded At:</span>
                <span>{selectedTx.created_at}</span>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 text-xs font-mono border border-[#1e2624] text-[#e9efec] hover:border-[#4ff0b7] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
