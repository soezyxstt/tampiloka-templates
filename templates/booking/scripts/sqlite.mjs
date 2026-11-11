import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export class LocalDatabase {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    const migrations = new URL("../migrations/", import.meta.url);
    this.db.exec("CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()) {
        if (this.db.prepare("SELECT 1 FROM local_migrations WHERE name=?").get(name)) continue;
        this.db.exec(readFileSync(new URL(name, migrations), "utf8"));
        this.db.prepare("INSERT INTO local_migrations(name) VALUES(?)").run(name);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
  }
  prepare(sql) {
    const make = (args = []) => ({
      bind: (...values) => make(values),
      first: async (column) => {
        const row = this.db.prepare(sql).get(...args);
        return column ? (row?.[column] ?? null) : (row ?? null);
      },
      all: async () => ({
        results: this.db.prepare(sql).all(...args),
        success: true,
      }),
      run: async () => {
        const r = this.db.prepare(sql).run(...args);
        return { success: true, meta: { changes: Number(r.changes) } };
      },
      execute: () => {
        const st = this.db.prepare(sql);
        if (st.columns().length)
          return {
            success: true,
            results: st.all(...args),
            meta: { changes: 0 },
          };
        const r = st.run(...args);
        return {
          success: true,
          results: [],
          meta: { changes: Number(r.changes) },
        };
      },
      sql,
    });
    return make();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = statements.map((s) => s.execute());
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
export function localDatabase(demo) {
  const dir = resolve(process.env.BOOKING_DATA_DIR || ".data");
  mkdirSync(dir, { recursive: true });
  return new LocalDatabase(join(dir, demo ? "booking-demo.sqlite" : "booking-client.sqlite"));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  localDatabase(process.argv.includes("--demo")).close();
}
