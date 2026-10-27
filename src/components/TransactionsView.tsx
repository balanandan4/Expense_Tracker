import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  Category,
  Transaction,
  PaymentMethod,
  PAYMENT_METHODS,
  INCOME_SOURCES,
} from '../types.ts';
import { apiFetch, formatInr } from '../utils/format.ts';

interface TransactionsViewProps {
  mode: 'income' | 'expense';
  categories: Category[];
  onDataChanged: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  mode,
  categories,
  onDataChanged,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState(0);
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  // Form state (Add or Edit)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [txDate, setTxDate] = useState('2026-10-27');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [incomeSource, setIncomeSource] = useState('Salary');
  const [notes, setNotes] = useState('');

  // Gemini Smart Entry state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiParsing, setAiParsing] = useState(false);

  // Feedback & Modals
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inspectTx, setInspectTx] = useState<Transaction | null>(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);

  const activeCategories = categories.filter((c) => c.is_active);

  useEffect(() => {
    if (activeCategories.length > 0 && !activeCategories.some((c) => c.id === categoryId)) {
      setCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, categoryId]);

  // Reset filters and form when switching between Income and Expense tabs
  useEffect(() => {
    setPage(1);
    setSearch('');
    setFilterCategory(0);
    setFilterPayment('');
    setFilterSource('');
    setStartDate('');
    setEndDate('');
    setEditingId(null);
    setError(null);
    setSuccess(null);
  }, [mode]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: mode,
        page: String(page),
        limit: '10',
        sort_by: sortBy,
      });
      if (search.trim()) params.set('search', search.trim());
      if (mode === 'expense' && filterCategory > 0) {
        params.set('category_id', String(filterCategory));
      }
      if (mode === 'expense' && filterPayment) {
        params.set('payment_method', filterPayment);
      }
      if (mode === 'income' && filterSource) {
        params.set('income_source', filterSource);
      }
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await apiFetch(`/api/transactions?${params.toString()}`);
      setTransactions(res.transactions || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.totalCount || 0);
      setFilteredTotal(
        mode === 'income'
          ? res.filteredTotals?.income || 0
          : res.filteredTotals?.expense || 0
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [mode, page, sortBy, search, filterCategory, filterPayment, filterSource, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const resetForm = () => {
    setEditingId(null);
    setTxDate('2026-10-27');
    setDescription('');
    setAmount('');
    if (activeCategories.length > 0) setCategoryId(activeCategories[0].id);
    setPaymentMethod('UPI');
    setIncomeSource('Salary');
    setNotes('');
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setTxDate(tx.transaction_date);
    setDescription(tx.description);
    setAmount(String(tx.amount));
    if (tx.type === 'expense' && tx.category_id) {
      setCategoryId(tx.category_id);
    }
    if (tx.type === 'expense' && tx.payment_method) {
      setPaymentMethod(tx.payment_method);
    }
    if (tx.type === 'income' && tx.income_source) {
      setIncomeSource(tx.income_source);
    }
    setNotes(tx.notes || '');
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAiSmartParse = async () => {
    if (!aiPrompt.trim()) return;
    setAiParsing(true);
    setError(null);
    try {
      const res = await apiFetch('/api/ai/parse-transaction', {
        method: 'POST',
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const p = res.parsed;
      if (p) {
        if (p.transaction_date) setTxDate(p.transaction_date);
        if (p.description) setDescription(p.description);
        if (p.amount > 0) setAmount(String(p.amount));
        if (mode === 'expense') {
          if (p.category_id) setCategoryId(Number(p.category_id));
          if (p.payment_method) setPaymentMethod(p.payment_method);
        } else if (p.income_source) {
          setIncomeSource(p.income_source);
        }
        if (p.notes) setNotes(p.notes);
        setSuccess('Gemini parsed your entry into the form below. Review and click Save.');
        setAiPrompt('');
      }
    } catch (err: any) {
      setError(err.message || 'Could not parse entry with Gemini AI.');
    } finally {
      setAiParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount greater than ₹0.00.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        type: mode,
        transaction_date: txDate,
        description: description.trim(),
        amount: numAmount,
        category_id: mode === 'expense' ? categoryId : null,
        payment_method: mode === 'expense' ? paymentMethod : null,
        income_source: mode === 'income' ? incomeSource.trim() : null,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const res = await apiFetch(`/api/transactions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccess(res.message || 'Record updated.');
      } else {
        const res = await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(res.message || 'Record created.');
      }

      resetForm();
      await fetchTransactions();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTx) return;
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/transactions/${deleteConfirmTx.id}`, {
        method: 'DELETE',
      });
      setDeleteConfirmTx(null);
      setSuccess('Transaction deleted permanently. Budgets and totals updated.');
      await fetchTransactions();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to delete transaction.');
      setDeleteConfirmTx(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e2624]">
        <div>
          <div className="text-xs font-mono text-[#4ff0b7]">
            {mode === 'income'
              ? 'MODULE 02 · INCOME MANAGEMENT (INR)'
              : 'MODULE 03 · EXPENSE MANAGEMENT & CATEGORIZATION (INR)'}
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            {mode === 'income' ? 'Income Ledger & Sources' : 'Daily Expense Tracker'}
          </h1>
        </div>

        <div className="border border-[#1e2624] bg-[#101513] px-4 py-2.5 text-right">
          <div className="text-[11px] font-mono text-[#8ba39a]">
            FILTERED {mode.toUpperCase()} TOTAL ({totalCount} RECORDS)
          </div>
          <div
            className={`font-mono text-lg font-semibold tabular-nums ${
              mode === 'income' ? 'text-[#4ff0b7]' : 'text-[#e9efec]'
            }`}
          >
            {formatInr(filteredTotal)}
          </div>
        </div>
      </div>

      {/* Gemini Smart Natural-Language Quick Fill Bar */}
      <div className="border border-[#1e2624] bg-[#101513] p-4">
        <div className="flex items-center gap-2 text-xs font-mono text-[#4ff0b7] mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>GEMINI SMART ENTRY PARSER · AUTO-FILL FORM FROM NATURAL TEXT</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={
              mode === 'expense'
                ? 'e.g., "Paid ₹1,450 for TANGEDCO electricity bill via UPI on 2026-10-25"'
                : 'e.g., "Received ₹45,000 October salary credit via NEFT on 2026-10-01"'
            }
            className="flex-1 px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
          />
          <button
            type="button"
            onClick={handleAiSmartParse}
            disabled={aiParsing || !aiPrompt.trim()}
            className="px-4 py-2 text-xs font-mono font-semibold bg-[#101513] text-[#4ff0b7] border border-[#2c8a68] hover:bg-[#4ff0b7] hover:text-[#06120d] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {aiParsing ? 'Parsing...' : 'Auto-Fill Fields'}
          </button>
        </div>
      </div>

      {/* Add / Edit Transaction Form */}
      <div className="border border-[#1e2624] bg-[#101513] p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1e2624]">
          <h2 className="font-display text-base font-semibold text-[#e9efec]">
            {editingId
              ? `Edit ${mode === 'income' ? 'Income' : 'Expense'} Record #${editingId}`
              : `Record New ${mode === 'income' ? 'Income' : 'Expense'}`}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <label htmlFor="tx-date" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Transaction Date *
            </label>
            <input
              id="tx-date"
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="tx-amount" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Amount in INR (₹) *
            </label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          {mode === 'income' ? (
            <div className="lg:col-span-6">
              <label htmlFor="tx-source" className="block text-xs font-mono text-[#8ba39a] mb-1">
                Income Source *
              </label>
              <select
                id="tx-source"
                value={incomeSource}
                onChange={(e) => setIncomeSource(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              >
                {INCOME_SOURCES.map((src) => (
                  <option key={src} value={src} className="bg-[#101513]">
                    {src}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="lg:col-span-3">
                <label htmlFor="tx-cat" className="block text-xs font-mono text-[#8ba39a] mb-1">
                  Expense Category *
                </label>
                <select
                  id="tx-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#101513]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label htmlFor="tx-payment" className="block text-xs font-mono text-[#8ba39a] mb-1">
                  Payment Method *
                </label>
                <select
                  id="tx-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm} className="bg-[#101513]">
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="lg:col-span-6">
            <label htmlFor="tx-desc" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Description *
            </label>
            <input
              id="tx-desc"
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                mode === 'income'
                  ? 'e.g., Monthly Software Engineering Stipend'
                  : 'e.g., Nilgiris Supermarket Groceries'
              }
              className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="tx-notes" className="block text-xs font-mono text-[#8ba39a] mb-1">
              Optional Notes
            </label>
            <input
              id="tx-notes"
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference number or memo"
              className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          <div className="lg:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="border border-[#1e2624] bg-[#101513] p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-[#5a6b65] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search description or notes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
            />
          </div>

          {mode === 'expense' ? (
            <>
              <div>
                <select
                  aria-label="Filter by category"
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(Number(e.target.value));
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                >
                  <option value={0}>All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.is_active ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  aria-label="Filter by payment method"
                  value={filterPayment}
                  onChange={(e) => {
                    setFilterPayment(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                >
                  <option value="">All Payment Methods</option>
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="lg:col-span-2">
              <select
                aria-label="Filter by income source"
                value={filterSource}
                onChange={(e) => {
                  setFilterSource(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              >
                <option value="">All Income Sources</option>
                {INCOME_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <input
              type="date"
              aria-label="From date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Sort order"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec]"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="amount_desc">Amount: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="border border-[#1e2624] bg-[#101513]">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-[#8ba39a]">
            Loading {mode} records...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#8ba39a]">
            No {mode} transactions match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">
                    {mode === 'income' ? 'Income Source' : 'Category'}
                  </th>
                  {mode === 'expense' && <th className="py-3 px-4">Payment Method</th>}
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2624]">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#151c19] transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-[#8ba39a] whitespace-nowrap">
                      {tx.transaction_date}
                    </td>
                    <td className="py-3 px-4 text-[#e9efec] font-medium">{tx.description}</td>
                    <td className="py-3 px-4 text-[#8ba39a]">
                      {mode === 'income' ? tx.income_source : tx.category_name}
                    </td>
                    {mode === 'expense' && (
                      <td className="py-3 px-4 text-[#8ba39a]">{tx.payment_method}</td>
                    )}
                    <td className="py-3 px-4 text-[#5a6b65] max-w-xs truncate">
                      {tx.notes || '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        mode === 'income' ? 'text-[#4ff0b7]' : 'text-[#e9efec]'
                      }`}
                    >
                      {formatInr(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectTx(tx)}
                          className="p-1 text-[#8ba39a] hover:text-[#4ff0b7] cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tx)}
                          className="p-1 text-[#8ba39a] hover:text-[#f0b429] cursor-pointer"
                          title="Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTx(tx)}
                          className="p-1 text-[#8ba39a] hover:text-[#ff6b6b] cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-[#1e2624] flex items-center justify-between text-xs font-mono text-[#8ba39a]">
          <div>
            Page {page} of {totalPages} · {totalCount} total record(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-[#1e2624] bg-[#0a0d0c] hover:border-[#4ff0b7] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border border-[#1e2624] bg-[#0a0d0c] hover:border-[#4ff0b7] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* View Transaction Details Modal */}
      {inspectTx && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#1e2624] w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2624]">
              <h3 className="font-display text-base font-semibold text-[#e9efec]">
                Transaction Details · ID #{inspectTx.id}
              </h3>
              <button
                type="button"
                onClick={() => setInspectTx(null)}
                className="text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">Date:</span>
                <span className="text-[#e9efec]">{inspectTx.transaction_date}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">Amount:</span>
                <span className="text-[#4ff0b7] font-semibold tabular-nums">
                  {formatInr(inspectTx.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                <span className="text-[#8ba39a]">
                  {inspectTx.type === 'income' ? 'Income Source:' : 'Category:'}
                </span>
                <span className="text-[#e9efec]">
                  {inspectTx.type === 'income'
                    ? inspectTx.income_source
                    : inspectTx.category_name}
                </span>
              </div>
              {inspectTx.type === 'expense' && (
                <div className="flex justify-between py-1.5 border-b border-[#1e2624]">
                  <span className="text-[#8ba39a]">Payment Method:</span>
                  <span className="text-[#e9efec]">{inspectTx.payment_method}</span>
                </div>
              )}
              <div className="py-1.5 border-b border-[#1e2624]">
                <div className="text-[#8ba39a] mb-1">Description:</div>
                <div className="text-[#e9efec] font-sans">{inspectTx.description}</div>
              </div>
              <div className="py-1.5">
                <div className="text-[#8ba39a] mb-1">Notes:</div>
                <div className="text-[#e9efec] font-sans">{inspectTx.notes || 'None'}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const t = inspectTx;
                  setInspectTx(null);
                  handleStartEdit(t);
                }}
                className="px-3.5 py-1.5 text-xs font-mono border border-[#1e2624] text-[#f0b429] hover:border-[#f0b429] cursor-pointer"
              >
                Edit Record
              </button>
              <button
                type="button"
                onClick={() => setInspectTx(null)}
                className="px-3.5 py-1.5 text-xs font-mono bg-[#4ff0b7] text-[#06120d] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#ff6b6b]/50 w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#ff6b6b]">
              Confirm Permanent Deletion
            </h3>
            <p className="text-xs text-[#8ba39a] leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-[#e9efec]">{deleteConfirmTx.description}</strong> (
              <span className="font-mono text-[#e9efec]">
                {formatInr(deleteConfirmTx.amount)}
              </span>{' '}
              on {deleteConfirmTx.transaction_date})? Dashboard summaries, monthly budget
              utilization, and reports will recalculate immediately.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTx(null)}
                className="px-4 py-2 text-xs font-mono border border-[#1e2624] text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-mono font-semibold bg-[#ff6b6b] text-[#0a0d0c] hover:opacity-90 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
