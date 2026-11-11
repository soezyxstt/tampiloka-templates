export type StorageEnv = Record<string, unknown> & { DB?: Database; DATABASE_PROVIDER?: string; OBJECT_STORAGE_PROVIDER?: string };
export interface Result<T = Record<string, unknown>> { success: boolean; results: T[]; meta: { changes?: number; last_row_id?: number; [key: string]: unknown } }
export interface Statement { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(column?: string): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<Result<T>>; run<T = Record<string, unknown>>(): Promise<Result<T>>; raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> }
export interface Database { prepare(sql: string): Statement; batch<T = Record<string, unknown>>(statements: Statement[]): Promise<Result<T>[]> }
export interface ObjectStorage { readonly privateUploads?: true; put(key: string, body: Uint8Array | Blob | string, options?: { contentType?: string }): Promise<{key: string; url?: string}>; get(key: string): Promise<{body: Uint8Array; contentType?: string} | null>; delete(key: string): Promise<void> }
export function resolveDatabase(env: object): Database;
export function resolveObjectStorage(env: object): ObjectStorage;
export function postgresSQL(sql: string): {sql: string; count: number};
export function postgresParameters(sql: string): {sql: string; count: number};
export function runMigrations(db: Database, migrations: Array<{id: string; statements: string[]}>): Promise<void>;

/** Create a D1-style adapter using a pg-compatible pool. */
export function createPostgresDatabase(pool: { connect(): Promise<{ query(config: any): Promise<any>; release(): void }> }): Database;
