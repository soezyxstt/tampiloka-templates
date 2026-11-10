/** Minimal platform surface used here; replace with wrangler-generated types before deployment. */
declare module 'cloudflare:workers' {
 export class DurableObject<E = unknown> { protected ctx: OperationsObjectContext; protected env: E; constructor(ctx: OperationsObjectContext, env: E); }
}
interface OperationsSql { exec<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, ...bindings: (string|number|null)[]): {toArray(): T[]; one(): T}; }
interface OperationsObjectContext { storage: {sql: OperationsSql; transactionSync<T>(callback:()=>T):T}; blockConcurrencyWhile<T>(callback:()=>Promise<T>):Promise<T>; }
