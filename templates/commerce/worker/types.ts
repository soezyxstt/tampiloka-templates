export interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta: { changes?: number; last_row_id?: number; [key: string]: unknown } }
export interface D1Statement { bind(...values: unknown[]): D1Statement; first<T = Record<string, unknown>>(column?: string): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<D1Result<T>>; run<T = Record<string, unknown>>(): Promise<D1Result<T>> }
export interface D1Database { prepare(sql: string): D1Statement; batch<T = Record<string, unknown>>(statements: D1Statement[]): Promise<D1Result<T>[]>; exec(sql: string): Promise<unknown> }
export interface Env { DB: D1Database; ASSETS?: { fetch(request: Request): Promise<Response> }; DEMO_MODE?: string; COMMERCE_LEVEL?: string; STAFF_OWNER_PASSWORD?: string; STAFF_OPERATIONS_PASSWORD?: string; STAFF_VIEWER_PASSWORD?: string; MIDTRANS_SERVER_KEY?: string; MIDTRANS_ENVIRONMENT?: string; ALLOWED_ORIGIN?: string }
export interface Session { tokenHash: string; scope: string; role: 'customer' | 'owner' | 'operations' | 'viewer'; demo: boolean; cookie?: string }
export type Row = Record<string, any>;
