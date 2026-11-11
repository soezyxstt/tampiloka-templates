import { drizzle } from 'drizzle-orm/pg-proxy';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from './schema.ts';

const tables = Object.values(schema).map(table => getTableConfig(table));
export const sqliteTableNames = tables.map(t => t.name);
const byName = new Map(tables.map(t => [t.name, t]));
const booleanNames = new Set(tables.flatMap(t => t.columns.filter(c => c.getSQLType() === 'boolean').map(c => c.name)));
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
function defaultSQL(column: any): string {
  if (!column.hasDefault) return 'NULL';
  const v = column.default;
  if (v && typeof v === 'object' && 'queryChunks' in v) return "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
  if (v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v);
  return quote(typeof v === 'string' ? v : JSON.stringify(v));
}

/** Schema derived from the canonical Drizzle model. Run only on a new SQLite database. */
export function sqliteSchema(): string[] {
  return tables.flatMap(table => {
    const columns = table.columns.map(c => {
      const type = c.getSQLType();
      const sqliteType = type === 'serial' ? 'INTEGER' : /^(integer|bigint|boolean)/.test(type) ? 'INTEGER' : type === 'double precision' ? 'REAL' : 'TEXT';
      const primary = c.primary ? ' PRIMARY KEY' : '';
      const nullable = c.notNull && !c.primary ? ' NOT NULL' : '';
      const unique = c.isUnique ? ' UNIQUE' : '';
      const def = c.hasDefault && type !== 'serial' ? ` DEFAULT ${defaultSQL(c)}` : '';
      return `"${c.name}" ${sqliteType}${primary}${nullable}${unique}${def}`;
    });
    const create = `CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')})`;
    const indexes = table.indexes.map(i => `CREATE ${i.config.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${i.config.name}" ON "${table.name}" (${i.config.columns.map((c: any) => `"${c.name}"`).join(', ')})`);
    return [create, ...indexes];
  });
}

export function sqliteQuery(sql: string, params: unknown[], inTransaction: boolean) {
  if (/\sfor update\s*$/i.test(sql)) {
    if (!inTransaction) throw new Error('SQLite row locking requires a write transaction');
    sql = sql.replace(/\sfor update\s*$/i, '');
  }
  // Drizzle emits DEFAULT for omitted columns; SQLite requires the default expression instead.
  const insert = sql.match(/^insert into "([^"]+)" \(([^)]+)\) values (.+)$/i);
  if (insert) {
    const table = byName.get(insert[1]);
    if (!table) throw new Error('Unknown SQLite insert table');
    const columns = insert[2].split(', ').map(c => c.slice(1, -1));
    const prefix = `insert into "${insert[1]}" (${insert[2]}) values `;
    const tail = insert[3].replace(/\(([^()]*)\)/g, (group, contents: string) => {
      const values = contents.split(', ');
      if (columns.length !== values.length) throw new Error('Unsupported SQLite insert');
      return `(${values.map((v, i) => v === 'default' ? defaultSQL(table.columns.find(c => c.name === columns[i])!) : v).join(', ')})`;
    });
    sql = prefix + tail;
  }
  // Positional PG parameters are numbered; SQLite accepts ?NNN and preserves their order.
  sql = sql.replace(/\$(\d+)/g, '?$1');
  return { sql, args: params.map(v => typeof v === 'boolean' ? Number(v) : v) };
}

type Executor = { execute(query: { sql: string; args: any[] }): Promise<{ columns: string[]; rows: any[] }> };
type Client = Executor & { transaction(mode: 'write'): Promise<Executor & { commit(): Promise<void>; rollback(): Promise<void>; close(): void }> };
export function createSqliteDatabase(client: Client, readOnly = false) {
  function proxy(executor: Executor, inTransaction: boolean): any {
    const database = drizzle(async (sql, params) => {
      if (readOnly && !/^\s*select\b/i.test(sql)) throw new Error('D1 Cafe supports reads only; atomic mutations are unavailable');
      const query = sqliteQuery(sql, params, inTransaction);
      const result = await executor.execute(query);
      return { rows: result.rows.map(row => result.columns.map((name, index) => {
        const value = Array.isArray(row) ? row[index] : row[index] ?? row[name];
        return booleanNames.has(name) && value != null ? Boolean(value) : value;
      })) };
    }, { schema });
    Object.defineProperty(database, 'transaction', { configurable: true, value: async (fn: (tx: any) => Promise<any>) => {
      if (readOnly) throw new Error('D1 Cafe transactions are unavailable; no mutation was attempted');
      if (inTransaction) throw new Error('Nested SQLite transactions are unsupported');
      const tx = await client.transaction('write');
      try { const value = await fn(proxy(tx, true)); await tx.commit(); return value; }
      catch (error) { await tx.rollback(); throw error; }
      finally { tx.close(); }
    } });
    return database;
  }
  return proxy(client, false);
}
