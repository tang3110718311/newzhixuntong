import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { createRequire } from "node:module";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";

const nodeRequire = createRequire(import.meta.url);

type SqlJsStmt = {
  bind(params: unknown[]): boolean;
  step(): boolean;
  get(): unknown[];
  free(): boolean;
};

let db: SqlJsDatabase | null = null;
let dbPath: string = "";

export function getDatabasePath() {
  if (process.env.SQLITE_DB_PATH) {
    return resolve(process.env.SQLITE_DB_PATH);
  }
  return resolve(process.cwd(), "../../storage/dev.db");
}

/**
 * Locate the sql-wasm.wasm file from the sql.js package.
 * Next.js/webpack may not serve it automatically, so we pass an absolute path.
 */
function findWasmBinary(): string {
  const candidates: string[] = [];
  try {
    const pkgRoot = dirname(nodeRequire.resolve("sql.js"));
    candidates.push(join(pkgRoot, "sql-wasm.wasm"));
  } catch { /* ignore */ }
  candidates.push(resolve(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"));
  candidates.push(resolve(process.cwd(), "../../node_modules/sql.js/dist/sql-wasm.wasm"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "";
}

async function loadDb(): Promise<SqlJsDatabase> {
  dbPath = getDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });

  const wasmPath = findWasmBinary();
  const initOpts: Parameters<typeof initSqlJs>[0] = {};
  if (wasmPath) {
    initOpts.wasmBinary = readFileSync(wasmPath);
  }
  const SQL = await initSqlJs(initOpts);

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON;");
  return db;
}

function saveToFile() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  }
}

let initPromise: Promise<SqlJsDatabase> | null = null;

// Idempotent schema migrations. Applied after the DB loads so existing
// dev.db files (created before these tables existed) get the new tables.
const MIGRATION_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS exam_question_banks (
    id text primary key,
    tenant_id text not null,
    name text not null,
    description text not null default '',
    question_count integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS exam_questions (
    id text primary key,
    tenant_id text not null,
    bank_id text,
    type text not null,
    stem text not null,
    options text not null,
    answer text not null,
    analysis text not null default '',
    score integer not null default 5,
    sort_order integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS exams (
    id text primary key,
    tenant_id text not null,
    name text not null,
    code text,
    bank_id text,
    description text not null default '',
    duration_minutes integer not null default 60,
    pass_score integer not null default 60,
    total_score integer not null default 100,
    question_count integer not null default 0,
    status text not null default 'draft',
    start_at text,
    end_at text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS exam_attempts (
    id text primary key,
    tenant_id text not null,
    exam_id text not null,
    user_id text,
    score integer,
    total_score integer not null default 100,
    status text not null default 'pending',
    duration_seconds integer not null default 0,
    started_at text,
    finished_at text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS exam_answers (
    id text primary key,
    tenant_id text not null,
    attempt_id text not null,
    question_id text not null,
    user_answer text not null default '',
    is_correct integer not null default 0,
    score integer not null default 0,
    created_at text not null default (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id text primary key,
    tenant_id text not null,
    name text not null,
    code text not null,
    permissions text not null default '[]',
    status text not null default 'enabled',
    sort_order integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text,
    unique(tenant_id, code)
  )`,
  `CREATE TABLE IF NOT EXISTS menus (
    id text primary key,
    tenant_id text not null,
    parent_id text,
    name text not null,
    code text not null,
    icon text not null default '',
    sort_order integer not null default 0,
    status text not null default 'enabled',
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text,
    unique(tenant_id, code)
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id text primary key,
    tenant_id text not null,
    org_id text,
    name text not null,
    headcount integer not null default 0,
    status text not null default 'enabled',
    sort_order integer not null default 0,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_folders (
    id text primary key,
    tenant_id text not null,
    name text not null,
    description text not null default '',
    file_count integer not null default 0,
    total_size integer not null default 0,
    created_by text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_files (
    id text primary key,
    tenant_id text not null,
    folder_id text not null,
    file_id text not null,
    name text not null,
    mime_type text not null default 'application/octet-stream',
    size integer not null default 0,
    content text not null default '',
    summary text not null default '',
    parse_status text not null default 'parsing',
    parse_error text not null default '',
    created_by text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    deleted_at text
  )`,
];

function applyMigrations() {
  if (!db) return;
  for (const sql of MIGRATION_SQL) {
    db.run(sql);
  }
  ensureColumn("tasks", "description", "text not null default ''");
  saveToFile();
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  if (!db) return;
  const stmt = db.prepare(`PRAGMA table_info(${tableName})`);
  let exists = false;
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string };
    if (row.name === columnName) {
      exists = true;
      break;
    }
  }
  stmt.free();
  if (!exists) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export async function ensureDb() {
  if (db) return db;
  if (!initPromise) {
    initPromise = loadDb().then((loaded) => {
      db = loaded;
      applyMigrations();
      return db;
    });
  }
  return initPromise;
}

// Synchronous wrappers for compatibility - these assume DB is already loaded
export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call ensureDb() first.");
  }
  return db;
}

function normalizeParams(params: unknown[]): (string | number | null | Uint8Array)[] {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    if (typeof p === "number") return p;
    if (typeof p === "string") return p;
    if (Buffer.isBuffer(p) || p instanceof Uint8Array) return p as Uint8Array;
    return String(p);
  });
}

export function all<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  const normalized = normalizeParams(params);
  if (normalized.length > 0) stmt.bind(normalized);

  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as T);
  }
  stmt.free();
  return results;
}

export function get<T>(sql: string, params: unknown[] = []): T | undefined {
  const database = getDb();
  const stmt = database.prepare(sql);
  const normalized = normalizeParams(params);
  if (normalized.length > 0) stmt.bind(normalized);

  let result: T | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();
  return result;
}

export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const database = getDb();
  try {
    const normalized = normalizeParams(params);
    if (normalized.length > 0) {
      const stmt = database.prepare(sql);
      stmt.bind(normalized);
      stmt.step();
      stmt.free();
    } else {
      database.run(sql);
    }
    const changes = database.getRowsModified();
    saveToFile();
    return { changes, lastInsertRowid: 0 };
  } catch (err) {
    saveToFile();
    throw err;
  }
}

export function exec(sql: string) {
  const database = getDb();
  database.exec(sql);
  saveToFile();
}

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
