export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  transaction_count?: number;
  budget_count?: number;
  aggregate_spent?: number;
}

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Debit card'
  | 'Credit card'
  | 'Bank transfer'
  | 'Other';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Debit card',
  'Credit card',
  'Bank transfer',
  'Other',
];

export const INCOME_SOURCES: string[] = [
  'Salary',
  'Business Income',
  'Scholarship',
  'Allowance',
  'Freelance',
  'Investment / Dividend',
  'Other Earnings',
];

export interface Transaction {
  id: number;
  user_id: number;
  type: 'income' | 'expense';
  amount: number;
  category_id: number | null;
  category_name?: string | null;
  category_active?: boolean | null;
  income_source: string | null;
  description: string;
  transaction_date: string;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetAnalysisRow {
  id: number;
  category_id: number;
  category_name: string;
  category_active: boolean;
  budget_month: string;
  budget_amount: number;
  actual_spending: number;
  remaining_budget: number;
  utilization_pct: number;
  status: 'normal' | 'warning' | 'exceeded';
}

export interface UnbudgetedCategoryRow {
  category_id: number;
  category_name: string;
  actual_spending: number;
  transaction_count: number;
}

export interface MonthlyBudgetAnalysis {
  month: string;
  warningThreshold: number;
  totalBudgetAllocated: number;
  totalBudgetedSpending: number;
  totalMonthSpending: number;
  totalRemainingBudget: number;
  aggregateUtilizationPct: number;
  budgets: BudgetAnalysisRow[];
  unbudgetedCategories: UnbudgetedCategoryRow[];
}

export interface DashboardData {
  period: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    transactionCount: number;
    totalBudgetAllocated: number;
    budgetUtilizationPct: number;
    totalBudgetedSpending: number;
    warningThreshold: number;
  };
  categoryBreakdown: Array<{
    category_id: number;
    category_name: string;
    amount: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    label: string;
    income: number;
    expense: number;
    netSavings: number;
  }>;
  budgetAnalysis: MonthlyBudgetAnalysis;
  recentTransactions: Transaction[];
}

export interface ReportData {
  periodType: 'weekly' | 'monthly' | 'yearly';
  refValue: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  budgetMonthForComparison: string;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    transactionCount: number;
  };
  categoryReport: Array<{
    category_id: number;
    category_name: string;
    transaction_count: number;
    period_expense: number;
    share_pct: number;
    monthly_budget_reference: number | null;
    budget_month_reference: string;
  }>;
  transactions: Transaction[];
}

export interface AiInsights {
  headline: string;
  savingsAssessment: string;
  priorityAlerts: string[];
  recommendations: Array<{
    category: string;
    suggestedAction: string;
    estimatedMonthlyImpactInr: number;
  }>;
}
