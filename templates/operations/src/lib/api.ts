import {persistAttempt,pendingAttempts,removeAttempt} from './attempt-storage.ts';
export class ApiError extends Error {
  constructor(public status: number, public code: string, public details: unknown) { super(code); }
}
export function recoveryPaymentId(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return;
  const body = error.details as {error?: {details?: {paymentId?: unknown}}} | null;
  const id = body?.error?.details?.paymentId;
  return typeof id === 'string' && id ? id : undefined;
}
// A retry can be corrected only after a definite business rejection. Auth,
// throttling, timeouts and identity conflicts do not establish the old outcome.
export function definiteRejection(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
    && ![401, 403, 408, 429].includes(error.status)
    && !['IDEMPOTENCY_MISMATCH','RECOVERY_SCOPE_INVALID'].includes(error.code.toUpperCase());
}
export async function request<T>(path: string, options: {method?: string; body?: unknown; csrf?: string; recoveryScope?:string; responseType?: 'text'} = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { Accept: options.responseType === 'text' ? 'text/csv' : 'application/json', ...((options.method === 'POST' || options.body !== undefined) ? {'Content-Type':'application/json'} : {}), ...(options.csrf ? {'X-CSRF-Token': options.csrf}: {}), ...(options.recoveryScope?{'X-Operations-Scope':options.recoveryScope}:{}) }, ...(options.body === undefined ? (options.method === 'POST' ? {body:'{}'} : {}) : {body: JSON.stringify(options.body)}) });
    const data = response.ok && options.responseType === 'text' ? await response.text() : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.error?.code || data?.code || (typeof data?.error === 'string' ? data.error : 'request_rejected'), data);
    if (data === null) throw new Error('invalid_response');
    return data as T;
  } finally { clearTimeout(timeout); }
}
export interface Attempt { recoveryScope?:string; id: string; type: string; payload: Record<string, unknown>; userId: string; createdAt: string }
const key = 'tl-operations-unresolved';
// Persist only unresolved command identities. No automatic replay or offline completion.
export function readAttempt(scope?:string): Attempt | null {
 if(scope){const next=pendingAttempts(scope)[0];if(next)return {...next,recoveryScope:scope};}
 // Legacy tab-only evidence can still be looked up, but must never be retried in an unknown scope.
 try {return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}
}
export function saveAttempt(value:Attempt) {
 if(!value.recoveryScope)throw new Error('recovery_scope_invalid');
 persistAttempt(value.recoveryScope,value);
}
export function clearAttempt(value:Attempt) {
 if(value.recoveryScope)removeAttempt(value.recoveryScope,value.id);
 else {const legacy=readAttempt();if(legacy?.id===value.id)sessionStorage.removeItem(key);}
}
