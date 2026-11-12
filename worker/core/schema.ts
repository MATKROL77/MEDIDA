/**
 * Tablas de la plataforma (MEDIDA y sus visitantes) y de cada empresa.
 *
 * Cada empresa tiene su propia base, en su propio Durable Object: sus
 * configuradores, las consultas de sus clientes y su uso no comparten
 * almacenamiento con los de ninguna otra.
 */

export const PLATFORM_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    marketing INTEGER NOT NULL DEFAULT 0,
    marketing_at INTEGER,
    reminders_email INTEGER NOT NULL DEFAULT 0,
    reminders_push INTEGER NOT NULL DEFAULT 0,
    last_activity_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS login_tokens (
    hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT,
    purpose TEXT NOT NULL,
    design_id TEXT,
    marketing INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS login_tokens_email ON login_tokens (email, expires_at)`,
  `CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS designs (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    summary TEXT NOT NULL,
    price INTEGER,
    preview TEXT,
    favorite INTEGER NOT NULL,
    cart INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS reminders (user_id TEXT NOT NULL, step INTEGER NOT NULL, due_at INTEGER NOT NULL, sent_at INTEGER, PRIMARY KEY (user_id, step))`,
  `CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notices (user_id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    type TEXT NOT NULL,
    interest TEXT NOT NULL,
    placement TEXT NOT NULL,
    path TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS events_at ON events (at)`,
  `CREATE TABLE IF NOT EXISTS consents (id TEXT NOT NULL, at INTEGER NOT NULL, version TEXT NOT NULL, analytics INTEGER NOT NULL, marketing INTEGER NOT NULL, PRIMARY KEY (id, at))`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    channel TEXT NOT NULL,
    interest TEXT NOT NULL,
    stage TEXT NOT NULL,
    notes TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL,
    configurator_limit INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tenant_members (tenant_id TEXT NOT NULL, email TEXT NOT NULL, PRIMARY KEY (tenant_id, email))`,
  `CREATE TABLE IF NOT EXISTS rate (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL)`,
];

export const TENANT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profile (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS configurators (
    id TEXT PRIMARY KEY,
    family TEXT NOT NULL,
    name TEXT NOT NULL,
    params TEXT NOT NULL,
    active INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    configurator_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    channel TEXT NOT NULL,
    config TEXT NOT NULL,
    summary TEXT NOT NULL,
    price INTEGER,
    status TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS inquiries_at ON inquiries (at)`,
  `CREATE TABLE IF NOT EXISTS usage (configurator_id TEXT NOT NULL, day TEXT NOT NULL, opens INTEGER NOT NULL DEFAULT 0, inquiries INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (configurator_id, day))`,
];
