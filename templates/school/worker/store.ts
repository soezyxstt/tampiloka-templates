import type { SchoolState } from '../src/domain/types.ts';
import { check, DomainError } from '../src/domain/capabilities.ts';
export interface Statement {
    bind(...values: unknown[]): Statement;
    first<T>(): Promise<T | null>;
    run(): Promise<{
        meta: {
            changes: number;
        };
    }>;
    all<T>(): Promise<{
        results: T[];
    }>;
}
export interface Database {
    prepare(sql: string): Statement;
    withSession?(constraint: string): Database;
}
interface Row {
    revision: number;
    data: string;
}
export class Store {
    db: Database;
    namespace: string;
    initial: () => SchoolState;
    expiry: number | null;
    constructor(db: Database, namespace: string, initial: () => SchoolState, expiry: number | null = null) { this.db = db.withSession?.('first-primary') ?? db; this.namespace = namespace; this.initial = initial; this.expiry = expiry; }
    async load(): Promise<{
        state: SchoolState;
        revision: number;
    }> {
        let row = await this.db.prepare('SELECT revision,data FROM school_state WHERE namespace=?').bind(this.namespace).first<Row>();
        if (!row) {
            await this.db.prepare('INSERT INTO school_state(namespace,revision,data,expires_at) VALUES(?,0,?,?) ON CONFLICT(namespace) DO NOTHING').bind(this.namespace, JSON.stringify(this.initial()), this.expiry).run();
            row = await this.db.prepare('SELECT revision,data FROM school_state WHERE namespace=?').bind(this.namespace).first<Row>();
        }
        check(row, 'storage_unavailable', 503);
        return { state: JSON.parse(row.data) as SchoolState, revision: row.revision };
    }
    /** A pure callback may run again on a CAS conflict. No network effects inside. */
    async mutate<T>(fn: (s: SchoolState) => T): Promise<T> {
        for (let attempt = 0; attempt < 64; attempt++) {
            const { state, revision } = await this.load();
            const result = fn(state);
            const data = JSON.stringify(state);
            check(new TextEncoder().encode(data).length <= 1500000, 'center_storage_limit', 507);
            const update = await this.db.prepare('UPDATE school_state SET data=?,revision=revision+1 WHERE namespace=? AND revision=?').bind(data, this.namespace, revision).run();
            if (update.meta.changes === 1)
                return result;
            await new Promise(r => setTimeout(r, Math.min(4 * attempt, 50)));
        }
        throw new DomainError('concurrent_update_retry', 409);
    }
    async reset() { check(this.namespace.startsWith('demo:'), 'demo_only', 403); await this.db.prepare('DELETE FROM school_state WHERE namespace=?').bind(this.namespace).run(); }
}
