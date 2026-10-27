import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  db,
  saveDb,
  toDecimal2,
  nowIso,
  isValidDateStr,
  recordAuditLog,
  VALID_PAYMENT_METHODS,
  CategoryRow,
} from './db.ts';
import {
  getAuthenticatedUser,
  verifyCsrf,
  requireAdmin,
  computeMonthlyBudgetAnalysis,
} from './session.ts';

export const adminAndAiRouter = Router();

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// ADMINISTRATOR MODULE ENDPOINTS
// ============================================================================
adminAndAiRouter.get('/admin/overview', (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;

  const userSearch = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

  const safeUsers = db.users
    .filter(
      (u) =>
        !userSearch ||
        u.name.toLowerCase().includes(userSearch) ||
        u.email.toLowerCase().includes(userSearch)
    )
    .map((u) => {
      const txCount = db.transactions.filter((t) => t.user_id === u.id).length;
      const budgetCount = db.budgets.filter((b) => b.user_id === u.id).length;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        created_at: u.created_at,
        updated_at: u.updated_at,
        transaction_count: txCount,
        budget_count: budgetCount,
      };
    });

  const categoriesWithUsage = db.categories.map((c) => {
    const txRefs = db.transactions.filter((t) => t.category_id === c.id);
    const budgetRefs = db.budgets.filter((b) => b.category_id === c.id);
    const aggregateSpent = toDecimal2(txRefs.reduce((s, t) => s + t.amount, 0));
    return {
      ...c,
      transaction_count: txRefs.length,
      budget_count: budgetRefs.length,
      aggregate_spent: aggregateSpent,
    };
  });

  const totalIncomeAggregate = toDecimal2(
    db.transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  );
  const totalExpenseAggregate = toDecimal2(
    db.transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  );

  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const enrichedAuditLogs = db.audit_logs.slice(0, 50).map((log) => ({
    ...log,
    actor_name: userMap.get(log.actor_user_id)?.name || `User #${log.actor_user_id}`,
    actor_email: userMap.get(log.actor_user_id)?.email || '',
  }));

  res.json({
    aggregateStats: {
      totalUsers: db.users.length,
      activeUsers: db.users.filter((u) => u.status === 'active').length,
      inactiveUsers: db.users.filter((u) => u.status === 'inactive').length,
      totalCategories: db.categories.length,
      activeCategories: db.categories.filter((c) => c.is_active).length,
      totalTransactions: db.transactions.length,
      aggregateSystemIncome: totalIncomeAggregate,
      aggregateSystemExpenses: totalExpenseAggregate,
    },
    users: safeUsers,
    categories: categoriesWithUsage,
    settings: db.system_settings,
    auditLogs: enrichedAuditLogs,
  });
});

adminAndAiRouter.put('/admin/users/:id/status', (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!verifyCsrf(req, auth.session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const targetId = Number(req.params.id);
  const newStatus = req.body?.status;
  if (newStatus !== 'active' && newStatus !== 'inactive') {
    res.status(422).json({ error: 'Status must be active or inactive.' });
    return;
  }

  if (targetId === auth.admin.id && newStatus === 'inactive') {
    res.status(400).json({ error: 'You cannot deactivate your own active administrator account.' });
    return;
  }

  const targetUser = db.users.find((u) => u.id === targetId);
  if (!targetUser) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  const previousStatus = targetUser.status;
  targetUser.status = newStatus;
  targetUser.updated_at = nowIso();

  recordAuditLog(
    auth.admin.id,
    newStatus === 'active' ? 'USER_ACCOUNT_ACTIVATED' : 'USER_ACCOUNT_DEACTIVATED',
    'user',
    String(targetUser.id),
    { email: targetUser.email, previousStatus, newStatus }
  );

  res.json({ message: `User account ${targetUser.email} is now ${newStatus}.` });
});

adminAndAiRouter.post('/admin/categories', (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!verifyCsrf(req, auth.session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();

  if (name.length < 2 || name.length > 80) {
    res.status(422).json({ error: 'Category name must be between 2 and 80 characters.' });
    return;
  }

  const duplicate = db.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    res.status(409).json({ error: `A category named "${duplicate.name}" already exists.` });
    return;
  }

  const ts = nowIso();
  db.seq.categories += 1;
  const created: CategoryRow = {
    id: db.seq.categories,
    name,
    description: description || `${name} expenses`,
    is_active: true,
    created_at: ts,
    updated_at: ts,
  };
  db.categories.push(created);

  recordAuditLog(auth.admin.id, 'CATEGORY_CREATED', 'category', String(created.id), {
    name: created.name,
  });

  res.status(201).json({ message: `Category "${created.name}" created.`, category: created });
});

adminAndAiRouter.put('/admin/categories/:id', (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!verifyCsrf(req, auth.session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const catId = Number(req.params.id);
  const category = db.categories.find((c) => c.id === catId);
  if (!category) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  const name = req.body?.name !== undefined ? String(req.body.name).trim() : category.name;
  const description =
    req.body?.description !== undefined ? String(req.body.description).trim() : category.description;
  const isActive =
    req.body?.is_active !== undefined ? Boolean(req.body.is_active) : category.is_active;

  if (name.length < 2 || name.length > 80) {
    res.status(422).json({ error: 'Category name must be between 2 and 80 characters.' });
    return;
  }

  const duplicate = db.categories.find(
    (c) => c.id !== catId && c.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    res.status(409).json({ error: `Another category named "${duplicate.name}" already exists.` });
    return;
  }

  const prevActive = category.is_active;
  const prevName = category.name;
  category.name = name;
  category.description = description;
  category.is_active = isActive;
  category.updated_at = nowIso();

  recordAuditLog(
    auth.admin.id,
    prevActive !== isActive
      ? isActive
        ? 'CATEGORY_ACTIVATED'
        : 'CATEGORY_DEACTIVATED'
      : 'CATEGORY_UPDATED',
    'category',
    String(category.id),
    { previousName: prevName, newName: name, isActive }
  );

  res.json({ message: `Category "${category.name}" updated.`, category });
});

adminAndAiRouter.put('/admin/settings', (req: Request, res: Response) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  if (!verifyCsrf(req, auth.session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const thresholdRaw = Number(req.body?.budget_warning_threshold);
  const allowRegistration = String(req.body?.allow_registration) === '0' ? '0' : '1';
  const maxAttemptsRaw = Number(req.body?.login_max_attempts);

  if (!Number.isFinite(thresholdRaw) || thresholdRaw < 50 || thresholdRaw > 99) {
    res.status(422).json({
      error: 'Budget warning threshold must be between 50% and 99%.',
    });
    return;
  }
  if (!Number.isFinite(maxAttemptsRaw) || maxAttemptsRaw < 3 || maxAttemptsRaw > 15) {
    res.status(422).json({
      error: 'Max failed login attempts must be between 3 and 15.',
    });
    return;
  }

  const updates: Record<string, string> = {
    budget_warning_threshold: String(Math.round(thresholdRaw)),
    allow_registration: allowRegistration,
    login_max_attempts: String(Math.round(maxAttemptsRaw)),
  };

  for (const [k, v] of Object.entries(updates)) {
    const row = db.system_settings.find((s) => s.setting_key === k);
    if (row) {
      row.setting_value = v;
      row.updated_by = auth.admin.id;
      row.updated_at = nowIso();
    }
  }

  recordAuditLog(auth.admin.id, 'SYSTEM_SETTINGS_UPDATED', 'system_settings', 'global', updates);
  res.json({ message: 'System settings saved and logged.', settings: db.system_settings });
});

// ============================================================================
// SERVER-SIDE GEMINI FINANCIAL INTELLIGENCE ENDPOINTS
// ============================================================================
function cleanJsonText(raw?: string): string {
  if (!raw) return '{}';
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseTransactionDeterministically(promptText: string) {
  const lower = promptText.toLowerCase();
  const isIncome =
    /\b(received|salary|stipend|scholarship|income|credited|allowance|freelance|bonus|dividend)\b/i.test(
      promptText
    ) && !/\b(paid|spent|bought|bill|recharge|purchase)\b/i.test(promptText);

  // Extract amount (supports ₹1,450.50, Rs 1450, INR 500, or standalone numbers)
  const currencyMatch =
    promptText.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    promptText.match(/\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);
  const extractedAmount = currencyMatch
    ? toDecimal2(currencyMatch[1].replace(/,/g, ''))
    : 500;

  // Extract date (YYYY-MM-DD) or relative keywords
  const dateMatch = promptText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  let txDate = '2026-10-27';
  if (dateMatch && isValidDateStr(dateMatch[1])) {
    txDate = dateMatch[1];
  } else if (lower.includes('yesterday')) {
    txDate = '2026-10-26';
  }

  // Match active category
  const activeCats = db.categories.filter((c) => c.is_active);
  let matchedCatId = activeCats[0]?.id || 1;
  const keywordCatMap: Array<{ keywords: RegExp; catName: string }> = [
    { keywords: /\b(food|grocery|groceries|dinner|lunch|breakfast|mess|canteen|restaurant|supermarket|nilgiris|swiggy|zomato)\b/i, catName: 'Food' },
    { keywords: /\b(travel|metro|bus|train|flight|cab|auto|uber|ola|fuel|petrol|commute)\b/i, catName: 'Travel' },
    { keywords: /\b(bill|electricity|tangedco|broadband|wifi|fibernet|water|rent|maintenance|recharge|mobile)\b/i, catName: 'Bills' },
    { keywords: /\b(shopping|amazon|flipkart|clothes|shoes|usb|electronics|hub|supplies|store)\b/i, catName: 'Shopping' },
    { keywords: /\b(health|pharmacy|apollo|medicine|doctor|hospital|dental|clinic|checkup)\b/i, catName: 'Healthcare' },
    { keywords: /\b(entertainment|netflix|movie|cinema|spotify|game|subscription|ott)\b/i, catName: 'Entertainment' },
    { keywords: /\b(education|course|nptel|book|tuition|exam|certification|college|semester|fee)\b/i, catName: 'Education' },
  ];
  for (const rule of keywordCatMap) {
    if (rule.keywords.test(promptText)) {
      const found = activeCats.find((c) => c.name.toLowerCase() === rule.catName.toLowerCase());
      if (found) {
        matchedCatId = found.id;
        break;
      }
    }
  }

  // Match payment method
  let paymentMethod: (typeof VALID_PAYMENT_METHODS)[number] = 'UPI';
  if (/\bcash\b/i.test(promptText)) paymentMethod = 'Cash';
  else if (/\bcredit\s*card\b/i.test(promptText)) paymentMethod = 'Credit card';
  else if (/\b(debit\s*card|card)\b/i.test(promptText)) paymentMethod = 'Debit card';
  else if (/\b(bank\s*transfer|neft|imps|rtgs)\b/i.test(promptText)) paymentMethod = 'Bank transfer';
  else if (/\bupi|gpay|phonepe|paytm\b/i.test(promptText)) paymentMethod = 'UPI';

  // Match income source
  let incomeSource = 'Salary';
  if (/\bscholarship\b/i.test(promptText)) incomeSource = 'Scholarship';
  else if (/\bfreelance\b/i.test(promptText)) incomeSource = 'Freelance';
  else if (/\bbusiness\b/i.test(promptText)) incomeSource = 'Business Income';
  else if (/\ballowance\b/i.test(promptText)) incomeSource = 'Allowance';

  return {
    type: isIncome ? ('income' as const) : ('expense' as const),
    amount: extractedAmount > 0 ? extractedAmount : 500,
    description: promptText.slice(0, 180),
    transaction_date: txDate,
    category_id: matchedCatId,
    payment_method: paymentMethod,
    income_source: incomeSource,
    notes: 'Parsed via Ledger Smart Entry',
  };
}

function buildDeterministicInsights(
  month: string,
  totalIncome: number,
  totalExpense: number,
  netSavings: number,
  analysis: ReturnType<typeof computeMonthlyBudgetAnalysis>
) {
  const savingsRate = totalIncome > 0 ? toDecimal2((netSavings / totalIncome) * 100) : 0;
  const exceeded = analysis.budgets.filter((b) => b.status === 'exceeded');
  const warnings = analysis.budgets.filter((b) => b.status === 'warning');
  const unbudgeted = analysis.unbudgetedCategories;

  let headline = `For ${month}, you recorded ₹${totalIncome.toLocaleString('en-IN')} in income and ₹${totalExpense.toLocaleString('en-IN')} in expenses, resulting in a period net savings of ₹${netSavings.toLocaleString('en-IN')}.`;
  if (exceeded.length > 0) {
    headline = `Action Needed (${month}): ${exceeded.length} expense category (${exceeded.map((e) => e.category_name).join(', ')}) has exceeded 100% of its monthly budget, though overall period net savings remains ₹${netSavings.toLocaleString('en-IN')}.`;
  } else if (warnings.length > 0) {
    headline = `Steady Cashflow (${month}): Period net savings stands at ₹${netSavings.toLocaleString('en-IN')} (${savingsRate}% of income), with ${warnings.length} category approaching the ${analysis.warningThreshold}% warning threshold.`;
  }

  const savingsAssessment =
    totalIncome > 0
      ? `Your period-based net savings is ₹${netSavings.toFixed(2)} (${savingsRate.toFixed(1)}% savings rate on ₹${totalIncome.toFixed(2)} income). Total budgeted spending is ₹${analysis.totalBudgetedSpending.toFixed(2)} against ₹${analysis.totalBudgetAllocated.toFixed(2)} allocated (${analysis.aggregateUtilizationPct.toFixed(1)}% aggregate utilization).`
      : `You have recorded ₹${totalExpense.toFixed(2)} in expenses with ₹0.00 recorded income for ${month}. Add your monthly income sources in the Income Management tab to track your net savings rate accurately.`;

  const priorityAlerts: string[] = [];
  for (const b of exceeded) {
    priorityAlerts.push(
      `Exceeded Limit — ${b.category_name}: Spent ₹${b.actual_spending.toFixed(2)} against a ₹${b.budget_amount.toFixed(2)} budget (${b.utilization_pct.toFixed(1)}% utilization, over budget by ₹${Math.abs(b.remaining_budget).toFixed(2)}).`
    );
  }
  for (const b of warnings) {
    priorityAlerts.push(
      `Approaching Threshold (≥${analysis.warningThreshold}%) — ${b.category_name}: Spent ₹${b.actual_spending.toFixed(2)} of ₹${b.budget_amount.toFixed(2)} (${b.utilization_pct.toFixed(1)}% used, ₹${b.remaining_budget.toFixed(2)} remaining).`
    );
  }
  for (const u of unbudgeted) {
    priorityAlerts.push(
      `Unbudgeted Category Spending — ${u.category_name}: ₹${u.actual_spending.toFixed(2)} spent across ${u.transaction_count} transaction(s) with no monthly budget limit assigned for ${month}.`
    );
  }
  if (priorityAlerts.length === 0) {
    priorityAlerts.push(
      `All budgeted categories in ${month} are currently operating below the ${analysis.warningThreshold}% warning threshold.`
    );
  }

  const recommendations: Array<{
    category: string;
    suggestedAction: string;
    estimatedMonthlyImpactInr: number;
  }> = [];

  for (const b of exceeded) {
    const overage = Math.max(250, toDecimal2(Math.abs(b.remaining_budget) + b.budget_amount * 0.1));
    recommendations.push({
      category: b.category_name,
      suggestedAction: `Reallocate ₹${Math.ceil(Math.abs(b.remaining_budget) / 100) * 100} from under-utilized categories to cover the ₹${Math.abs(b.remaining_budget).toFixed(2)} overage and pause non-essential ${b.category_name.toLowerCase()} expenses for the rest of ${month}.`,
      estimatedMonthlyImpactInr: overage,
    });
  }

  for (const b of warnings) {
    recommendations.push({
      category: b.category_name,
      suggestedAction: `Cap remaining ${b.category_name} outflows within the ₹${b.remaining_budget.toFixed(2)} remaining buffer to avoid crossing 100% utilization before month-end.`,
      estimatedMonthlyImpactInr: toDecimal2(Math.max(300, b.actual_spending * 0.12)),
    });
  }

  for (const u of unbudgeted) {
    const suggestedLimit = Math.ceil(u.actual_spending / 500) * 500;
    recommendations.push({
      category: u.category_name,
      suggestedAction: `Establish a dedicated ₹${suggestedLimit.toFixed(2)} monthly budget for ${u.category_name} in the Budget Planning tab so future spending is tracked against thresholds.`,
      estimatedMonthlyImpactInr: toDecimal2(Math.max(200, u.actual_spending * 0.15)),
    });
  }

  if (recommendations.length < 3) {
    const underUtilized = analysis.budgets
      .filter((b) => b.status === 'normal' && b.remaining_budget > 500)
      .sort((a, b) => b.remaining_budget - a.remaining_budget);

    for (const u of underUtilized) {
      if (recommendations.length >= 3) break;
      recommendations.push({
        category: u.category_name,
        suggestedAction: `${u.category_name} is well within target (${u.utilization_pct.toFixed(1)}% used, ₹${u.remaining_budget.toFixed(2)} unspent). Transfer surplus allocation toward your monthly savings goal.`,
        estimatedMonthlyImpactInr: toDecimal2(Math.round(u.remaining_budget * 0.5)),
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: 'General Budgeting',
      suggestedAction: `Configure category budgets for Food, Bills, Travel, and Shopping in ${month} to unlock automated threshold tracking.`,
      estimatedMonthlyImpactInr: 1500,
    });
  }

  return {
    headline,
    savingsAssessment,
    priorityAlerts,
    recommendations: recommendations.slice(0, 3),
  };
}

adminAndAiRouter.post('/ai/parse-transaction', async (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const promptText = String(req.body?.prompt || '').trim();
  if (!promptText) {
    res.status(422).json({ error: 'Please enter a natural-language transaction description.' });
    return;
  }

  const activeCategories = db.categories.filter((c) => c.is_active).map((c) => c.name);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Parse the following Indian Rupee (INR, ₹) personal finance entry into structured fields. Today's reference date is 2026-10-27.
Active Expense Categories: ${activeCategories.join(', ')}.
Allowed Payment Methods for expenses: Cash, UPI, Debit card, Credit card, Bank transfer, Other.
User Input: "${promptText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: 'Either "expense" or "income"' },
              amount: { type: Type.NUMBER, description: 'Positive numeric amount in INR' },
              description: { type: Type.STRING, description: 'Concise transaction description' },
              transaction_date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
              category_name: { type: Type.STRING, description: 'Matching active expense category name if expense' },
              payment_method: { type: Type.STRING, description: 'Matching payment method if expense' },
              income_source: { type: Type.STRING, description: 'Income source (e.g. Salary, Scholarship, Freelance) if income' },
              notes: { type: Type.STRING, description: 'Optional additional context' },
            },
            required: ['type', 'amount', 'description', 'transaction_date'],
          },
        },
      });

      const parsed = JSON.parse(cleanJsonText(response.text));
      const matchedCat = db.categories.find(
        (c) => c.is_active && c.name.toLowerCase() === String(parsed.category_name || '').toLowerCase()
      );

      res.json({
        parsed: {
          type: parsed.type === 'income' ? 'income' : 'expense',
          amount: toDecimal2(parsed.amount || 0) || 500,
          description: parsed.description || promptText,
          transaction_date: isValidDateStr(parsed.transaction_date)
            ? parsed.transaction_date
            : '2026-10-27',
          category_id: matchedCat ? matchedCat.id : db.categories.find((c) => c.is_active)?.id || 1,
          payment_method: VALID_PAYMENT_METHODS.includes(parsed.payment_method)
            ? parsed.payment_method
            : 'UPI',
          income_source: parsed.income_source || 'Salary',
          notes: parsed.notes || '',
        },
      });
      return;
    } catch (err) {
      console.warn('[Ledger AI Parse] Falling back to deterministic parser:', err);
    }
  }

  res.json({ parsed: parseTransactionDeterministically(promptText) });
});

adminAndAiRouter.post('/ai/analyze-finances', async (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const month = String(req.body?.month || '2026-10').trim();
  const analysis = computeMonthlyBudgetAnalysis(user.id, month);
  const monthTx = db.transactions.filter(
    (t) => t.user_id === user.id && t.transaction_date.startsWith(month)
  );
  const totalIncome = toDecimal2(
    monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  );
  const totalExpense = toDecimal2(
    monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  );
  const netSavings = toDecimal2(totalIncome - totalExpense);

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analyze this user's real persisted financial data for ${month} in Indian Rupees (₹, INR) and provide concrete, mathematically accurate budget analysis and savings recommendations.
Financial Summary for ${month}:
- Total Income: ₹${totalIncome.toFixed(2)}
- Total Expenses: ₹${totalExpense.toFixed(2)}
- Period Net Savings: ₹${netSavings.toFixed(2)}
- Total Monthly Budget Allocated: ₹${analysis.totalBudgetAllocated.toFixed(2)}
- Aggregate Budget Utilization: ${analysis.aggregateUtilizationPct}%
- Category Budgets & Spending: ${JSON.stringify(analysis.budgets)}
- Unbudgeted Category Spending: ${JSON.stringify(analysis.unbudgetedCategories)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING, description: '1-sentence executive summary of the month financial health' },
              savingsAssessment: { type: Type.STRING, description: 'Analysis of the period net savings ratio and cashflow' },
              priorityAlerts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Specific warnings for exceeded, approaching (>=80%), or unbudgeted categories with exact ₹ figures',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    suggestedAction: { type: Type.STRING },
                    estimatedMonthlyImpactInr: { type: Type.NUMBER },
                  },
                  required: ['category', 'suggestedAction', 'estimatedMonthlyImpactInr'],
                },
              },
            },
            required: ['headline', 'savingsAssessment', 'priorityAlerts', 'recommendations'],
          },
        },
      });

      const parsedInsights = JSON.parse(cleanJsonText(response.text));
      if (parsedInsights && parsedInsights.headline) {
        res.json({ insights: parsedInsights });
        return;
      }
    } catch (err) {
      console.warn('[Ledger AI Analysis] Falling back to deterministic financial auditor:', err);
    }
  }

  // Seamless deterministic analysis using the user's real persisted database records
  const deterministicInsights = buildDeterministicInsights(
    month,
    totalIncome,
    totalExpense,
    netSavings,
    analysis
  );
  res.json({ insights: deterministicInsights });
});

// ============================================================================
// XAMPP PHP 8.2 & MYSQL DELIVERABLES INSPECTOR ENDPOINT
// ============================================================================
adminAndAiRouter.get('/xampp-deliverables', (_req: Request, res: Response) => {
  const deliverablePaths = [
    { path: 'database/schema.sql', title: 'MySQL 8.0 Schema (database/schema.sql)', lang: 'sql' },
    { path: 'database/seed.sql', title: 'Optional Demo Seed (database/seed.sql)', lang: 'sql' },
    { path: 'config/database.example.php', title: 'PDO Config Template (config/database.example.php)', lang: 'php' },
    { path: 'app/Core/Database.php', title: 'PDO Singleton & CSRF/INR Helpers (app/Core/Database.php)', lang: 'php' },
    { path: 'scripts/create_admin.php', title: 'CLI First-Admin Provisioning (scripts/create_admin.php)', lang: 'php' },
    { path: '.htaccess', title: 'Apache Security Rules (.htaccess)', lang: 'apache' },
    { path: 'README.md', title: 'XAMPP Setup & Architecture Guide (README.md)', lang: 'markdown' },
    { path: 'PROJECT_DOCUMENTATION.md', title: 'System Documentation & QA Suite (PROJECT_DOCUMENTATION.md)', lang: 'markdown' },
  ];

  const files = deliverablePaths.map((item) => {
    const fullPath = path.resolve(process.cwd(), item.path);
    let content = '';
    try {
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8');
      }
    } catch {
      content = '// Error reading file';
    }
    return { ...item, content };
  });

  res.json({ files });
});
