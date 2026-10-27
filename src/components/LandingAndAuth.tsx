import React, { useState } from 'react';
import {
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react';
import { apiFetch, setAuthTokens } from '../utils/format.ts';
import { User } from '../types.ts';

interface LandingAndAuthProps {
  hasAdminAccount: boolean;
  allowRegistration: boolean;
  onAuthenticated: (user: User) => void;
  onOpenDeliverables: () => void;
}

export const LandingAndAuth: React.FC<LandingAndAuthProps> = ({
  hasAdminAccount,
  allowRegistration,
  onAuthenticated,
  onOpenDeliverables,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'setup_admin'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPrototypeModal, setShowPrototypeModal] = useState(false);

  const handleFillDemoUser = () => {
    setAuthMode('login');
    setEmail('sanjay.demo@mitindia.edu');
    setPassword('Sanjay@2026');
    setError(null);
    setSuccessMsg('Filled demonstration student account credentials. Click "Sign In to Ledger" to proceed.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (authMode === 'login') {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuthTokens(res.sessionId, res.csrfToken);
        onAuthenticated(res.user);
      } else if (authMode === 'register') {
        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, confirmPassword }),
        });
        setAuthTokens(res.sessionId, res.csrfToken);
        onAuthenticated(res.user);
      } else if (authMode === 'setup_admin') {
        const res = await apiFetch('/api/auth/setup-first-admin', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, confirmPassword }),
        });
        setAuthTokens(res.sessionId, res.csrfToken);
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d0c] text-[#e9efec] ledger-grid-bg flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#0a0d0c]/90 backdrop-blur-md border-b border-[#1e2624]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display font-bold text-lg tracking-tight text-[#e9efec] whitespace-nowrap shrink-0"
          >
            Ledger
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm text-[#8ba39a]">
            <a href="#auth-workspace" className="hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0">
              Sign In
            </a>
            <a href="#problem" className="hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0">
              Problem
            </a>
            <a href="#features" className="hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#modules" className="hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0">
              Modules
            </a>
            <a href="#workflow" className="hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0">
              Workflow
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#auth-workspace"
              className="px-4 py-2 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors whitespace-nowrap shrink-0"
            >
              Access Ledger
            </a>
          </div>
        </div>
      </header>

      {/* Hero + Authentication Split Section */}
      <section id="top" className="py-14 lg:py-20 border-b border-[#1e2624]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            {/* Left Column: Project Identity & Value Proposition */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-[#4ff0b7] tracking-wider mb-4">
                  PROJECT REF ETBA-2026 · EXPENSE TRACKER WITH BUDGET ANALYSIS · INR (₹)
                </div>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight mb-6 max-w-2xl">
                  Track every expense. Build a smarter{' '}
                  <span className="text-[#4ff0b7]">financial future.</span>
                </h1>
                <p className="text-[#8ba39a] text-base sm:text-lg leading-relaxed max-w-xl mb-8">
                  A full-stack personal finance management system that records Indian Rupee (₹)
                  income and daily expenses, plans monthly category budgets, monitors real-time
                  utilization thresholds, and turns raw transactions into actionable financial
                  decisions.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-10">
                  <button
                    type="button"
                    onClick={handleFillDemoUser}
                    className="px-4 py-2.5 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load Demo Student Account (Sanjay N)
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenDeliverables}
                    className="px-4 py-2.5 text-xs font-mono text-[#e9efec] border border-[#1e2624] bg-[#101513] hover:border-[#4ff0b7] hover:text-[#4ff0b7] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    Inspect XAMPP PHP &amp; SQL Files
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrototypeModal(true)}
                    className="px-4 py-2.5 text-xs font-mono text-[#8ba39a] border border-[#1e2624] hover:border-[#4ff0b7] hover:text-[#e9efec] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Original HTML Prototype
                  </button>
                </div>
              </div>

              {/* Receipt Comparison Card from Prototype */}
              <div className="border border-[#1e2624] bg-[#101513] p-6 font-mono text-xs text-[#8ba39a]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1e2624] text-[#e9efec]">
                  <span>SAMPLE LEDGER SNAPSHOT · INDIAN RUPEES (₹)</span>
                  <span className="text-[#4ff0b7]">DECIMAL(12,2) VERIFIED</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-dotted border-[#1e2624]">
                    <span>NILGIRIS SUPERMARKET — FOOD</span>
                    <span className="tabular-nums text-[#e9efec]">₹2,450.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dotted border-[#1e2624]">
                    <span>CHENNAI METRO SMART CARD — TRAVEL</span>
                    <span className="tabular-nums text-[#e9efec]">₹650.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dotted border-[#1e2624]">
                    <span>TANGEDCO ELECTRICITY — BILLS</span>
                    <span className="tabular-nums text-[#e9efec]">₹2,180.00</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dotted border-[#1e2624]">
                    <span>NPTEL CERTIFICATION — EDUCATION</span>
                    <span className="tabular-nums text-[#e9efec]">₹3,500.00</span>
                  </div>
                  <div className="flex justify-between pt-2 text-[#4ff0b7] font-semibold">
                    <span>MONTHLY BUDGET UTILIZATION TRACKING</span>
                    <span className="tabular-nums">REAL-TIME DB QUERIES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Authentication & Role Access Panel */}
            <div
              id="auth-workspace"
              className="lg:col-span-5 border border-[#1e2624] bg-[#101513] p-6 sm:p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-4 mb-6 border-b border-[#1e2624]">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#e9efec]">
                      {authMode === 'login'
                        ? 'Sign In to Ledger'
                        : authMode === 'register'
                        ? 'Create Personal Account'
                        : 'Provision First Administrator'}
                    </h2>
                    <p className="text-xs text-[#8ba39a] mt-0.5">
                      {authMode === 'login'
                        ? 'Authenticate with your registered email and password'
                        : authMode === 'register'
                        ? 'Register a new user account (Role: Registered User)'
                        : 'First-time administrator setup (CLI equivalent)'}
                    </p>
                  </div>
                  <Lock className="w-5 h-5 text-[#4ff0b7] shrink-0" />
                </div>

                {/* Segmented Mode Selector */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#0a0d0c] border border-[#1e2624] mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2 px-3 text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      authMode === 'login'
                        ? 'bg-[#101513] text-[#4ff0b7] border border-[#2c8a68]'
                        : 'text-[#8ba39a] hover:text-[#e9efec]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2 px-3 text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      authMode === 'register'
                        ? 'bg-[#101513] text-[#4ff0b7] border border-[#2c8a68]'
                        : 'text-[#8ba39a] hover:text-[#e9efec]'
                    }`}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('setup_admin');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2 px-3 text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
                      authMode === 'setup_admin'
                        ? 'bg-[#101513] text-[#f0b429] border border-[#f0b429]/50'
                        : 'text-[#8ba39a] hover:text-[#e9efec]'
                    }`}
                  >
                    Admin Setup
                  </button>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 border border-[#ff6b6b]/50 bg-[#ff6b6b]/10 text-[#ff6b6b] text-xs flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="mb-5 p-3.5 border border-[#2c8a68] bg-[#4ff0b7]/10 text-[#4ff0b7] text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {authMode === 'setup_admin' && hasAdminAccount ? (
                  <div className="p-4 border border-[#1e2624] bg-[#0a0d0c] text-xs text-[#8ba39a] space-y-3">
                    <div className="flex items-center gap-2 text-[#4ff0b7] font-mono">
                      <ShieldCheck className="w-4 h-4" />
                      <span>FIRST ADMINISTRATOR ALREADY PROVISIONED</span>
                    </div>
                    <p>
                      An active administrator account already exists in the database. For security,
                      public requests cannot create additional administrator accounts.
                    </p>
                    <p className="font-mono text-[11px] text-[#5a6b65]">
                      XAMPP CLI Command: php scripts/create_admin.php &quot;Name&quot;
                      &quot;admin@domain.edu&quot; &quot;Password&quot;
                    </p>
                  </div>
                ) : authMode === 'register' && !allowRegistration ? (
                  <div className="p-4 border border-[#f0b429]/40 bg-[#f0b429]/10 text-xs text-[#f0b429]">
                    Public user registration has been temporarily disabled by the administrator.
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {(authMode === 'register' || authMode === 'setup_admin') && (
                      <div>
                        <label
                          htmlFor="auth-name"
                          className="block text-xs font-mono text-[#8ba39a] mb-1.5"
                        >
                          Full Name
                        </label>
                        <div className="relative">
                          <UserIcon className="w-4 h-4 text-[#5a6b65] absolute left-3 top-3" />
                          <input
                            id="auth-name"
                            type="text"
                            required
                            minLength={2}
                            maxLength={120}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Sanjay N"
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-mono text-[#8ba39a] mb-1.5"
                      >
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#5a6b65] absolute left-3 top-3" />
                        <input
                          id="auth-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="user@mitindia.edu"
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-xs font-mono text-[#8ba39a] mb-1.5"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#5a6b65] absolute left-3 top-3" />
                        <input
                          id="auth-password"
                          type="password"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 8 chars, 1 uppercase, 1 digit"
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                        />
                      </div>
                    </div>

                    {(authMode === 'register' || authMode === 'setup_admin') && (
                      <div>
                        <label
                          htmlFor="auth-confirm"
                          className="block text-xs font-mono text-[#8ba39a] mb-1.5"
                        >
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-[#5a6b65] absolute left-3 top-3" />
                          <input
                            id="auth-confirm"
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#0a0d0c] border border-[#1e2624] text-[#e9efec] focus:outline-none focus:border-[#4ff0b7]"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 text-xs font-mono font-semibold bg-[#4ff0b7] text-[#06120d] border border-[#4ff0b7] hover:bg-transparent hover:text-[#4ff0b7] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading
                        ? 'Processing...'
                        : authMode === 'login'
                        ? 'Sign In to Ledger'
                        : authMode === 'register'
                        ? 'Create Personal Account'
                        : 'Provision First Administrator'}
                    </button>
                  </form>
                )}
              </div>

              {/* Quick Demo Access Footer */}
              <div className="mt-6 pt-4 border-t border-[#1e2624] text-xs text-[#8ba39a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#5a6b65]">
                    DEMO STUDENT ACCOUNT (SEED DATA)
                  </span>
                  <button
                    type="button"
                    onClick={handleFillDemoUser}
                    className="font-mono text-[11px] text-[#4ff0b7] hover:underline cursor-pointer"
                  >
                    Auto-fill Credentials →
                  </button>
                </div>
                <div className="font-mono text-[11px] text-[#8ba39a]">
                  Email: sanjay.demo@mitindia.edu · Pass: Sanjay@2026
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column KPI Strip Below Hero Split */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#1e2624] bg-[#101513] mt-12">
            <div className="p-6 border-b md:border-b-0 border-r border-[#1e2624]">
              <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
                03 Tiers
              </div>
              <div className="text-xs text-[#8ba39a] mt-1">
                Guest · Registered User · Administrator
              </div>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-[#1e2624]">
              <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
                08 Modules
              </div>
              <div className="text-xs text-[#8ba39a] mt-1">
                Auth, Income, Expenses, Budgets, Reports, Admin
              </div>
            </div>
            <div className="p-6 border-r border-[#1e2624]">
              <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
                DECIMAL(12,2)
              </div>
              <div className="text-xs text-[#8ba39a] mt-1">
                Exact Indian Rupee (₹) Monetary Precision
              </div>
            </div>
            <div className="p-6">
              <div className="font-mono text-2xl font-semibold text-[#4ff0b7] tabular-nums">
                80% / 100%
              </div>
              <div className="text-xs text-[#8ba39a] mt-1">
                Configurable Approaching &amp; Exceeded Alerts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement Section (Preserved from Prototype) */}
      <section id="problem" className="py-16 border-b border-[#1e2624]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono text-[#4ff0b7] tracking-wider mb-3">
            01. PROBLEM STATEMENT
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-6 max-w-2xl">
            Managing personal finances manually is difficult and error-prone.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-[#1e2624] bg-[#101513] p-6">
              <h3 className="font-display text-base font-semibold text-[#e9efec] mb-2">
                Fragmented Spreadsheets
              </h3>
              <p className="text-sm text-[#8ba39a]">
                Many individuals rely on paper notebooks or ad-hoc spreadsheets that are tedious to
                maintain and lack automated category aggregation.
              </p>
            </div>
            <div className="border border-[#1e2624] bg-[#101513] p-6">
              <h3 className="font-display text-base font-semibold text-[#e9efec] mb-2">
                Unnoticed Overspending
              </h3>
              <p className="text-sm text-[#8ba39a]">
                Without real-time monthly category budgets and threshold warnings, users only
                discover overspending after the month has ended.
              </p>
            </div>
            <div className="border border-[#1e2624] bg-[#101513] p-6">
              <h3 className="font-display text-base font-semibold text-[#e9efec] mb-2">
                Actionable Budget Analysis
              </h3>
              <p className="text-sm text-[#8ba39a]">
                Ledger solves this by linking every persisted transaction directly to monthly
                category budgets, net savings formulas, and weekly/monthly/yearly reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Modules Section */}
      <section id="features" className="py-16 border-b border-[#1e2624]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono text-[#4ff0b7] tracking-wider mb-3">
            02. OBJECTIVES &amp; CAPABILITIES
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-8 max-w-2xl">
            Eight core capabilities engineered for household and student budgeting.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#1e2624] bg-[#1e2624] gap-[1px]">
            {[
              {
                num: '01',
                title: 'User Authentication',
                desc: 'Secure registration, password hashing, session regeneration, CSRF protection, and login throttling.',
              },
              {
                num: '02',
                title: 'Income Management',
                desc: 'Record salary, scholarship, freelance, and business earnings with date range and source filters.',
              },
              {
                num: '03',
                title: 'Expense Tracking',
                desc: 'Log daily expenses in ₹ with category, payment method (UPI, Cash, Card, Bank transfer), and notes.',
              },
              {
                num: '04',
                title: 'Monthly Budget Planning',
                desc: 'Allocate monthly category targets with unique (user, category, month) database constraints.',
              },
              {
                num: '05',
                title: 'Budget Utilization Analysis',
                desc: 'Compare actual spending vs. planned budget with 80% warning and 100% overspending alerts.',
              },
              {
                num: '06',
                title: 'Reports & Analytics',
                desc: 'Generate weekly, monthly, and yearly financial reports with interactive trend visualizations.',
              },
              {
                num: '07',
                title: 'Category Governance',
                desc: 'Organize spending across Food, Travel, Shopping, Bills, Healthcare, Education, and custom categories.',
              },
              {
                num: '08',
                title: 'Administrator Console',
                desc: 'Manage user accounts, soft-deactivate categories safely, configure thresholds, and audit logs.',
              },
            ].map((f) => (
              <div key={f.num} className="bg-[#0a0d0c] p-6">
                <div className="font-mono text-xs text-[#2c8a68] mb-3">{f.num}</div>
                <h3 className="font-display text-base font-semibold text-[#e9efec] mb-2">
                  {f.title}
                </h3>
                <p className="text-xs text-[#8ba39a] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Modules & Workflow Section */}
      <section id="modules" className="py-16 border-b border-[#1e2624] bg-[#101513]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-xs font-mono text-[#4ff0b7] tracking-wider mb-3">
            03. SYSTEM ARCHITECTURE &amp; WORKFLOW
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-8">
            Three role boundaries, one shared relational schema.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="workflow">
            <div className="border border-[#1e2624] bg-[#0a0d0c] p-6">
              <h3 className="font-display text-base font-semibold text-[#4ff0b7] mb-4">
                Registered User Module
              </h3>
              <ul className="space-y-2 text-xs text-[#8ba39a] font-mono">
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  1. Register &amp; Authenticate Session
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  2. Record Income Sources &amp; Daily Expenses
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  3. Search, Filter, Sort &amp; Paginate Ledger
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  4. Review Period Net Savings (Income − Expense)
                </li>
                <li>5. Manage Profile &amp; Verify Password Changes</li>
              </ul>
            </div>

            <div className="border border-[#1e2624] bg-[#0a0d0c] p-6">
              <h3 className="font-display text-base font-semibold text-[#4ff0b7] mb-4">
                Budget &amp; Analytics Module
              </h3>
              <ul className="space-y-2 text-xs text-[#8ba39a] font-mono">
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  1. Set Monthly Category Budgets (YYYY-MM)
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  2. Calculate Remaining = Budget − Actual
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  3. Track Utilization % = (Actual ÷ Budget) × 100
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  4. Flag Unbudgeted Categories with Expenses
                </li>
                <li>5. Generate Weekly, Monthly &amp; Yearly Reports</li>
              </ul>
            </div>

            <div className="border border-[#1e2624] bg-[#0a0d0c] p-6">
              <h3 className="font-display text-base font-semibold text-[#f0b429] mb-4">
                Administrator Module
              </h3>
              <ul className="space-y-2 text-xs text-[#8ba39a] font-mono">
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  1. Activate / Deactivate User Accounts
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  2. Create, Edit &amp; Soft-Deactivate Categories
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  3. Configure Budget Warning Thresholds (80%)
                </li>
                <li className="pb-2 border-b border-dashed border-[#1e2624]">
                  4. View Aggregate System Statistics Safely
                </li>
                <li>5. Inspect Immutable Administrative Audit Logs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 mt-auto border-t border-[#1e2624]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#8ba39a]">
          <div>
            <div className="font-display text-sm font-semibold text-[#e9efec]">
              Sanjay N · Ledger (Project ETBA-2026)
            </div>
            <div className="text-[#5a6b65] mt-0.5">
              Madras Institute of Technology, Chennai · Expense Tracker with Budget Analysis
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <button
              type="button"
              onClick={onOpenDeliverables}
              className="text-[#4ff0b7] hover:underline cursor-pointer"
            >
              XAMPP PHP 8.2 &amp; MySQL 8.0 Deliverables
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setShowPrototypeModal(true)}
              className="text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
            >
              Original HTML Prototype
            </button>
          </div>
        </div>
      </footer>

      {/* Original Prototype Viewer Modal */}
      {showPrototypeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#101513] border border-[#1e2624] w-full max-w-6xl h-[88vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-[#1e2624] flex items-center justify-between">
              <div className="text-xs font-mono text-[#e9efec]">
                ORIGINAL SUPPLIED PROTOTYPE · public/assets/aistudio/expense-tracker-project__1__8eb6833a.html
              </div>
              <button
                type="button"
                onClick={() => setShowPrototypeModal(false)}
                className="p-1 text-[#8ba39a] hover:text-[#e9efec] cursor-pointer"
                aria-label="Close prototype viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe
              src="/assets/aistudio/expense-tracker-project__1__8eb6833a.html"
              title="Original Ledger HTML Prototype"
              className="w-full flex-1 bg-[#0a0d0c]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
