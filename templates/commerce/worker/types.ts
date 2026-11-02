import type { createTursoDatabase } from '@tampiloka/shared-utils/turso';

type SqlDatabase = ReturnType<typeof createTursoDatabase>;
export type SqlStatement = ReturnType<SqlDatabase['prepare']>;
export interface Bindings { TURSO_DATABASE_URL?: string; TURSO_AUTH_TOKEN?: string; ASSETS?: { fetch(request: Request): Promise<Response> }; DEMO_MODE?: string; COMMERCE_LEVEL?: string; STAFF_OWNER_PASSWORD?: string; STAFF_OPERATIONS_PASSWORD?: string; STAFF_VIEWER_PASSWORD?: string; MIDTRANS_SERVER_KEY?: string; MIDTRANS_ENVIRONMENT?: string; ALLOWED_ORIGIN?: string; RESEND_API_KEY?: string; MEMBER_EMAIL_FROM?: string }
export interface Env extends Bindings { DB: SqlDatabase }
export interface Session { tokenHash: string; scope: string; role: 'customer' | 'owner' | 'operations' | 'viewer'; demo: boolean; memberId?: string | null; cookie?: string }
export type Row = Record<string, any>;
