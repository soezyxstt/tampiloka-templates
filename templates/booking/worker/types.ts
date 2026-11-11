import type { BusinessSettings, Preset, Role } from "../src/domain/model.ts";
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta?: { changes?: number };
  }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch<T = Record<string, unknown>>(
    statements: Statement[],
  ): Promise<{ results: T[]; success: boolean; meta?: { changes?: number } }[]>;
}
export interface Env {
  DB: Database;
  DATABASE_PROVIDER?: "d1" | "turso" | "postgresql";
  OBJECT_STORAGE_PROVIDER?: "s3" | "uploadthing";
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  DATABASE_URL?: string;
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_REGION?: string;
  S3_PUBLIC_URL?: string;
  UPLOADTHING_TOKEN?: string;
  UPLOADTHING_API_URL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  DEMO_MODE?: string;
  STAFF_OWNER_PASSWORD?: string;
  STAFF_OPERATIONS_PASSWORD?: string;
  STAFF_VIEWER_PASSWORD?: string;
  TICKET_SECRET?: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_ENVIRONMENT?: "sandbox" | "production";
  NOTIFICATION_API_KEY?: string;
  NOTIFICATION_FROM?: string;
  BOOKING_CONFIG?: Partial<BusinessSettings>;
  NOW?: () => number;
}
export interface Session {
  hash: string;
  scope: string;
  principal: string;
  role: Role;
  demo: boolean;
  cookie?: string;
}
export interface ScopeRow {
  id: string;
  demo: number;
  state_json: string;
  secret: string;
  revision: number;
  expires_at: number | null;
}
export interface BookingRow {
  id: string;
  scope: string;
  preset: Preset;
  principal: string;
  customer_id: string;
  customer_json: string;
  reference: string;
  idempotency_key: string;
  request_hash: string;
  access_hash: string;
  service_id: string;
  item_json: string;
  location_id: string;
  location_name: string;
  timezone: string;
  practitioner_id: string;
  practitioner_name: string;
  starts_at: number;
  ends_at: number;
  status: import("../src/domain/model.ts").BookingStatus;
  payment_status: import("../src/domain/model.ts").PaymentStatus;
  payment_method: "location" | "online";
  total: number;
  due_now: number;
  paid_amount: number;
  refunded_amount: number;
  refund_eligible: number;
  policy_json: string;
  options_json: string;
  expires_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
}
export interface PaymentRow {
  id: string;
  scope: string;
  booking_id: string;
  provider: string;
  amount: number;
  status: string;
  reference: string;
  checkout_url: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}
export interface TicketRow {
  id: string;
  scope: string;
  booking_id: string;
  used_at: number | null;
  revoked: number;
}
export const now = (env: Env) => env.NOW?.() ?? Date.now();
