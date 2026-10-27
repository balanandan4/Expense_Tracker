import { Router, Request, Response } from 'express';
import {
  db,
  saveDb,
  hashPassword,
  verifyPassword,
  nowIso,
  getSetting,
  recordAuditLog,
  UserRow,
} from './db.ts';
import {
  getAuthenticatedUser,
  regenerateSession,
  verifyCsrf,
  sessions,
} from './session.ts';

export const authRouter = Router();

authRouter.get('/auth/session', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  const hasAdminAccount = db.users.some((u) => u.role === 'admin' && u.status === 'active');
  const settingsMap: Record<string, string> = {};
  for (const s of db.system_settings) {
    settingsMap[s.setting_key] = s.setting_value;
  }

  res.json({
    authenticated: !!user,
    sessionId: session.sessionId,
    csrfToken: session.csrfToken,
    hasAdminAccount,
    settings: settingsMap,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          created_at: user.created_at,
        }
      : null,
  });
});

authRouter.post('/auth/register', (req: Request, res: Response) => {
  const allowReg = getSetting('allow_registration', '1');
  if (allowReg === '0') {
    res.status(403).json({
      error: 'Public account registration is currently disabled by the system administrator.',
    });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (name.length < 2 || name.length > 120) {
    res.status(422).json({ error: 'Full name must be between 2 and 120 characters.' });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(422).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(422).json({
      error: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.',
    });
    return;
  }
  if (password !== confirmPassword) {
    res.status(422).json({ error: 'Password and Confirm Password do not match.' });
    return;
  }

  const exists = db.users.some((u) => u.email.toLowerCase() === email);
  if (exists) {
    res.status(409).json({ error: 'An account with this email address is already registered.' });
    return;
  }

  const ts = nowIso();
  db.seq.users += 1;
  const newUser: UserRow = {
    id: db.seq.users,
    name,
    email,
    password_hash: hashPassword(password),
    role: 'user',
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
  db.users.push(newUser);
  saveDb(db);

  const newSession = regenerateSession(req, res, newUser.id);
  res.status(201).json({
    authenticated: true,
    sessionId: newSession.sessionId,
    csrfToken: newSession.csrfToken,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at,
    },
  });
});

authRouter.post('/auth/login', (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const ip = req.ip || '127.0.0.1';

  const maxAttempts = parseInt(getSetting('login_max_attempts', '5'), 10) || 5;
  const lockoutMinutes = parseInt(getSetting('login_lockout_minutes', '15'), 10) || 15;
  const cutoffMs = Date.now() - lockoutMinutes * 60 * 1000;

  const recentFailures = db.login_attempts.filter((a) => {
    const t = new Date(a.attempted_at.replace(' ', 'T') + 'Z').getTime();
    return !a.was_successful && a.email === email && t >= cutoffMs;
  });

  if (recentFailures.length >= maxAttempts) {
    res.status(429).json({
      error: `Account temporarily locked due to ${maxAttempts} failed login attempts. Please try again after ${lockoutMinutes} minutes.`,
    });
    return;
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    db.seq.login_attempts += 1;
    db.login_attempts.push({
      id: db.seq.login_attempts,
      email,
      ip_address: ip,
      attempted_at: nowIso(),
      was_successful: false,
    });
    saveDb(db);
    res.status(401).json({ error: 'Invalid email address or password.' });
    return;
  }

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Your account has been deactivated by an administrator.' });
    return;
  }

  db.seq.login_attempts += 1;
  db.login_attempts.push({
    id: db.seq.login_attempts,
    email,
    ip_address: ip,
    attempted_at: nowIso(),
    was_successful: true,
  });
  saveDb(db);

  const newSession = regenerateSession(req, res, user.id);
  res.json({
    authenticated: true,
    sessionId: newSession.sessionId,
    csrfToken: newSession.csrfToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    },
  });
});

authRouter.post('/auth/setup-first-admin', (req: Request, res: Response) => {
  const existingAdmin = db.users.find((u) => u.role === 'admin' && u.status === 'active');
  if (existingAdmin) {
    res.status(403).json({
      error: 'An active administrator account already exists. Additional administrators must be promoted via CLI.',
    });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (name.length < 2 || name.length > 120) {
    res.status(422).json({ error: 'Administrator name must be between 2 and 120 characters.' });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(422).json({ error: 'Please enter a valid administrator email address.' });
    return;
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    res.status(422).json({
      error: 'Administrator password must be at least 8 characters and include at least 1 uppercase letter and 1 number.',
    });
    return;
  }
  if (password !== confirmPassword) {
    res.status(422).json({ error: 'Passwords do not match.' });
    return;
  }

  const exists = db.users.find((u) => u.email.toLowerCase() === email);
  if (exists) {
    res.status(409).json({ error: 'Email address is already in use by another account.' });
    return;
  }

  const ts = nowIso();
  db.seq.users += 1;
  const adminUser: UserRow = {
    id: db.seq.users,
    name,
    email,
    password_hash: hashPassword(password),
    role: 'admin',
    status: 'active',
    created_at: ts,
    updated_at: ts,
  };
  db.users.push(adminUser);
  recordAuditLog(adminUser.id, 'FIRST_ADMIN_PROVISIONED', 'user', String(adminUser.id), {
    email: adminUser.email,
    method: 'first_time_setup_wizard',
  });
  saveDb(db);

  const newSession = regenerateSession(req, res, adminUser.id);
  res.status(201).json({
    authenticated: true,
    sessionId: newSession.sessionId,
    csrfToken: newSession.csrfToken,
    user: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      status: adminUser.status,
      created_at: adminUser.created_at,
    },
  });
});

authRouter.post('/auth/logout', (req: Request, res: Response) => {
  const { session } = getAuthenticatedUser(req, res);
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }
  sessions.delete(session.sessionId);
  res.setHeader('Set-Cookie', 'LEDGER_ETBA_SESSID=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.json({ authenticated: false });
});

authRouter.put('/profile', (req: Request, res: Response) => {
  const { session, user } = getAuthenticatedUser(req, res);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!verifyCsrf(req, session)) {
    res.status(403).json({ error: 'Invalid CSRF token.' });
    return;
  }

  const action = String(req.body?.action || 'update_details');
  if (action === 'change_password') {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!verifyPassword(currentPassword, user.password_hash)) {
      res.status(400).json({ error: 'Current password verification failed.' });
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      res.status(422).json({
        error: 'New password must be at least 8 characters and include an uppercase letter and a number.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(422).json({ error: 'New password and confirmation do not match.' });
      return;
    }

    user.password_hash = hashPassword(newPassword);
    user.updated_at = nowIso();
    saveDb(db);
    res.json({ message: 'Password updated successfully.' });
    return;
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (name.length < 2 || name.length > 120) {
    res.status(422).json({ error: 'Name must be between 2 and 120 characters.' });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(422).json({ error: 'Please provide a valid email address.' });
    return;
  }
  const duplicate = db.users.find((u) => u.id !== user.id && u.email.toLowerCase() === email);
  if (duplicate) {
    res.status(409).json({ error: 'That email address is already registered to another user.' });
    return;
  }

  user.name = name;
  user.email = email;
  user.updated_at = nowIso();
  saveDb(db);

  res.json({
    message: 'Profile updated successfully.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    },
  });
});
