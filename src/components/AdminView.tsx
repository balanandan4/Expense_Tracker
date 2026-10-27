import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Tags,
  Settings,
  FileText,
  Plus,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Category } from '../types.ts';
import { apiFetch, formatInr } from '../utils/format.ts';

interface AdminViewProps {
  currentAdminId: number;
  onCategoriesChanged: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentAdminId,
  onCategoriesChanged,
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'users' | 'categories' | 'settings' | 'audit'>(
    'overview'
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Category Form State
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);

  // Settings Form State
  const [warningThreshold, setWarningThreshold] = useState('80');
  const [allowReg, setAllowReg] = useState('1');
  const [maxAttempts, setMaxAttempts] = useState('5');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const q = userSearch.trim()
        ? `?search=${encodeURIComponent(userSearch.trim())}`
        : '';
      const res = await apiFetch(`/api/admin/overview${q}`);
      setData(res);

      if (res.settings) {
        const thresh = res.settings.find(
          (s: any) => s.setting_key === 'budget_warning_threshold'
        )?.setting_value;
        const reg = res.settings.find(
          (s: any) => s.setting_key === 'allow_registration'
        )?.setting_value;
        const maxA = res.settings.find(
          (s: any) => s.setting_key === 'login_max_attempts'
        )?.setting_value;
        if (thresh) setWarningThreshold(thresh);
        if (reg) setAllowReg(reg);
        if (maxA) setMaxAttempts(maxA);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator console.');
    } finally {
      setLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleToggleUserStatus = async (userId: number, currentStatus: string) => {
    setError(null);
    setSuccess(null);
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccess(res.message);
      await fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status.');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCatSubmitting(true);
    try {
      if (editingCat) {
        const res = await apiFetch(`/api/admin/categories/${editingCat.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: catName.trim(),
            description: catDesc.trim(),
            is_active: editingCat.is_active,
          }),
        });
        setSuccess(res.message);
        setEditingCat(null);
      } else {
        const res = await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: catName.trim(),
            description: catDesc.trim(),
          }),
        });
        setSuccess(res.message);
      }
      setCatName('');
      setCatDesc('');
      await fetchAdminData();
      onCategoriesChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save category.');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleToggleCategoryActive = async (cat: Category) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: cat.name,
          description: cat.description,
          is_active: !cat.is_active,
        }),
      });
      setSuccess(res.message);
      await fetchAdminData();
      onCategoriesChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to update category state.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSettingsSaving(true);
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          budget_warning_threshold: Number(warningThreshold),
          allow_registration: allowReg,
          login_max_attempts: Number(maxAttempts),
        }),
      });
      setSuccess(res.message);
      await fetchAdminData();
      onCategoriesChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const stats = data?.aggregateStats;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1e2624]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#f0b429]">
            <ShieldCheck className="w-4 h-4" />
            <span>PROTECTED ADMINISTRATOR CONSOLE · SERVER-SIDE RBAC ENFORCED</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#e9efec] mt-0.5">
            System Administration &amp; Governance
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#101513] border border-[#1e2624]">
          {[
            { id: 'overview', label: 'Aggregate Overview', icon: ShieldCheck },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'categories', label: 'Categories', icon: Tags },
            { id: 'settings', label: 'System Settings', icon: Settings },
            { id: 'audit', label: 'Audit Logs', icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSubTab(item.id as any);
                  setError(null);
                  setSuccess(null);
                }}
                className={`px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  subTab === item.id
                    ? 'bg-[#4ff0b7] text-[#06120d] font-semibold'
                    : 'text-[#8ba39a] hover:text-[#e9efec]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 border border-[#2c8a68] bg-[#4ff0b7]/10 text-[#4ff0b7] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Aggregate KPI Cards (Always visible or in Overview) */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Registered User Accounts</div>
            <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
              {stats.totalUsers}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              {stats.activeUsers} active · {stats.inactiveUsers} inactive
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">Expense Categories</div>
            <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
              {stats.totalCategories}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              {stats.activeCategories} active for new expenses
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">System-Wide Transactions</div>
            <div className="font-mono text-2xl font-semibold text-[#e9efec] tabular-nums">
              {stats.totalTransactions}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Aggregate transaction volume across all users
            </div>
          </div>

          <div className="border border-[#1e2624] bg-[#101513] p-5">
            <div className="text-xs text-[#8ba39a] mb-1">
              Aggregate System Expense Volume
            </div>
            <div className="font-mono text-2xl font-semibold text-[#f0b429] tabular-nums">
              {formatInr(stats.aggregateSystemExpenses)}
            </div>
            <div className="text-xs text-[#5a6b65] mt-1">
              Aggregate Income: {formatInr(stats.aggregateSystemIncome)}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: AGGREGATE OVERVIEW & CATEGORY USAGE */}
      {subTab === 'overview' && data && (
        <div className="border border-[#1e2624] bg-[#101513]">
          <div className="p-5 border-b border-[#1e2624]">
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Category Usage &amp; Aggregate Financial Statistics
            </h2>
            <p className="text-xs text-[#8ba39a]">
              System-level activity summary (individual private descriptions and passwords are never
              exposed)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Referenced Transactions</th>
                  <th className="py-3 px-4 text-right">Referenced Budgets</th>
                  <th className="py-3 px-4 text-right">Aggregate Category Spend (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2624]">
                {data.categories.map((c: Category) => (
                  <tr key={c.id} className="hover:bg-[#151c19]">
                    <td className="py-3 px-4 font-mono text-[#8ba39a]">#{c.id}</td>
                    <td className="py-3 px-4 font-medium text-[#e9efec]">{c.name}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={c.is_active ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                      {c.transaction_count || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                      {c.budget_count || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#e9efec]">
                      {formatInr(c.aggregate_spent || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: USER MANAGEMENT */}
      {subTab === 'users' && data && (
        <div className="border border-[#1e2624] bg-[#101513]">
          <div className="p-5 border-b border-[#1e2624] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Registered User Accounts
              </h2>
              <p className="text-xs text-[#8ba39a]">
                Activate or deactivate accounts. Passwords and password hashes are strictly omitted.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#5a6b65] absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name or email..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Records</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Account Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2624]">
                {data.users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-[#151c19]">
                    <td className="py-3 px-4 font-mono text-[#8ba39a]">#{u.id}</td>
                    <td className="py-3 px-4 font-medium text-[#e9efec]">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-[#8ba39a]">{u.email}</td>
                    <td className="py-3 px-4 font-mono">
                      <span className={u.role === 'admin' ? 'text-[#f0b429]' : 'text-[#8ba39a]'}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={u.status === 'active' ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'}
                      >
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                      {u.transaction_count} tx · {u.budget_count} budgets
                    </td>
                    <td className="py-3 px-4 font-mono text-[#5a6b65]">{u.created_at}</td>
                    <td className="py-3 px-4 text-right">
                      {u.id === currentAdminId ? (
                        <span className="font-mono text-[11px] text-[#5a6b65]">Current Admin</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className={`px-3 py-1 text-xs font-mono border cursor-pointer transition-colors ${
                            u.status === 'active'
                              ? 'border-[#ff6b6b]/50 text-[#ff6b6b] hover:bg-[#ff6b6b]/10'
                              : 'border-[#2c8a68] text-[#4ff0b7] hover:bg-[#4ff0b7]/10'
                          }`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CATEGORY ADMINISTRATION */}
      {subTab === 'categories' && data && (
        <div className="space-y-6">
          <div className="border border-[#1e2624] bg-[#101513] p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1e2624]">
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                {editingCat
                  ? `Edit Expense Category #${editingCat.id}`
                  : 'Create New Expense Category'}
              </h2>
              {editingCat && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCat(null);
                    setCatName('');
                    setCatDesc('');
                  }}
                  className="text-xs font-mono text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form
              onSubmit={handleSaveCategory}
              className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end"
            >
              <div className="sm:col-span-4">
                <label htmlFor="cat-name" className="block text-xs font-mono text-[#8ba39a] mb-1">
                  Category Name (Case-Insensitive Unique) *
                </label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g., Subscriptions or Insurance"
                  className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                />
              </div>

              <div className="sm:col-span-5">
                <label htmlFor="cat-desc" className="block text-xs font-mono text-[#8ba39a] mb-1">
                  Category Description
                </label>
                <input
                  id="cat-desc"
                  type="text"
                  maxLength={255}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Optional scope description"
                  className="w-full px-3 py-2 text-xs bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="w-full py-2 px-4 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {catSubmitting ? 'Saving...' : editingCat ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>

          <div className="border border-[#1e2624] bg-[#101513]">
            <div className="p-5 border-b border-[#1e2624]">
              <h2 className="font-display text-base font-semibold text-[#e9efec]">
                Managed Expense Categories
              </h2>
              <p className="text-xs text-[#8ba39a]">
                Categories referenced by transactions are soft-deactivated rather than deleted so
                historical reports never break.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Historical References</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2624]">
                  {data.categories.map((c: Category) => (
                    <tr key={c.id} className="hover:bg-[#151c19]">
                      <td className="py-3 px-4 font-mono text-[#8ba39a]">#{c.id}</td>
                      <td className="py-3 px-4 font-medium text-[#e9efec]">{c.name}</td>
                      <td className="py-3 px-4 text-[#8ba39a]">{c.description}</td>
                      <td className="py-3 px-4 font-mono">
                        <span className={c.is_active ? 'text-[#4ff0b7]' : 'text-[#ff6b6b]'}>
                          {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8ba39a]">
                        {c.transaction_count || 0} tx · {c.budget_count || 0} budgets
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCat(c);
                            setCatName(c.name);
                            setCatDesc(c.description);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 text-xs font-mono border border-[#1e2624] text-[#f0b429] hover:border-[#f0b429] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryActive(c)}
                          className={`px-2.5 py-1 text-xs font-mono border cursor-pointer ${
                            c.is_active
                              ? 'border-[#ff6b6b]/40 text-[#ff6b6b] hover:bg-[#ff6b6b]/10'
                              : 'border-[#2c8a68] text-[#4ff0b7] hover:bg-[#4ff0b7]/10'
                          }`}
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SYSTEM SETTINGS */}
      {subTab === 'settings' && (
        <div className="border border-[#1e2624] bg-[#101513] p-6 max-w-2xl">
          <div className="pb-4 mb-5 border-b border-[#1e2624]">
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Approved System Configuration
            </h2>
            <p className="text-xs text-[#8ba39a]">
              Modify safe application parameters. All changes are recorded in the administrative
              audit log.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label
                htmlFor="set-threshold"
                className="block text-xs font-mono text-[#e9efec] mb-1"
              >
                Approaching-Budget Warning Threshold (%) [50 – 99]
              </label>
              <input
                id="set-threshold"
                type="number"
                min={50}
                max={99}
                required
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
              />
              <p className="text-[11px] text-[#5a6b65] mt-1">
                Default is 80%. Categories reaching this utilization percentage trigger an amber
                Approaching Limit warning.
              </p>
            </div>

            <div>
              <label htmlFor="set-reg" className="block text-xs font-mono text-[#e9efec] mb-1">
                Public Account Registration
              </label>
              <select
                id="set-reg"
                value={allowReg}
                onChange={(e) => setAllowReg(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec]"
              >
                <option value="1">Enabled (Guests can register new User accounts)</option>
                <option value="0">Disabled (Only existing accounts can sign in)</option>
              </select>
            </div>

            <div>
              <label htmlFor="set-attempts" className="block text-xs font-mono text-[#e9efec] mb-1">
                Login Throttling Max Failed Attempts (per 15-minute window)
              </label>
              <input
                id="set-attempts"
                type="number"
                min={3}
                max={15}
                required
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec]"
              />
            </div>

            <button
              type="submit"
              disabled={settingsSaving}
              className="px-5 py-2.5 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors cursor-pointer"
            >
              {settingsSaving ? 'Saving Settings...' : 'Save System Settings'}
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 5: AUDIT LOGS */}
      {subTab === 'audit' && data && (
        <div className="border border-[#1e2624] bg-[#101513]">
          <div className="p-5 border-b border-[#1e2624]">
            <h2 className="font-display text-base font-semibold text-[#e9efec]">
              Immutable Administrative Audit Logs
            </h2>
            <p className="text-xs text-[#8ba39a]">
              Records actor, action, target entity, timestamp, and safe configuration deltas
            </p>
          </div>
          {data.auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8ba39a]">
              No administrative actions logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1e2624] bg-[#0a0d0c] font-mono text-[11px] text-[#5a6b65] uppercase">
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2624] font-mono">
                  {data.auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-[#151c19]">
                      <td className="py-3 px-4 text-[#8ba39a]">#{log.id}</td>
                      <td className="py-3 px-4 text-[#8ba39a] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-4 text-[#e9efec]">
                        {log.actor_name} ({log.actor_email})
                      </td>
                      <td className="py-3 px-4 text-[#4ff0b7]">{log.action}</td>
                      <td className="py-3 px-4 text-[#8ba39a]">
                        {log.target_type} #{log.target_id}
                      </td>
                      <td className="py-3 px-4 text-[#5a6b65] max-w-md truncate">
                        {JSON.stringify(log.metadata_json)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
