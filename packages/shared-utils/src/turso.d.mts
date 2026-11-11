export interface TursoBindings {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}
interface Result<T> {
  success: boolean;
  results: T[];
  meta: { changes: number };
}
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run(): Promise<Result<Record<string, unknown>>>;
  all<T = Record<string, unknown>>(): Promise<Result<T>>;
}
interface Database {
  prepare(sql: string): Statement;
  batch<T = Record<string, unknown>>(statements: Statement[]): Promise<Result<T>[]>;
}
export function createTursoDatabase(bindings: TursoBindings): Database;
