import bcrypt from 'bcryptjs';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { db, createInitialNotifications, createInitialProfile } from './database.js';
import { requireAdmin, requireAuth, signToken } from './auth.js';
import { applicationStatuses, opportunityCategories, provinces, type Opportunity } from './types.js';

export const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: configuredOrigins.includes('*') ? true : configuredOrigins,
}));
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  initials: z.string().max(4),
  email: z.string().trim().email().max(254),
  phone: z.string().max(30),
  status: z.enum(['Learner', 'Student', 'Graduate', 'Job seeker', 'Other']),
  education: z.string().max(120),
  institution: z.string().max(160),
  fieldOfStudy: z.string().max(160),
  province: z.enum(provinces),
  preferences: z.object({
    careerFields: z.array(z.string().max(80)).max(30),
    preferredLocation: z.string().max(120),
    workArrangement: z.enum(['Flexible', 'On-site', 'Remote']),
    experience: z.string().max(80),
  }),
  notificationPreferences: z.object({
    closingDates: z.boolean(),
    newMatches: z.boolean(),
    savedUpdates: z.boolean(),
    opportunityTypes: z.array(z.enum(opportunityCategories)),
  }),
  completion: z.number().int().min(0).max(100),
});
const applicationSchema = z.object({
  status: z.enum(applicationStatuses),
});

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function userProfile(userId: string) {
  const row = db.prepare('SELECT data_json FROM profiles WHERE user_id = ?').get(userId) as
    | { data_json: string }
    | undefined;
  return row ? parseJson<Record<string, unknown>>(row.data_json) : null;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', authLimiter, (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid registration details.', details: parsed.error.flatten() });
    return;
  }
  const { name, email, password } = parsed.data;
  const id = randomUUID();
  try {
    const insertUser = db.prepare(`
      INSERT INTO users (id, email, name, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertProfile = db.prepare(
      'INSERT INTO profiles (user_id, data_json) VALUES (?, ?)',
    );
    const createUser = db.transaction(() => {
      insertUser.run(id, email.toLowerCase(), name, bcrypt.hashSync(password, 12), new Date().toISOString());
      insertProfile.run(id, JSON.stringify(createInitialProfile(name, email.toLowerCase())));
      createInitialNotifications(id);
    });
    createUser();
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    next(error);
    return;
  }
  const user = { id, email: email.toLowerCase(), role: 'user' as const };
  res.status(201).json({ token: signToken(user), user, profile: userProfile(id) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password.' });
    return;
  }
  const row = db.prepare('SELECT id, email, role, password_hash FROM users WHERE email = ?')
    .get(parsed.data.email.toLowerCase()) as
    | { id: string; email: string; role: 'user' | 'admin'; password_hash: string }
    | undefined;
  if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash)) {
    res.status(401).json({ error: 'Email or password is incorrect.' });
    return;
  }
  const user = { id: row.id, email: row.email, role: row.role };
  res.json({ token: signToken(user), user, profile: userProfile(row.id) });
});

app.get('/api/opportunities', (_req, res) => {
  const rows = db.prepare('SELECT data_json FROM opportunities WHERE published = 1 ORDER BY id')
    .all() as { data_json: string }[];
  res.json(rows.map((row) => parseJson<Opportunity>(row.data_json)));
});

app.get('/api/opportunities/:id', (req, res) => {
  const row = db.prepare(
    'SELECT data_json FROM opportunities WHERE id = ? AND published = 1',
  ).get(req.params.id) as { data_json: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Opportunity not found.' });
    return;
  }
  res.json(parseJson<Opportunity>(row.data_json));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user, profile: userProfile(req.user!.id) });
});

app.get('/api/me/profile', requireAuth, (req, res) => {
  const profile = userProfile(req.user!.id);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found.' });
    return;
  }
  res.json(profile);
});

app.put('/api/me/profile', requireAuth, (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid profile.', details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.email.toLowerCase() !== req.user!.email.toLowerCase()) {
    res.status(400).json({ error: 'Changing the account email is not supported.' });
    return;
  }
  db.prepare('UPDATE profiles SET data_json = ? WHERE user_id = ?')
    .run(JSON.stringify(parsed.data), req.user!.id);
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(parsed.data.name, req.user!.id);
  res.json(parsed.data);
});

app.get('/api/me/saved', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT opportunity_id FROM saved_opportunities WHERE user_id = ? ORDER BY created_at',
  ).all(req.user!.id) as { opportunity_id: string }[];
  res.json(rows.map((row) => row.opportunity_id));
});

app.post('/api/me/saved/:opportunityId', requireAuth, (req, res) => {
  const id = req.params.opportunityId;
  const exists = db.prepare('SELECT id FROM opportunities WHERE id = ? AND published = 1').get(id);
  if (!exists) {
    res.status(404).json({ error: 'Opportunity not found.' });
    return;
  }
  db.prepare(
    'INSERT OR IGNORE INTO saved_opportunities (user_id, opportunity_id, created_at) VALUES (?, ?, ?)',
  ).run(req.user!.id, id, new Date().toISOString());
  res.status(204).end();
});

app.delete('/api/me/saved/:opportunityId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_opportunities WHERE user_id = ? AND opportunity_id = ?')
    .run(req.user!.id, req.params.opportunityId);
  res.status(204).end();
});

app.get('/api/me/applications', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, opportunity_id, status, updated_at
    FROM applications WHERE user_id = ? ORDER BY updated_at DESC
  `).all(req.user!.id) as {
    id: string;
    opportunity_id: string;
    status: (typeof applicationStatuses)[number];
    updated_at: string;
  }[];
  res.json(rows.map((row) => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    status: row.status,
    updatedAt: row.updated_at,
    source: 'user' as const,
  })));
});

app.post('/api/me/applications/:opportunityId', requireAuth, (req, res) => {
  const opportunityId = req.params.opportunityId;
  const exists = db.prepare('SELECT id FROM opportunities WHERE id = ? AND published = 1')
    .get(opportunityId);
  if (!exists) {
    res.status(404).json({ error: 'Opportunity not found.' });
    return;
  }
  const id = randomUUID();
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO applications (id, user_id, opportunity_id, status, updated_at)
    VALUES (?, ?, ?, 'Interested', ?)
    ON CONFLICT (user_id, opportunity_id) DO NOTHING
  `).run(id, req.user!.id, opportunityId, updatedAt);
  const row = db.prepare(`
    SELECT id, opportunity_id, status, updated_at
    FROM applications WHERE user_id = ? AND opportunity_id = ?
  `).get(req.user!.id, opportunityId) as {
    id: string;
    opportunity_id: string;
    status: (typeof applicationStatuses)[number];
    updated_at: string;
  };
  res.status(201).json({
    id: row.id,
    opportunityId: row.opportunity_id,
    status: row.status,
    updatedAt: row.updated_at,
    source: 'user',
  });
});

app.patch('/api/me/applications/:id', requireAuth, (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid application status.', details: parsed.error.flatten() });
    return;
  }
  const updatedAt = new Date().toISOString();
  const result = db.prepare(
    'UPDATE applications SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
  ).run(parsed.data.status, updatedAt, req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Application not found.' });
    return;
  }
  res.json({
    id: req.params.id,
    status: parsed.data.status,
    updatedAt,
  });
});

app.get('/api/me/notifications', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT data_json, unread FROM notifications WHERE user_id = ? ORDER BY rowid DESC',
  ).all(req.user!.id) as { data_json: string; unread: number }[];
  res.json(rows.map((row) => ({
    ...parseJson<Record<string, unknown>>(row.data_json),
    unread: row.unread === 1,
  })));
});

app.patch('/api/me/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET unread = 0 WHERE user_id = ?').run(req.user!.id);
  res.status(204).end();
});

app.patch('/api/me/notifications/:id/read', requireAuth, (req, res) => {
  const result = db.prepare(
    'UPDATE notifications SET unread = 0 WHERE id = ? AND user_id = ?',
  ).run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  res.status(204).end();
});

app.get('/api/admin/opportunities', requireAuth, requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT data_json FROM opportunities ORDER BY id').all() as
    { data_json: string }[];
  res.json(rows.map((row) => parseJson<Opportunity>(row.data_json)));
});

const listingSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(3).max(160),
  organisation: z.string().trim().min(2).max(160),
  category: z.enum(opportunityCategories),
  province: z.enum(provinces),
  location: z.string().max(160),
  education: z.string().max(160),
  closes: z.string().max(40),
  closingDate: z.string().datetime(),
  closingTone: z.enum(['urgent', 'soon', 'normal']),
  match: z.number().int().min(0).max(100),
  summary: z.string().max(1000),
  field: z.string().max(160),
  mode: z.enum(['On-site', 'Hybrid', 'Remote']),
  eligibility: z.array(z.string().max(300)).max(30),
  qualifications: z.object({ education: z.string(), field: z.string() }),
  documents: z.array(z.string().max(160)).max(30),
  howToApply: z.array(z.string().max(500)).max(30),
  sourceName: z.string().max(160),
  sourceUrl: z.string().url(),
  lastUpdated: z.string(),
  isExpired: z.boolean().optional(),
});

app.put('/api/admin/opportunities/:id', requireAuth, requireAdmin, (req, res) => {
  const parsed = listingSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid opportunity listing.', details: parsed.error.flatten() });
    return;
  }
  db.prepare(`
    INSERT INTO opportunities (id, data_json, published) VALUES (?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json
  `).run(parsed.data.id, JSON.stringify(parsed.data));
  res.json(parsed.data);
});

app.delete('/api/admin/opportunities/:id', requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Opportunity not found.' });
    return;
  }
  res.status(204).end();
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
};
app.use(errorHandler);
