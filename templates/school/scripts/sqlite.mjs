import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
export async function database(path = ':memory:') {
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    db.exec(await readFile(new URL('../migrations/0001_school.sql', import.meta.url), 'utf8'));
    return {
        raw: db,
        prepare(sql) {
            return {
                values: [],
                bind(...values) { this.values = values; return this; },
                async first() { return db.prepare(sql).get(...this.values) ?? null; },
                async run() { const result = db.prepare(sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; },
                async all() { return { results: db.prepare(sql).all(...this.values) }; },
            };
        },
    };
}
