import { Router, Request, Response } from 'express';
import {
  db,
  saveDb,
  toDecimal2,
  nowIso,
  isValidDateStr,
  VALID_PAYMENT_METHODS,
  PaymentMethod,
  TransactionRow,
  BudgetRow,
} from './db.ts';
import {
  getAuthenticatedUser,
  verifyCsrf,
  computeMonthlyBudgetAnalysis,
} from './session.ts';

export const financeRouter = Router();

financeRouter.get('/categories', (req: Request, res: Response) => {
  const { user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  res.json({ categories: db.categories });
});

financeRouter.get('/transactions', (req: Request, res: Response) => {
  const { user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const typeFilter = req.query.type ? String(req.query.type) : '';
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
  const categoryId = req.query.category_id ? Number(req.query.category_id) : 0;
  const paymentMethod = req.query.payment_method ? String(req.query.payment_method) : '';
  const incomeSource = req.query.income_source ? String(req.query.income_source).trim().toLowerCase() : '';
  const startDate = req.query.start_date ? String(req.query.start_date) : '';
  const endDate = req.query.end_date ? String(req.query.end_date) : '';
  const sortBy = req.query.sort_by ? String(req.query.sort_by) : 'date_desc';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15));

  const catMap = new Map(db.categories.map((c) => [c.id, c]));

  let rows = db.transactions.filter((t) => t.user_id === user.id);

  if (typeFilter === 'income' || typeFilter === 'expense') {
    rows = rows.filter((t) => t.type === typeFilter);
  }
  if (search) {
    rows = rows.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        (t.notes && t.notes.toLowerCase().includes(search)) ||
        (t.income_source && t.income_source.toLowerCase().includes(search))
    );
  }
  if (categoryId > 0) {
    rows = rows.filter((t) => t.category_id === categoryId);
  }
  if (paymentMethod) {
    rows = rows.filter((t) => t.payment_method === paymentMethod);
  }
  if (incomeSource) {
    rows = rows.filter((t) => (t.income_source || '').toLowerCase().includes(incomeSource));
  }
  if (startDate && isValidDateStr(startDate)) {
    rows = rows.filter((t) => t.transaction_date >= startDate);
  }
  if (endDate && isValidDateStr(endDate)) {
    rows = rows.filter((t) => t.transaction_date <= endDate);
  }

  rows.sort((a, b) => {
    if (sortBy === 'date_asc') {
      return a.transaction_date.localeCompare(b.transaction_date) || a.id - b.id;
    }
    if (sortBy === 'amount_desc') {
      return b.amount - a.amount || b.transaction_date.localeCompare(a.transaction_date);
    }
    if (sortBy === 'amount_asc') {
      return a.amount - b.amount || b.transaction_date.localeCompare(a.transaction_date);
    }
    return b.transaction_date.localeCompare(a.transaction_date) || b.id - a.id;
  });

  const totalCount = rows.length;
  const totalIncome = toDecimal2(rows.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0));
  const totalExpense = toDecimal2(rows.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0));

  const offset = (page - 1) * limit;
  const paginated = rows.slice(offset, offset + limit).map((t) => ({
    ...t,
    category_name: t.category_id ? catMap.get(t.category_id)?.name || 'Unknown' : null,
    category_active: t.category_id ? catMap.get(t.category_id)?.is_active ?? true : null,
  }));

  res.json({
    transactions: paginated,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    },
    filteredTotals: {
      income: totalIncome,
      expense: totalExpense,
      net: toDecimal2(totalIncome - totalExpense),
    },
  });
});

financeRouter.post('/transactions', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const type = req.body?.type;
  if (type !== 'income' && type !== 'expense') {
    res.status(422).json({ error: 'Transaction type must be either income or expense.' });
    return;
  }

  const rawAmount = Number(req.body?.amount);
  const amount = toDecimal2(rawAmount);
  if (!Number.isFinite(rawAmount) || amount <= 0 || amount > 9999999999.99) {
    res.status(422).json({ error: 'Amount must be a positive number greater than ₹0.00.' });
    return;
  }

  const transactionDate = String(req.body?.transaction_date || '').trim();
  if (!isValidDateStr(transactionDate)) {
    res.status(422).json({ error: 'Please provide a valid transaction date (YYYY-MM-DD).' });
    return;
  }

  const description = String(req.body?.description || '').trim();
  if (description.length < 2 || description.length > 255) {
    res.status(422).json({ error: 'Description must be between 2 and 255 characters.' });
    return;
  }

  const notes = req.body?.notes ? String(req.body.notes).trim().substring(0, 1000) : null;

  let categoryId: number | null = null;
  let paymentMethod: PaymentMethod | null = null;
  let incomeSource: string | null = null;

  if (type === 'expense') {
    categoryId = Number(req.body?.category_id);
    const cat = db.categories.find((c) => c.id === categoryId);
    if (!cat) {
      res.status(422).json({ error: 'Please select a valid expense category.' });
      return;
    }
    if (!cat.is_active) {
      res.status(422).json({
        error: `Category "${cat.name}" is inactive and cannot be assigned to new expenses.`,
      });
      return;
    }
    const pm = String(req.body?.payment_method || '') as PaymentMethod;
    if (!VALID_PAYMENT_METHODS.includes(pm)) {
      res.status(422).json({
        error: 'Please select a valid payment method (Cash, UPI, Debit card, Credit card, Bank transfer, or Other).',
      });
      return;
    }
    paymentMethod = pm;
  } else {
    incomeSource = String(req.body?.income_source || '').trim();
    if (incomeSource.length < 2 || incomeSource.length > 100) {
      res.status(422).json({
        error: 'Please specify a valid income source (e.g., Salary, Scholarship, Business, Freelance).',
      });
      return;
    }
  }

  const ts = nowIso();
  db.seq.transactions += 1;
  const created: TransactionRow = {
    id: db.seq.transactions,
    user_id: user.id,
    type,
    amount,
    category_id: categoryId,
    income_source: incomeSource,
    description,
    transaction_date: transactionDate,
    payment_method: paymentMethod,
    notes,
    created_at: ts,
    updated_at: ts,
  };

  db.transactions.push(created);
  saveDb(db);

  res.status(201).json({
    message: `${type === 'income' ? 'Income' : 'Expense'} recorded successfully.`,
    transaction: created,
  });
});

financeRouter.put('/transactions/:id', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const txId = Number(req.params.id);
  const existing = db.transactions.find((t) => t.id === txId);
  if (!existing || existing.user_id !== user.id) {
    res.status(404).json({ error: 'Transaction record not found or access denied.' });
    return;
  }

  const rawAmount = Number(req.body?.amount);
  const amount = toDecimal2(rawAmount);
  if (!Number.isFinite(rawAmount) || amount <= 0 || amount > 9999999999.99) {
    res.status(422).json({ error: 'Amount must be a positive number greater than ₹0.00.' });
    return;
  }

  const transactionDate = String(req.body?.transaction_date || '').trim();
  if (!isValidDateStr(transactionDate)) {
    res.status(422).json({ error: 'Please provide a valid transaction date (YYYY-MM-DD).' });
    return;
  }

  const description = String(req.body?.description || '').trim();
  if (description.length < 2 || description.length > 255) {
    res.status(422).json({ error: 'Description must be between 2 and 255 characters.' });
    return;
  }

  const notes = req.body?.notes ? String(req.body.notes).trim().substring(0, 1000) : null;

  if (existing.type === 'expense') {
    const categoryId = Number(req.body?.category_id);
    const cat = db.categories.find((c) => c.id === categoryId);
    if (!cat) {
      res.status(422).json({ error: 'Please select a valid expense category.' });
      return;
    }
    if (!cat.is_active && existing.category_id !== categoryId) {
      res.status(422).json({ error: `Category "${cat.name}" is inactive and cannot be assigned.` });
      return;
    }
    const pm = String(req.body?.payment_method || '') as PaymentMethod;
    if (!VALID_PAYMENT_METHODS.includes(pm)) {
      res.status(422).json({ error: 'Please select a valid payment method.' });
      return;
    }
    existing.category_id = categoryId;
    existing.payment_method = pm;
  } else {
    const incomeSource = String(req.body?.income_source || '').trim();
    if (incomeSource.length < 2 || incomeSource.length > 100) {
      res.status(422).json({ error: 'Please specify a valid income source.' });
      return;
    }
    existing.income_source = incomeSource;
  }

  existing.amount = amount;
  existing.transaction_date = transactionDate;
  existing.description = description;
  existing.notes = notes;
  existing.updated_at = nowIso();

  saveDb(db);
  res.json({ message: 'Transaction updated successfully.', transaction: existing });
});

financeRouter.delete('/transactions/:id', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const txId = Number(req.params.id);
  const idx = db.transactions.findIndex((t) => t.id === txId && t.user_id === user.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Transaction not found or access denied.' });
    return;
  }

  db.transactions.splice(idx, 1);
  saveDb(db);
  res.json({ message: 'Transaction deleted permanently.' });
});

financeRouter.get('/budgets', (req: Request, res: Response) => {
  const { user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const month = String(req.query.month || '2026-10').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(422).json({ error: 'Invalid budget month format. Use YYYY-MM.' });
    return;
  }

  res.json(computeMonthlyBudgetAnalysis(user.id, month));
});

financeRouter.post('/budgets', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const categoryId = Number(req.body?.category_id);
  const budgetMonth = String(req.body?.budget_month || '').trim();
  const rawAmount = Number(req.body?.budget_amount);
  const budgetAmount = toDecimal2(rawAmount);

  if (!/^\d{4}-\d{2}$/.test(budgetMonth)) {
    res.status(422).json({ error: 'Budget month must be in YYYY-MM format.' });
    return;
  }
  if (!Number.isFinite(rawAmount) || budgetAmount <= 0 || budgetAmount > 9999999999.99) {
    res.status(422).json({ error: 'Budget amount must be greater than ₹0.00.' });
    return;
  }

  const cat = db.categories.find((c) => c.id === categoryId);
  if (!cat || !cat.is_active) {
    res.status(422).json({ error: 'Please select an active expense category.' });
    return;
  }

  const duplicate = db.budgets.find(
    (b) => b.user_id === user.id && b.category_id === categoryId && b.budget_month === budgetMonth
  );
  if (duplicate) {
    res.status(409).json({
      error: `A budget for "${cat.name}" already exists in ${budgetMonth}. Please edit the existing budget instead.`,
    });
    return;
  }

  const ts = nowIso();
  db.seq.budgets += 1;
  const created: BudgetRow = {
    id: db.seq.budgets,
    user_id: user.id,
    category_id: categoryId,
    budget_month: budgetMonth,
    budget_amount: budgetAmount,
    created_at: ts,
    updated_at: ts,
  };
  db.budgets.push(created);
  saveDb(db);

  res.status(201).json({
    message: `Monthly budget for ${cat.name} (${budgetMonth}) created.`,
    analysis: computeMonthlyBudgetAnalysis(user.id, budgetMonth),
  });
});

financeRouter.put('/budgets/:id', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const budgetId = Number(req.params.id);
  const existing = db.budgets.find((b) => b.id === budgetId && b.user_id === user.id);
  if (!existing) {
    res.status(404).json({ error: 'Budget record not found or access denied.' });
    return;
  }

  const rawAmount = Number(req.body?.budget_amount);
  const budgetAmount = toDecimal2(rawAmount);
  if (!Number.isFinite(rawAmount) || budgetAmount <= 0 || budgetAmount > 9999999999.99) {
    res.status(422).json({ error: 'Budget amount must be greater than ₹0.00.' });
    return;
  }

  existing.budget_amount = budgetAmount;
  existing.updated_at = nowIso();
  saveDb(db);

  res.json({
    message: 'Budget updated successfully.',
    analysis: computeMonthlyBudgetAnalysis(user.id, existing.budget_month),
  });
});

financeRouter.delete('/budgets/:id', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const budgetId = Number(req.params.id);
  const idx = db.budgets.findIndex((b) => b.id === budgetId && b.user_id === user.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Budget record not found or access denied.' });
    return;
  }

  const month = db.budgets[idx].budget_month;
  db.budgets.splice(idx, 1);
  saveDb(db);

  res.json({
    message: 'Budget removed.',
    analysis: computeMonthlyBudgetAnalysis(user.id, month),
  });
});

financeRouter.get('/dashboard', (req: Request, res: Response) => {
  const { user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const month = String(req.query.month || '2026-10').trim();
  const catMap = new Map(db.categories.map((c) => [c.id, c]));

  const userAllTx = db.transactions.filter((t) => t.user_id === user.id);
  const periodTx = userAllTx.filter((t) => t.transaction_date.startsWith(month));

  const totalIncome = toDecimal2(
    periodTx.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
  );
  const totalExpenses = toDecimal2(
    periodTx.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
  );
  const netSavings = toDecimal2(totalIncome - totalExpenses);

  const budgetAnalysis = computeMonthlyBudgetAnalysis(user.id, month);

  const catTotals = new Map<number, number>();
  for (const t of periodTx) {
    if (t.type === 'expense' && t.category_id) {
      catTotals.set(t.category_id, toDecimal2((catTotals.get(t.category_id) || 0) + t.amount));
    }
  }
  const categoryBreakdown = Array.from(catTotals.entries())
    .map(([catId, amount]) => ({
      category_id: catId,
      category_name: catMap.get(catId)?.name || 'Unknown',
      amount,
      percentage: totalExpenses > 0 ? toDecimal2((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const [yrStr, moStr] = month.split('-');
  const baseYear = parseInt(yrStr, 10) || 2026;
  const baseMonth = parseInt(moStr, 10) || 10;

  const monthlyTrend: Array<{
    month: string;
    label: string;
    income: number;
    expense: number;
    netSavings: number;
  }> = [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 5; i >= 0; i--) {
    let m = baseMonth - i;
    let y = baseYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const mTx = userAllTx.filter((t) => t.transaction_date.startsWith(ym));
    const inc = toDecimal2(mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    const exp = toDecimal2(mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    monthlyTrend.push({
      month: ym,
      label: `${monthNames[m - 1]} ${y}`,
      income: inc,
      expense: exp,
      netSavings: toDecimal2(inc - exp),
    });
  }

  const recentTransactions = [...periodTx]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.id - a.id)
    .slice(0, 8)
    .map((t) => ({
      ...t,
      category_name: t.category_id ? catMap.get(t.category_id)?.name || 'Unknown' : null,
    }));

  res.json({
    period: month,
    summary: {
      totalIncome,
      totalExpenses,
      netSavings,
      transactionCount: periodTx.length,
      totalBudgetAllocated: budgetAnalysis.totalBudgetAllocated,
      budgetUtilizationPct: budgetAnalysis.aggregateUtilizationPct,
      totalBudgetedSpending: budgetAnalysis.totalBudgetedSpending,
      warningThreshold: budgetAnalysis.warningThreshold,
    },
    categoryBreakdown,
    monthlyTrend,
    budgetAnalysis,
    recentTransactions,
  });
});

financeRouter.get('/reports', (req: Request, res: Response) => {
  const { user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const periodType = String(req.query.period || 'monthly');
  const refValue = String(req.query.ref || '2026-10').trim();
  const categoryFilter = req.query.category_id ? Number(req.query.category_id) : 0;

  let startDate = '2026-10-01';
  let endDate = '2026-10-31';
  let periodLabel = 'October 2026';
  let budgetMonthForComparison = '2026-10';

  if (periodType === 'weekly') {
    const baseDate = isValidDateStr(refValue) ? refValue : '2026-10-19';
    startDate = baseDate;
    const d = new Date(baseDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 6);
    endDate = d.toISOString().substring(0, 10);
    periodLabel = `Week of ${startDate} to ${endDate}`;
    budgetMonthForComparison = startDate.substring(0, 7);
  } else if (periodType === 'yearly') {
    const yr = /^\d{4}$/.test(refValue) ? refValue : refValue.substring(0, 4) || '2026';
    startDate = `${yr}-01-01`;
    endDate = `${yr}-12-31`;
    periodLabel = `Calendar Year ${yr}`;
    budgetMonthForComparison = `${yr}-10`;
  } else {
    const ym = /^\d{4}-\d{2}$/.test(refValue) ? refValue : '2026-10';
    const [y, m] = ym.split('-').map(Number);
    startDate = `${ym}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    endDate = `${ym}-${String(lastDay).padStart(2, '0')}`;
    periodLabel = `Month ${ym} (${startDate} to ${endDate})`;
    budgetMonthForComparison = ym;
  }

  const catMap = new Map(db.categories.map((c) => [c.id, c]));

  let userTx = db.transactions.filter(
    (t) => t.user_id === user.id && t.transaction_date >= startDate && t.transaction_date <= endDate
  );

  if (categoryFilter > 0) {
    userTx = userTx.filter((t) => t.category_id === categoryFilter);
  }

  const totalIncome = toDecimal2(
    userTx.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
  );
  const totalExpenses = toDecimal2(
    userTx.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
  );
  const netSavings = toDecimal2(totalIncome - totalExpenses);

  const catMapTotals = new Map<number, { amount: number; count: number }>();
  for (const t of userTx) {
    if (t.type === 'expense' && t.category_id) {
      const prev = catMapTotals.get(t.category_id) || { amount: 0, count: 0 };
      catMapTotals.set(t.category_id, {
        amount: toDecimal2(prev.amount + t.amount),
        count: prev.count + 1,
      });
    }
  }

  const monthBudgets = db.budgets.filter(
    (b) => b.user_id === user.id && b.budget_month === budgetMonthForComparison
  );
  const budgetByCat = new Map(monthBudgets.map((b) => [b.category_id, b.budget_amount]));

  const categoryReport = db.categories
    .map((c) => {
      const stat = catMapTotals.get(c.id) || { amount: 0, count: 0 };
      const monthlyBudget = budgetByCat.get(c.id) ?? null;
      return {
        category_id: c.id,
        category_name: c.name,
        transaction_count: stat.count,
        period_expense: stat.amount,
        share_pct: totalExpenses > 0 ? toDecimal2((stat.amount / totalExpenses) * 100) : 0,
        monthly_budget_reference: monthlyBudget,
        budget_month_reference: budgetMonthForComparison,
      };
    })
    .filter((row) => row.period_expense > 0 || row.monthly_budget_reference !== null)
    .sort((a, b) => b.period_expense - a.period_expense);

  const sortedTransactions = [...userTx]
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.id - a.id)
    .map((t) => ({
      ...t,
      category_name: t.category_id ? catMap.get(t.category_id)?.name || 'Unknown' : null,
    }));

  res.json({
    periodType,
    refValue,
    startDate,
    endDate,
    periodLabel,
    budgetMonthForComparison,
    summary: {
      totalIncome,
      totalExpenses,
      netSavings,
      transactionCount: sortedTransactions.length,
    },
    categoryReport,
    transactions: sortedTransactions,
  });
});
