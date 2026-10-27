import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Category, MonthlyBudgetAnalysis, BudgetAnalysisRow } from '../types.ts';
import {
  apiFetch,
  formatInr,
  formatMonthLabel,
  AVAILABLE_MONTHS,
} from '../utils/format.ts';

interface BudgetsViewProps {
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  categories: Category[];
  onDataChanged: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  selectedMonth,
  onChangeMonth,
  categories,
  onDataChanged,
}) => {
  const [analysis, setAnalysis] = useState<MonthlyBudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create / Edit Budget Form
  const [editingBudget, setEditingBudget] = useState<BudgetAnalysisRow | null>(null);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BudgetAnalysisRow | null>(null);

  const activeCategories = categories.filter((c) => c.is_active);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<MonthlyBudgetAnalysis>(
        `/api/budgets?month=${encodeURIComponent(selectedMonth)}`
      );
      setAnalysis(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load budget analysis.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchBudgets();
    setEditingBudget(null);
    setBudgetAmount('');
  }, [fetchBudgets]);

  // Select first unbudgeted active category by default when creating
  useEffect(() => {
    if (!editingBudget && analysis && activeCategories.length > 0) {
      const budgetedIds = new Set(analysis.budgets.map((b) => b.category_id));
      const firstUnbudgeted = activeCategories.find((c) => !budgetedIds.has(c.id));
      if (firstUnbudgeted) {
        setCategoryId(firstUnbudgeted.id);
      } else {
        setCategoryId(activeCategories[0].id);
      }
    }
  }, [analysis, editingBudget, activeCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amt = parseFloat(budgetAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Budget amount must be greater than ₹0.00.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingBudget) {
        const res = await apiFetch(`/api/budgets/${editingBudget.id}`, {
          method: 'PUT',
          body: JSON.stringify({ budget_amount: amt }),
        });
        setAnalysis(res.analysis);
        setSuccess(res.message || 'Budget updated.');
        setEditingBudget(null);
        setBudgetAmount('');
      } else {
        const res = await apiFetch('/api/budgets', {
          method: 'POST',
          body: JSON.stringify({
            category_id: categoryId,
            budget_month: selectedMonth,
            budget_amount: amt,
          }),
        });
        setAnalysis(res.analysis);
        setSuccess(res.message || 'Monthly budget created.');
        setBudgetAmount('');
      }
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save budget.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch(`/api/budgets/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setAnalysis(res.analysis);
      setDeleteTarget(null);
      setSuccess('Monthly category budget removed.');
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to delete budget.');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e2624]">
        <div>
          <div className="text-xs font-mono text-[#4ff0b7]">
            MODULE 04 &amp; 05 · MONTHLY BUDGET PLANNING &amp; UTILIZATION ANALYSIS
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            Budget vs. Actual Spending ({formatMonthLabel(selectedMonth)})
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-[#101513] border border-[#1e2624] px-3 py-2 self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-[#4ff0b7]" />
          <label htmlFor="budget-month-select" className="text-xs font-mono text-[#8ba39a]">
            Budget Month:
          </label>
          <select
            id="budget-month-select"
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
      </div>

      {/* Aggregate Monthly Budget Summary Strip */}
      {analysis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Total Budget Allocated</div>
            <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
              {formatInr(analysis.totalBudgetAllocated)}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Across {analysis.budgets.length} budgeted categories
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Actual Budgeted Spending</div>
            <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
              {formatInr(analysis.totalBudgetedSpending)}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Total month spending: {formatInr(analysis.totalMonthSpending)}
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Remaining Budgeted Balance</div>
            <div
              className={`font-mono text-2xl font-semibold tabular-nums ${
                analysis.totalRemainingBudget >= 0 ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'
              }`}
            >
              {formatInr(analysis.totalRemainingBudget)}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Formula: Budget Allocated − Budgeted Spending
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Aggregate Utilization Ratio</div>
            <div
              className={`font-mono text-2xl font-semibold tabular-nums ${
                analysis.aggregateUtilizationPct >= 100
                  ? 'text-[#ff6b6b]'
                  : analysis.aggregateUtilizationPct >= analysis.warningThreshold
                  ? 'text-[#f0b429]'
                  : 'text-[#4ff0b7]'
              }`}
            >
              {analysis.totalBudgetAllocated > 0
                ? `${analysis.aggregateUtilizationPct.toFixed(1)}%`
                : '0.0%'}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Warning threshold configured at {analysis.warningThreshold}%
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Monthly Category Budget Form */}
      <div className="border border-[#1e2624] bg-[#101513] p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1e2624]">
          <h2 className="font-display text-base font-semibold text-[#e9efec]">
            {editingBudget
              ? `Edit Monthly Budget for ${editingBudget.category_name} (${editingBudget.budget_month})`
              : `Allocate Monthly Category Budget for ${formatMonthLabel(selectedMonth)}`}
          </h2>
          {editingBudget && (
            <button
              type="button"
              onClick={() => {
                setEditingBudget(null);
                setBudgetAmount('');
              }}
              className="text-xs font-mono text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 border border-[#2c8a68] bg-[#4ff0b7]/10 text-[#4ff0b7] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <label htmlFor="budget-cat" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Expense Category *
            </label>
            <select
              id="budget-cat"
              disabled={!!editingBudget}
              value={editingBudget ? editingBudget.category_id : categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] disabled:opacity-60"
            >
              {activeCategories.map((c) => {
                const alreadySet = analysis?.budgets.some((b) => b.category_id === c.id);
                return (
                  <option key={c.id} value={c.id} className="bg-[#101513]">
                    {c.name} {alreadySet && !editingBudget ? '(Already budgeted)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="budget-amt" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Monthly Budget Limit in INR (₹) *
            </label>
            <input
              id="budget-amt"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              placeholder="e.g., 8000.00"
              className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? 'Saving...' : editingBudget ? 'Update Limit' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>

      {/* Unbudgeted Categories with Expenses Warning Section */}
      {analysis && analysis.unbudgetedCategories.length > 0 && (
        <div className="border border-[#f0b429]/50 bg-[#101513] p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#f0b429]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              CATEGORIES WITH EXPENSES IN {selectedMonth} BUT NO BUDGET ALLOCATED
            </span>
          </div>
          <p className="text-xs text-[#8ba39a]">
            The following categories have recorded expenses during {formatMonthLabel(selectedMonth)}{' '}
            without a planned monthly budget target:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.unbudgetedCategories.map((u) => (
              <div
                key={u.category_id}
                className="p-3.5 border border-[#1e2624] bg-[#0a0d0c] flex items-center justify-between gap-3"
              >
                <div className="text-xs">
                  <div className="font-semibold text-[#e9efec]">{u.category_name}</div>
                  <div className="text-[#8ba39a] font-mono mt-0.5 tabular-nums">
                    Actual Spending: {formatInr(u.actual_spending)} ({u.transaction_count}{' '}
                    transaction{u.transaction_count > 1 ? 's' : ''})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBudget(null);
                    setCategoryId(u.category_id);
                    setBudgetAmount(String(Math.ceil(u.actual_spending / 500) * 500));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 text-xs font-mono text-[#4ff0b7] border border-[#2c8a68] hover:bg-[#4ff0b7] hover:text-[#06120d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Set Budget →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget vs. Actual Table */}
      <div className="border border-[#1e2624] bg-[#101513]">
        <div className="p-5 border-b border-[#1e2624]">
          <h2 className="font-display text-base font-semibold text-[#e9efec]">
            Category Budget Utilization Ledger ({formatMonthLabel(selectedMonth)})
          </h2>
          <p className="text-xs text-[#8ba39a]">
            Includes categories with active spending as well as budgeted categories with ₹0.00
            expenses
          </p>
        </div>

        {loading || !analysis ? (
          <div className="p-8 text-center text-xs font-mono text-[#8ba39a]">
            Calculating monthly budget utilization...
          </div>
        ) : analysis.budgets.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#8ba39a]">
            No category budgets have been set for {formatMonthLabel(selectedMonth)}. Use the form
            above to create your first monthly budget.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Planned Budget</th>
                  <th className="py-3 px-4 text-right">Actual Spending</th>
                  <th className="py-3 px-4 text-right">Remaining</th>
                  <th className="py-3 px-4">Utilization (%)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2624]">
                {analysis.budgets.map((b) => {
                  const barColor =
                    b.status === 'exceeded'
                      ? 'bg-[#ff6b6b]'
                      : b.status === 'warning'
                      ? 'bg-[#f0b429]'
                      : 'bg-[#4ff0b7]';
                  const statusLabel =
                    b.status === 'exceeded'
                      ? 'Exceeded (≥100%)'
                      : b.status === 'warning'
                      ? `Approaching (≥${analysis.warningThreshold}%)`
                      : b.actual_spending === 0
                      ? 'No Expenses (0%)'
                      : 'Nominal';

                  return (
                    <tr key={b.id} className="hover:bg-[#151c19] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#e9efec]">
                        {b.category_name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#e9efec]">
                        {formatInr(b.budget_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                        {formatInr(b.actual_spending)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono tabular-nums font-semibold ${
                          b.remaining_budget < 0 ? 'text-[#ff6b6b]' : 'text-[#4ff0b7]'
                        }`}
                      >
                        {formatInr(b.remaining_budget)}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#0a0d0c] border border-[#1e2624] overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, b.utilization_pct)}%` }}
                              className={`h-full ${barColor}`}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-[#e9efec] w-12 text-right">
                            {b.utilization_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span
                          className={
                            b.status === 'exceeded'
                              ? 'text-[#ff6b6b]'
                              : b.status === 'warning'
                              ? 'text-[#f0b429]'
                              : 'text-[#8ba39a]'
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBudget(b);
                              setBudgetAmount(String(b.budget_amount));
                              setError(null);
                              setSuccess(null);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1 text-[#8ba39a] hover:text-[#f0b429] cursor-pointer"
                            title="Edit Budget Limit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(b)}
                            className="p-1 text-[#8ba39a] hover:text-[#ff6b6b] cursor-pointer"
                            title="Delete Budget"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Budget Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#ff6b6b]/50 w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#ff6b6b]">
              Remove Monthly Budget Target
            </h3>
            <p className="text-xs text-[#8ba39a] leading-relaxed">
              Remove the{' '}
              <strong className="text-[#e9efec]">{formatInr(deleteTarget.budget_amount)}</strong>{' '}
              budget for <strong className="text-[#e9efec]">{deleteTarget.category_name}</strong> in{' '}
              {deleteTarget.budget_month}? Existing expense transactions in this category will
              remain intact.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-mono border border-[#1e2624] text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-mono font-semibold bg-[#ff6b6b] text-[#0a0d0c] cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
