import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, UserRow, toDecimal2, getSetting } from './db.ts';

export interface SessionData {
  sessionId: string;
  userId: number | null;
  csrfToken: string;
  createdAt: number;
}

const SESSIONS_FILE = path.resolve(process.cwd(), 'database', 'ledger_sessions.json');

function loadSessions(): Map<string, SessionData> {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as SessionData[];
      return new Map(raw.map((s) => [s.sessionId, s]));
    }
  } catch {
    // Ignore corrupt session file
  }
  return new Map<string, SessionData>();
}

export const sessions = loadSessions();

export function saveSessions(): void {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(sessions.values()), null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

export function getOrCreateSession(req: Request, res: Response): SessionData {
  const cookies = parseCookies(req.headers.cookie);
  const headerSid = req.headers['x-ledger-session'] as string | undefined;
  const sid = headerSid || cookies['LEDGER_ETBA_SESSID'];

  if (sid && sessions.has(sid)) {
    return sessions.get(sid)!;
  }

  const newSid = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const sess: SessionData = {
    sessionId: newSid,
    userId: null,
    csrfToken,
    createdAt: Date.now(),
  };
  sessions.set(newSid, sess);
  saveSessions();
  res.setHeader(
    'Set-Cookie',
    `LEDGER_ETBA_SESSID=${newSid}; Path=/; HttpOnly; SameSite=Lax`
  );
  return sess;
}

export function regenerateSession(req: Request, res: Response, userId: number): SessionData {
  const cookies = parseCookies(req.headers.cookie);
  const headerSid = req.headers['x-ledger-session'] as string | undefined;
  const oldSid = headerSid || cookies['LEDGER_ETBA_SESSID'];
  if (oldSid) {
    sessions.delete(oldSid);
  }

  const newSid = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const sess: SessionData = {
    sessionId: newSid,
    userId,
    csrfToken,
    createdAt: Date.now(),
  };
  sessions.set(newSid, sess);
  saveSessions();
  res.setHeader(
    'Set-Cookie',
    `LEDGER_ETBA_SESSID=${newSid}; Path=/; HttpOnly; SameSite=Lax`
  );
  return sess;
}

export function getAuthenticatedUser(
  req: Request,
  res: Response
): { session: SessionData; user: UserRow | null } {
  const session = getOrCreateSession(req, res);
  if (!session.userId) {
    return { session, user: null };
  }
  const user = db.users.find((u) => u.id === session.userId) || null;
  if (!user || user.status !== 'active') {
    session.userId = null;
    saveSessions();
    return { session, user: null };
  }
  return { session, user };
}

export function verifyCsrf(req: Request, session: SessionData): boolean {
  const token = (req.headers['x-csrf-token'] as string) || req.body?.csrfToken;
  const headerSid = req.headers['x-ledger-session'] as string | undefined;
  if (token && session.csrfToken && token === session.csrfToken) {
    return true;
  }
  if (headerSid && session.sessionId && headerSid === session.sessionId) {
    return true;
  }
  return false;
}

export function requireAdmin(
  req: Request,
  res: Response
): { session: SessionData; admin: UserRow } | null {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    return null;
  }
  return { session, admin: user };
}

export function computeMonthlyBudgetAnalysis(userId: number, month: string) {
  const warningThreshold = parseFloat(getSetting('budget_warning_threshold', '80')) || 80;
  const userBudgets = db.budgets.filter((b) => b.user_id === userId && b.budget_month === month);
  const userMonthExpenses = db.transactions.filter(
    (t) => t.user_id === userId && t.type === 'expense' && t.transaction_date.startsWith(month)
  );

  const spendingByCat = new Map<number, number>();
  for (const exp of userMonthExpenses) {
    if (exp.category_id) {
      const prev = spendingByCat.get(exp.category_id) || 0;
      spendingByCat.set(exp.category_id, toDecimal2(prev + exp.amount));
    }
  }

  const catMap = new Map(db.categories.map((c) => [c.id, c]));
  const budgetedCatIds = new Set<number>();

  const budgetRows = userBudgets.map((b) => {
    budgetedCatIds.add(b.category_id);
    const cat = catMap.get(b.category_id);
    const actualSpending = spendingByCat.get(b.category_id) || 0;
    const remaining = toDecimal2(b.budget_amount - actualSpending);
    const utilizationPct =
      b.budget_amount > 0 ? toDecimal2((actualSpending / b.budget_amount) * 100) : 0;

    let status: 'normal' | 'warning' | 'exceeded' = 'normal';
    if (utilizationPct >= 100) {
      status = 'exceeded';
    } else if (utilizationPct >= warningThreshold) {
      status = 'warning';
    }

    return {
      id: b.id,
      category_id: b.category_id,
      category_name: cat?.name || 'Unknown',
      category_active: cat?.is_active ?? true,
      budget_month: b.budget_month,
      budget_amount: b.budget_amount,
      actual_spending: actualSpending,
      remaining_budget: remaining,
      utilization_pct: utilizationPct,
      status,
    };
  });

  const unbudgetedCategories: Array<{
    category_id: number;
    category_name: string;
    actual_spending: number;
    transaction_count: number;
  }> = [];

  for (const [catId, spent] of spendingByCat.entries()) {
    if (!budgetedCatIds.has(catId) && spent > 0) {
      const cat = catMap.get(catId);
      const txCount = userMonthExpenses.filter((e) => e.category_id === catId).length;
      unbudgetedCategories.push({
        category_id: catId,
        category_name: cat?.name || 'Unknown',
        actual_spending: spent,
        transaction_count: txCount,
      });
    }
  }

  const totalBudgetAllocated = toDecimal2(
    budgetRows.reduce((acc, r) => acc + r.budget_amount, 0)
  );
  const totalBudgetedSpending = toDecimal2(
    budgetRows.reduce((acc, r) => acc + r.actual_spending, 0)
  );
  const totalMonthSpending = toDecimal2(
    userMonthExpenses.reduce((acc, e) => acc + e.amount, 0)
  );
  const aggregateUtilizationPct =
    totalBudgetAllocated > 0
      ? toDecimal2((totalBudgetedSpending / totalBudgetAllocated) * 100)
      : 0;

  return {
    month,
    warningThreshold,
    totalBudgetAllocated,
    totalBudgetedSpending,
    totalMonthSpending,
    totalRemainingBudget: toDecimal2(totalBudgetAllocated - totalBudgetedSpending),
    aggregateUtilizationPct,
    budgets: budgetRows.sort((a, b) => b.utilization_pct - a.utilization_pct),
    unbudgetedCategories: unbudgetedCategories.sort((a, b) => b.actual_spending - a.actual_spending),
  };
}
