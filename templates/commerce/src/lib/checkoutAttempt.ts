import type { CreateOrderInput } from '../shared/contracts';

export interface CheckoutAttempt {
  key: string;
  fingerprint: string;
  payload: Omit<CreateOrderInput, 'idempotencyKey'>;
}

export function readAttempt(): CheckoutAttempt | null {
  try { return JSON.parse(sessionStorage.getItem('tampiloka-checkout-attempt') || 'null'); }
  catch { return null; }
}

export function saveAttempt(value: CheckoutAttempt | null) {
  try {
    if (value) sessionStorage.setItem('tampiloka-checkout-attempt', JSON.stringify(value));
    else sessionStorage.removeItem('tampiloka-checkout-attempt');
  } catch { /* A live page still retains its idempotency key in memory. */ }
}
