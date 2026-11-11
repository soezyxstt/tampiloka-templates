import { getTableConfig } from 'drizzle-orm/pg-core';
import * as attendanceSchema from '../plugins/attendance/schema.ts';
import { createSqliteDatabase, sqliteSchema, sqliteTableNames } from './sqlite.ts';

export const D1_STATE_VERSION = 1;
export const D1_STATE_MAX_BYTES = 1_500_000;
export const D1_STATE_SCHEMA = 'CREATE TABLE cafe_state (outlet_id TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL)';
const MAX_ATTEMPTS = 5;

// Version 1 existed before attendance. Freeze its exact table sets; only additions
// belonging to the attendance schema may be initialized empty by this migration.
const V1_BUSINESS_TABLES = [
  'users', 'tenants', 'outlets', 'staff_outlet_roles', 'staff_session_assurances',
  'customer_memberships', 'wifi_networks', 'payment_accounts', 'rooms', 'layout_versions',
  'tables', 'visits', 'table_assignments', 'seating_groups', 'guest_sessions',
  'visit_participants', 'presence_checks', 'join_codes', 'waitlist_entries', 'stations',
  'menu_categories', 'stock_pools', 'menu_items', 'menu_variants', 'modifier_groups',
  'modifier_options', 'stock_movements', 'quotes', 'order_requests', 'orders', 'order_lines',
  'order_item_units', 'bills', 'bill_unit_allocations', 'payment_attempts', 'payment_receipts',
  'financial_adjustments', 'refunds', 'reconciliation_cases', 'promotion_rules',
  'reward_entitlements', 'loyalty_qualifications', 'service_requests', 'feedback_entries',
  'cash_shifts', 'cash_movements', 'import_batches', 'audit_events', 'idempotency_records', 'outbox_events',
];
const V1_INITIAL_ATTENDANCE = ['attendance_events', 'attendance_corrections', 'attendance_locks', 'attendance_evidence'];
const V1_LEGACY_TABLE_SETS = [V1_BUSINESS_TABLES, [...V1_BUSINESS_TABLES, ...V1_INITIAL_ATTENDANCE]];

function normalizeV1State(state: Record<string, any[]>) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid Cafe D1 state tables');
  const matches = (names: string[]) => Object.keys(state).length === names.length && names.every(name => Object.hasOwn(state, name) && Array.isArray(state[name]));
  if (matches(sqliteTableNames)) return state;
  const attendanceNames = new Set(Object.values(attendanceSchema).map(table => getTableConfig(table).name));
  const legacy = V1_LEGACY_TABLE_SETS.find(names => matches(names)
    && names.every(name => sqliteTableNames.includes(name))
    && sqliteTableNames.every(name => names.includes(name) || attendanceNames.has(name)));
  if (!legacy) throw new Error('Invalid Cafe D1 state tables');
  return Object.fromEntries(sqliteTableNames.map(name => [name, Object.hasOwn(state, name) ? state[name] : []]));
}

// D1 has no interactive transaction API. Each attempt runs locally and publishes one
// complete snapshot with a compare-and-swap; callers must keep callbacks DB-only.
export async function materializeCafeState(state?: Record<string, any[]>) {
  const { DatabaseSync } = await import('node:sqlite');
  const sql = new DatabaseSync(':memory:');
  try {
    for (const statement of sqliteSchema()) sql.exec(statement);
    if (state !== undefined) {
      const normalized = normalizeV1State(state);
      for (const name of sqliteTableNames) for (const row of normalized[name]) {
        const columns = Object.keys(row);
        const quoted = columns.map(c => `"${c.replaceAll('"', '""')}"`).join(', ');
        sql.prepare(`INSERT INTO "${name}" (${quoted}) VALUES (${columns.map(() => '?').join(', ')})`).run(...columns.map(c => row[c]));
      }
    }
    const execute = async ({ sql: query, args }: { sql: string; args: any[] }) => {
      const stmt = sql.prepare(query);
      const columns = stmt.columns().map(c => c.name);
      // Drizzle maps by position; object rows lose duplicate column names in joins.
      (stmt as any).setReturnArrays(true);
      return { columns, rows: stmt.all(...args) };
    };
    const client = { execute, transaction: async () => {
      sql.exec('BEGIN IMMEDIATE');
      return { execute, commit: async () => { sql.exec('COMMIT'); }, rollback: async () => { sql.exec('ROLLBACK'); }, close() {} };
    } };
    return { sql, client, db: createSqliteDatabase(client), exportState: () => Object.fromEntries(sqliteTableNames.map(name => [name, sql.prepare(`SELECT * FROM "${name}"`).all()])) };
  } catch (error) { sql.close(); throw error; }
}

export function encodeCafeState(state: unknown) {
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json, 'utf8') > D1_STATE_MAX_BYTES) throw new Error('Cafe D1 state capacity exceeded (1,500,000 bytes); no changes committed');
  return json;
}

export function createD1StateDatabase(getRemote: () => Promise<any>, outletId: string) {
  async function attempt<T>(operation: (local: Awaited<ReturnType<typeof materializeCafeState>>) => Promise<T>, write: boolean): Promise<T> {
    const remote = await getRemote();
    for (let i = 0; i < (write ? MAX_ATTEMPTS : 1); i++) {
      const row = await remote.prepare('SELECT schema_version, revision, state_json FROM cafe_state WHERE outlet_id = ?').bind(outletId).first();
      if (!row) throw new Error('Cafe D1 state is not initialized for this outlet');
      if (row.schema_version !== D1_STATE_VERSION) throw new Error(`Unsupported Cafe D1 state schema version: ${row.schema_version}`);
      const local = await materializeCafeState(JSON.parse(row.state_json));
      try {
        const value = await operation(local);
        if (!write) return value;
        const json = encodeCafeState(local.exportState());
        const result = await remote.prepare('UPDATE cafe_state SET state_json = ?, revision = revision + 1 WHERE outlet_id = ? AND revision = ? AND schema_version = ?').bind(json, outletId, row.revision, D1_STATE_VERSION).run();
        if (result.meta?.changes === 1) return value;
        if (result.meta?.changes !== 0) throw new Error('Cafe D1 CAS did not report affected changes');
      } finally { local.sql.close(); }
    }
    throw new Error('Cafe D1 transaction conflict: retry limit exceeded');
  }
  const client = {
    execute: async (query: { sql: string; args: any[] }) => {
      // Only plain SELECT is treated as read-only; all other SQL is committed via CAS.
      const read = /^\s*select\b/i.test(query.sql) && !/\bfor\s+update\s*$/i.test(query.sql);
      return attempt(local => local.client.execute(query), !read);
    },
    transaction: async () => { throw new Error('Internal D1 transaction adapter misuse'); },
  };
  const db = createSqliteDatabase(client);
  Object.defineProperty(db, 'transaction', { value: (fn: (tx: any) => Promise<any>) => attempt(local => local.db.transaction(fn), true) });
  return db;
}
