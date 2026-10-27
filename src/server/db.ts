import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Debit card' | 'Credit card' | 'Bank transfer' | 'Other';

export const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'UPI',
  'Debit card',
  'Credit card',
  'Bank transfer',
  'Other',
];

export interface TransactionRow {
  id: number;
  user_id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number | null;
  income_source: string | null;
  description: string;
  transaction_date: string;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: number;
  user_id: number;
  category_id: number;
  budget_month: string;
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingRow {
  setting_key: string;
  setting_value: string;
  description: string;
  updated_by: number | null;
  updated_at: string;
}

export interface AuditLogRow {
  id: number;
  actor_user_id: number;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown>;
  timestamp: string;
}

export interface LoginAttemptRow {
  id: number;
  email: string;
  ip_address: string;
  attempted_at: string;
  was_successful: boolean;
}

export interface DatabaseSchema {
  seq: {
    users: number;
    categories: number;
    transactions: number;
    budgets: number;
    audit_logs: number;
    login_attempts: number;
  };
  users: UserRow[];
  categories: CategoryRow[];
  transactions: TransactionRow[];
  budgets: BudgetRow[];
  system_settings: SystemSettingRow[];
  audit_logs: AuditLogRow[];
  login_attempts: LoginAttemptRow[];
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'database', 'ledger_runtime_db.json');

export function toDecimal2(val: number | string): number {
  const parsed = typeof val === 'string' ? parseFloat(val) : val;
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `$scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.startsWith('$scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const [, , salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export function isValidDateStr(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime());
}

function createInitialDatabase(): DatabaseSchema {
  const ts = '2026-10-01 09:00:00';
  const defaultCategories: CategoryRow[] = [
    { id: 1, name: 'Food', description: 'Groceries, dining out, cloud kitchens, and daily meals', is_active: true, created_at: ts, updated_at: ts },
    { id: 2, name: 'Travel', description: 'Metro card, fuel, auto/cab rides, train and flight tickets', is_active: true, created_at: ts, updated_at: ts },
    { id: 3, name: 'Shopping', description: 'Apparel, electronics, household items, and personal care', is_active: true, created_at: ts, updated_at: ts },
    { id: 4, name: 'Bills', description: 'Electricity, broadband, mobile recharge, rent, and water bills', is_active: true, created_at: ts, updated_at: ts },
    { id: 5, name: 'Healthcare', description: 'Medicines, doctor consultations, diagnostics, and insurance', is_active: true, created_at: ts, updated_at: ts },
    { id: 6, name: 'Entertainment', description: 'OTT subscriptions, movies, books, events, and hobbies', is_active: true, created_at: ts, updated_at: ts },
    { id: 7, name: 'Education', description: 'Course fees, textbooks, certifications, and academic supplies', is_active: true, created_at: ts, updated_at: ts },
    { id: 8, name: 'Other', description: 'Miscellaneous and uncategorized personal expenses', is_active: true, created_at: ts, updated_at: ts },
  ];

  const defaultSettings: SystemSettingRow[] = [
    { setting_key: 'budget_warning_threshold', setting_value: '80', description: 'Percentage of monthly category budget at which approaching-limit warnings trigger (50–99)', updated_by: null, updated_at: ts },
    { setting_key: 'currency_code', setting_value: 'INR', description: 'Primary system currency code (ISO 4217)', updated_by: null, updated_at: ts },
    { setting_key: 'currency_symbol', setting_value: '₹', description: 'Primary system currency display symbol', updated_by: null, updated_at: ts },
    { setting_key: 'login_max_attempts', setting_value: '5', description: 'Maximum failed login attempts allowed within lockout window', updated_by: null, updated_at: ts },
    { setting_key: 'login_lockout_minutes', setting_value: '15', description: 'Lockout duration in minutes after exceeding max failed login attempts', updated_by: null, updated_at: ts },
    { setting_key: 'allow_registration', setting_value: '1', description: 'Whether new public user account registrations are enabled (1 = Yes, 0 = No)', updated_by: null, updated_at: ts },
  ];

  const demoUser: UserRow = {
    id: 1,
    name: 'Sanjay N',
    email: 'sanjay.demo@mitindia.edu',
    password_hash: hashPassword('Sanjay@2026'),
    role: 'user',
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };

  const demoTransactions: TransactionRow[] = [
    { id: 1, user_id: 1, type: 'income', amount: 45000.00, category_id: null, income_source: 'Salary', description: 'Monthly Software Engineering Stipend', transaction_date: '2026-10-01', payment_method: null, notes: 'Credited via NEFT', created_at: ts, updated_at: ts },
    { id: 2, user_id: 1, type: 'income', amount: 8500.00, category_id: null, income_source: 'Scholarship', description: 'Merit Academic Scholarship Grant', transaction_date: '2026-10-05', payment_method: null, notes: 'Semester grant installment', created_at: ts, updated_at: ts },
    { id: 3, user_id: 1, type: 'expense', amount: 2450.00, category_id: 1, income_source: null, description: 'Nilgiris Supermarket Monthly Groceries', transaction_date: '2026-10-03', payment_method: 'UPI', notes: 'Rice, pulses, dairy, vegetables', created_at: ts, updated_at: ts },
    { id: 4, user_id: 1, type: 'expense', amount: 650.00, category_id: 2, income_source: null, description: 'Chennai Metro Rail Smart Card Recharge', transaction_date: '2026-10-04', payment_method: 'UPI', notes: 'Monthly commute Chromepet to Guindy', created_at: ts, updated_at: ts },
    { id: 5, user_id: 1, type: 'expense', amount: 2180.00, category_id: 4, income_source: null, description: 'TANGEDCO Bi-Monthly Electricity Bill', transaction_date: '2026-10-06', payment_method: 'Bank transfer', notes: 'Consumer service connection', created_at: ts, updated_at: ts },
    { id: 6, user_id: 1, type: 'expense', amount: 999.00, category_id: 4, income_source: null, description: 'ACT Fibernet Broadband Plan', transaction_date: '2026-10-07', payment_method: 'UPI', notes: '150 Mbps unlimited student plan', created_at: ts, updated_at: ts },
    { id: 7, user_id: 1, type: 'expense', amount: 3500.00, category_id: 7, income_source: null, description: 'NPTEL Cloud Architecture Certification Fee', transaction_date: '2026-10-10', payment_method: 'Debit card', notes: 'Exam registration and reference book', created_at: ts, updated_at: ts },
    { id: 8, user_id: 1, type: 'expense', amount: 199.00, category_id: 6, income_source: null, description: 'Netflix Mobile Subscription', transaction_date: '2026-10-12', payment_method: 'UPI', notes: 'Monthly auto-pay', created_at: ts, updated_at: ts },
    { id: 9, user_id: 1, type: 'expense', amount: 3120.00, category_id: 1, income_source: null, description: 'Campus Mess & Canteen Dining', transaction_date: '2026-10-15', payment_method: 'UPI', notes: 'First half-month meal charges', created_at: ts, updated_at: ts },
    { id: 10, user_id: 1, type: 'expense', amount: 3450.00, category_id: 4, income_source: null, description: 'Shared Apartment Maintenance & Water', transaction_date: '2026-10-18', payment_method: 'Bank transfer', notes: 'October share', created_at: ts, updated_at: ts },
    { id: 11, user_id: 1, type: 'expense', amount: 1840.00, category_id: 3, income_source: null, description: 'USB-C Hub and Notebook Supplies', transaction_date: '2026-10-20', payment_method: 'Debit card', notes: 'Purchased at Anna Salai electronics store', created_at: ts, updated_at: ts },
    { id: 12, user_id: 1, type: 'expense', amount: 1150.00, category_id: 1, income_source: null, description: 'Weekend Dinner & Groceries Top-up', transaction_date: '2026-10-24', payment_method: 'Cash', notes: 'Approaching 80% Food budget threshold', created_at: ts, updated_at: ts },
    { id: 13, user_id: 1, type: 'expense', amount: 950.00, category_id: 5, income_source: null, description: 'Apollo Pharmacy & Dental Checkup', transaction_date: '2026-10-25', payment_method: 'UPI', notes: 'Unbudgeted category demonstration', created_at: ts, updated_at: ts },
    { id: 14, user_id: 1, type: 'income', amount: 45000.00, category_id: null, income_source: 'Salary', description: 'September Software Engineering Stipend', transaction_date: '2026-09-01', payment_method: null, notes: 'NEFT credit', created_at: ts, updated_at: ts },
    { id: 15, user_id: 1, type: 'expense', amount: 6400.00, category_id: 1, income_source: null, description: 'September Groceries & Mess Charges', transaction_date: '2026-09-14', payment_method: 'UPI', notes: null, created_at: ts, updated_at: ts },
    { id: 16, user_id: 1, type: 'expense', amount: 5200.00, category_id: 4, income_source: null, description: 'September Rent & Broadband Bills', transaction_date: '2026-09-10', payment_method: 'Bank transfer', notes: null, created_at: ts, updated_at: ts },
    { id: 17, user_id: 1, type: 'expense', amount: 2100.00, category_id: 2, income_source: null, description: 'September Train & Metro Commute', transaction_date: '2026-09-20', payment_method: 'UPI', notes: null, created_at: ts, updated_at: ts },
    { id: 18, user_id: 1, type: 'income', amount: 42000.00, category_id: null, income_source: 'Salary', description: 'August Internship Stipend', transaction_date: '2026-08-01', payment_method: null, notes: null, created_at: ts, updated_at: ts },
    { id: 19, user_id: 1, type: 'expense', amount: 5900.00, category_id: 1, income_source: null, description: 'August Food & Dining', transaction_date: '2026-08-15', payment_method: 'UPI', notes: null, created_at: ts, updated_at: ts },
    { id: 20, user_id: 1, type: 'expense', amount: 4800.00, category_id: 4, income_source: null, description: 'August Utilities & Bills', transaction_date: '2026-08-12', payment_method: 'Bank transfer', notes: null, created_at: ts, updated_at: ts },
  ];

  const demoBudgets: BudgetRow[] = [
    { id: 1, user_id: 1, category_id: 1, budget_month: '2026-10', budget_amount: 8000.00, created_at: ts, updated_at: ts },
    { id: 2, user_id: 1, category_id: 2, budget_month: '2026-10', budget_amount: 3000.00, created_at: ts, updated_at: ts },
    { id: 3, user_id: 1, category_id: 3, budget_month: '2026-10', budget_amount: 5000.00, created_at: ts, updated_at: ts },
    { id: 4, user_id: 1, category_id: 4, budget_month: '2026-10', budget_amount: 6500.00, created_at: ts, updated_at: ts },
    { id: 5, user_id: 1, category_id: 6, budget_month: '2026-10', budget_amount: 1500.00, created_at: ts, updated_at: ts },
    { id: 6, user_id: 1, category_id: 7, budget_month: '2026-10', budget_amount: 6000.00, created_at: ts, updated_at: ts },
    { id: 7, user_id: 1, category_id: 8, budget_month: '2026-10', budget_amount: 2000.00, created_at: ts, updated_at: ts },
  ];

  return {
    seq: { users: 1, categories: 8, transactions: 20, budgets: 7, audit_logs: 0, login_attempts: 0 },
    users: [demoUser],
    categories: defaultCategories,
    transactions: demoTransactions,
    budgets: demoBudgets,
    system_settings: defaultSettings,
    audit_logs: [],
    login_attempts: [],
  };
}

export function loadDb(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      return JSON.parse(raw) as DatabaseSchema;
    }
  } catch (err) {
    console.error('Error loading database file, initializing fresh DB:', err);
  }
  const initial = createInitialDatabase();
  saveDb(initial);
  return initial;
}

export function saveDb(db: DatabaseSchema): void {
  const dir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

export const db: DatabaseSchema = loadDb();

export function getSetting(key: string, fallback: string): string {
  const row = db.system_settings.find((s) => s.setting_key === key);
  return row ? row.setting_value : fallback;
}

export function recordAuditLog(
  actorUserId: number,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
) {
  db.seq.audit_logs += 1;
  db.audit_logs.unshift({
    id: db.seq.audit_logs,
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata_json: metadata,
    timestamp: nowIso(),
  });
  saveDb(db);
}
