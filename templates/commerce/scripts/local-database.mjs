import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Development and tests only. Hosted Workers connect to Turso.
export class LocalDatabase {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
    const directory = new URL('../migrations/', import.meta.url);
    for (const name of readdirSync(directory).filter(file => file.endsWith('.sql')).sort()) {
      this.transaction(() => {
        if (this.db.prepare('SELECT 1 FROM local_migrations WHERE name=?').get(name)) return;
        this.db.exec(readFileSync(new URL(name, directory), 'utf8'));
        this.db.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);
      });
    }
  }

  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  prepare(sql) {
    const bind = (...args) => {
      const statement = () => this.db.prepare(sql);
      const run = () => {
        const { changes, lastInsertRowid } = statement().run(...args);
        return { results: [], success: true, meta: { changes, last_row_id: lastInsertRowid } };
      };
      const all = () => ({ results: statement().all(...args), success: true, meta: {} });
      return {
        sql, bind, run, all,
        first(column) {
          const row = statement().get(...args);
          return (column ? row?.[column] : row) ?? null;
        },
        execute: () => statement().columns().length ? all() : run(),
      };
    };
    return bind();
  }

  async batch(statements) {
    return this.transaction(() => statements.map(statement => statement.execute()));
  }

  close() { this.db.close(); }
}
