export function formatInr(amount: number, showDecimals = true): string {
  const num = Number.isFinite(amount) ? amount : 0;
  const isNegative = num < 0;
  const abs = Math.abs(num);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(abs);

  return `${isNegative ? '−₹' : '₹'}${formatted}`;
}

export function formatMonthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split('-').map(Number);
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[(m - 1) % 12]} ${y}`;
}

export const AVAILABLE_MONTHS = [
  '2026-12',
  '2026-11',
  '2026-10',
  '2026-09',
  '2026-08',
  '2026-07',
  '2026-06',
  '2026-05',
];

let currentCsrfToken = localStorage.getItem('ledger_csrf_token') || '';
let currentSessionId = localStorage.getItem('ledger_session_id') || '';

export function setAuthTokens(sessionId?: string, csrfToken?: string) {
  if (sessionId !== undefined) {
    currentSessionId = sessionId;
    if (sessionId) {
      localStorage.setItem('ledger_session_id', sessionId);
    } else {
      localStorage.removeItem('ledger_session_id');
    }
  }
  if (csrfToken !== undefined) {
    currentCsrfToken = csrfToken;
    if (csrfToken) {
      localStorage.setItem('ledger_csrf_token', csrfToken);
    } else {
      localStorage.removeItem('ledger_csrf_token');
    }
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentCsrfToken) {
    headers['X-CSRF-Token'] = currentCsrfToken;
  }
  if (currentSessionId) {
    headers['X-Ledger-Session'] = currentSessionId;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
