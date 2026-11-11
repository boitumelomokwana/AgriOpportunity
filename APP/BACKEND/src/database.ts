import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedOpportunities } from './seed.js';

const databasePath = resolve(process.env.DATABASE_PATH ?? './data/agri-opportunity.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS saved_opportunities (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, opportunity_id)
  );
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, opportunity_id)
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    unread INTEGER NOT NULL DEFAULT 1
  );
`);

const insertOpportunity = db.prepare(`
  INSERT OR IGNORE INTO opportunities (id, data_json, published) VALUES (?, ?, 1)
`);
for (const opportunity of seedOpportunities) {
  insertOpportunity.run(opportunity.id, JSON.stringify(opportunity));
}

export function createInitialProfile(name: string, email: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    name,
    initials,
    email,
    phone: '',
    status: 'Other' as const,
    education: '',
    institution: '',
    fieldOfStudy: '',
    province: 'Gauteng' as const,
    preferences: {
      careerFields: [],
      preferredLocation: '',
      workArrangement: 'Flexible' as const,
      experience: '',
    },
    notificationPreferences: {
      closingDates: true,
      newMatches: true,
      savedUpdates: true,
      opportunityTypes: [],
    },
    completion: 0,
  };
}

export function createInitialNotifications(userId: string) {
  const notifications = [
    {
      id: 'new-matches',
      title: 'Welcome to NextStep SA',
      body: 'Browse the latest opportunities and save the ones you want to follow.',
      time: new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      group: 'Today' as const,
      unread: true,
      icon: 'star' as const,
    },
  ];
  const insert = db.prepare(
    'INSERT INTO notifications (id, user_id, data_json, unread) VALUES (?, ?, ?, 1)',
  );
  for (const notification of notifications) {
    const id = `${userId}-${notification.id}`;
    insert.run(id, userId, JSON.stringify({ ...notification, id }));
  }
}

export function seedDemoUser(email: string, password: string, name: string) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return;
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 12);
  const profile = createInitialProfile(name, email);
  db.prepare(
    'INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, email, name, passwordHash, 'admin', new Date().toISOString());
  db.prepare('INSERT INTO profiles (user_id, data_json) VALUES (?, ?)').run(id, JSON.stringify(profile));
  createInitialNotifications(id);
}
