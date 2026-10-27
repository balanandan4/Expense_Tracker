/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  User as UserIcon,
  ShieldCheck,
  FileCode,
  LogOut,
  Menu,
  X,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { User, Category } from './types.ts';
import { apiFetch, setAuthTokens } from './utils/format.ts';
import { LandingAndAuth } from './components/LandingAndAuth.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';
import { BudgetsView } from './components/BudgetsView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { AdminView } from './components/AdminView.tsx';

type NavTab =
  | 'dashboard'
  | 'income'
  | 'expenses'
  | 'budgets'
  | 'reports'
  | 'profile'
  | 'admin';

interface DeliverableFile {
  path: string;
  title: string;
  lang: string;
  content: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasAdminAccount, setHasAdminAccount] = useState(false);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // XAMPP PHP & SQL Deliverables Modal state
  const [showDeliverables, setShowDeliverables] = useState(false);
  const [deliverables, setDeliverables] = useState<DeliverableFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch<{ categories: Category[] }>('/api/categories');
      setCategories(res.categories || []);
    } catch {
      // Unauthenticated or transient error
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/session');
      setAuthTokens(res.sessionId, res.csrfToken);
      setHasAdminAccount(Boolean(res.hasAdminAccount));
      setAllowRegistration(res.settings?.allow_registration !== '0');
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user, loadCategories, refreshTick]);

  const handleOpenDeliverables = async () => {
    setShowDeliverables(true);
    if (deliverables.length === 0) {
      try {
        const res = await apiFetch<{ files: DeliverableFile[] }>('/api/xampp-deliverables');
        setDeliverables(res.files || []);
      } catch {
        // Ignore
      }
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    setAuthTokens('', '');
    setUser(null);
    setActiveTab('dashboard');
    checkSession();
  };

  const triggerRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0a0d0c] text-[#8ba39a] flex items-center justify-center font-mono text-xs">
        Initializing Ledger (Project ETBA-2026)...
      </div>
    );
  }

  const currentDeliverable = deliverables[activeFileIdx];

  return (
    <>
      {!user ? (
        <LandingAndAuth
          hasAdminAccount={hasAdminAccount}
          allowRegistration={allowRegistration}
          onAuthenticated={(loggedInUser) => {
            setUser(loggedInUser);
            setActiveTab(loggedInUser.role === 'admin' ? 'admin' : 'dashboard');
            checkSession();
          }}
          onOpenDeliverables={handleOpenDeliverables}
        />
      ) : (
        <div className="min-h-screen bg-[#0a0d0c] text-[#e9efec] ledger-grid-bg flex flex-col lg:flex-row">
          {/* Sidebar Navigation (260px on Desktop) */}
          <aside className="w-full lg:w-64 lg:min-h-screen bg-[#101513] border-b lg:border-b-0 lg:border-r border-[#1e2624] flex flex-col shrink-0">
            {/* Brand Header */}
            <div className="h-16 px-5 border-b border-[#1e2624] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="font-display font-bold text-lg tracking-tight text-[#e9efec] cursor-pointer whitespace-nowrap"
              >
                Ledger <span className="font-mono text-xs font-normal text-[#4ff0b7]">ETBA-2026</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="lg:hidden p-1.5 text-[#8ba39a] hover:text-[#e9efec]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            {/* Navigation Links */}
            <nav
              className={`${
                mobileMenuOpen ? 'block' : 'hidden'
              } lg:block flex-1 p-4 space-y-1 text-xs font-mono`}
            >
              <div className="px-3 py-1.5 text-[10px] text-[#5a6b65] uppercase tracking-wider">
                Personal Finance Modules
              </div>
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'income', label: 'Income Management', icon: TrendingUp },
                { id: 'expenses', label: 'Expense Tracking', icon: TrendingDown },
                { id: 'budgets', label: 'Budget Planning', icon: PieChart },
                { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
                { id: 'profile', label: 'Profile & Security', icon: UserIcon },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as NavTab);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0a0d0c] text-[#4ff0b7] border border-[#2c8a68]'
                        : 'text-[#8ba39a] hover:text-[#e9efec] hover:bg-[#151c19] border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {user.role === 'admin' && (
                <>
                  <div className="pt-4 pb-1.5 px-3 text-[10px] text-[#f0b429] uppercase tracking-wider">
                    System Administration
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('admin');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === 'admin'
                        ? 'bg-[#0a0d0c] text-[#f0b429] border border-[#f0b429]/50'
                        : 'text-[#f0b429]/80 hover:text-[#f0b429] hover:bg-[#151c19] border border-transparent'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Administrator Console</span>
                  </button>
                </>
              )}

              <div className="pt-4 pb-1.5 px-3 text-[10px] text-[#5a6b65] uppercase tracking-wider">
                Project Deliverables
              </div>
              <button
                type="button"
                onClick={handleOpenDeliverables}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[#8ba39a] hover:text-[#4ff0b7] hover:bg-[#151c19] border border-transparent transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileCode className="w-4 h-4 shrink-0" />
                <span>XAMPP PHP &amp; SQL Files</span>
              </button>
            </nav>

            {/* User Account Footer in Sidebar */}
            <div className="hidden lg:block p-4 border-t border-[#1e2624] bg-[#0a0d0c]/60 text-xs">
              <div className="font-medium text-[#e9efec] truncate">{user.name}</div>
              <div className="font-mono text-[11px] text-[#8ba39a] truncate mt-0.5">
                {user.email}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#1e2624] font-mono text-[11px]">
                <span className="text-[#4ff0b7] uppercase">{user.role}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[#8ba39a] hover:text-[#ff6b6b] flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Main Workspace Viewport */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Context Bar */}
            <header className="h-16 px-6 border-b border-[#1e2624] bg-[#101513]/80 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="text-xs font-mono text-[#8ba39a] truncate">
                Ledger <span className="text-[#5a6b65]">/</span>{' '}
                <span className="text-[#e9efec] capitalize">{activeTab}</span>{' '}
                <span className="text-[#5a6b65]">·</span>{' '}
                <span className="text-[#4ff0b7]">INR (₹)</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenDeliverables}
                  className="px-3 py-1.5 text-xs font-mono text-[#8ba39a] border border-[#1e2624] hover:border-[#4ff0b7] hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  PHP / MySQL Source
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-mono text-[#e9efec] border border-[#1e2624] hover:border-[#ff6b6b] hover:text-[#ff6b6b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </header>

            {/* Active Module Content */}
            <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
              {activeTab === 'dashboard' && (
                <DashboardView
                  key={`dash-${refreshTick}`}
                  selectedMonth={selectedMonth}
                  onChangeMonth={setSelectedMonth}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'income' && (
                <TransactionsView
                  mode="income"
                  categories={categories}
                  onDataChanged={triggerRefresh}
                />
              )}

              {activeTab === 'expenses' && (
                <TransactionsView
                  mode="expense"
                  categories={categories}
                  onDataChanged={triggerRefresh}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView
                  selectedMonth={selectedMonth}
                  onChangeMonth={setSelectedMonth}
                  categories={categories}
                  onDataChanged={triggerRefresh}
                />
              )}

              {activeTab === 'reports' && <ReportsView categories={categories} />}

              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  onUserUpdated={(updated) => setUser(updated)}
                  onLogout={handleLogout}
                />
              )}

              {activeTab === 'admin' && user.role === 'admin' && (
                <AdminView
                  currentAdminId={user.id}
                  onCategoriesChanged={triggerRefresh}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* XAMPP PHP 8.2 & MySQL 8.0 Deliverables Inspector Modal */}
      {showDeliverables && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#1e2624] w-full max-w-6xl h-[86vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-[#1e2624] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#4ff0b7]">
                <FileCode className="w-4 h-4" />
                <span>
                  XAMPP PHP 8.2, PDO &amp; MYSQL 8.0 DELIVERABLES · PROJECT ETBA-2026
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeliverables(false)}
                className="p-1 text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#1e2624] bg-[#0a0d0c] overflow-y-auto p-3 space-y-1">
                {deliverables.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setActiveFileIdx(idx)}
                    className={`w-full text-left px-3 py-2.5 text-xs font-mono transition-colors cursor-pointer ${
                      idx === activeFileIdx
                        ? 'bg-[#101513] text-[#4ff0b7] border border-[#2c8a68]'
                        : 'text-[#8ba39a] hover:text-[#e9efec] border border-transparent'
                    }`}
                  >
                    <div className="font-semibold truncate">{f.path}</div>
                    <div className="text-[11px] text-[#5a6b65] truncate mt-0.5">{f.title}</div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-8 flex flex-col overflow-hidden bg-[#0a0d0c]">
                {currentDeliverable && (
                  <>
                    <div className="px-4 py-2.5 border-b border-[#1e2624] bg-[#101513] flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-[#e9efec] font-semibold">
                        {currentDeliverable.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(currentDeliverable.content);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 1800);
                          }}
                          className="px-3 py-1 text-xs font-mono border border-[#1e2624] text-[#8ba39a] hover:text-[#4ff0b7] hover:border-[#4ff0b7] flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedCode ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedCode ? 'Copied' : 'Copy Code'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([currentDeliverable.content], {
                              type: 'text/plain;charset=utf-8;',
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = currentDeliverable.path.replace(/\//g, '_');
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-1 text-xs font-mono bg-[#4ff0b7] text-[#06120d] font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    </div>
                    <pre className="flex-1 p-5 overflow-auto text-xs font-mono text-[#e9efec] leading-relaxed">
                      {currentDeliverable.content}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
