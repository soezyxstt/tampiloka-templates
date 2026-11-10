import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, definiteRejection, recoveryPaymentId } from '../src/lib/api.ts';

test('a rejected retry can be corrected, while uncertain outcomes retain their identity', () => {
  for (const code of ['QUOTE_CHANGED', 'RECEIPT_EXCESS', 'INSUFFICIENT_STOCK', 'INVALID_INPUT']) {
    assert.equal(definiteRejection(new ApiError(409, code, {})), true);
  }
  for (const [status, code] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [408, 'TIMEOUT'], [429, 'RATE_LIMIT'], [500, 'INTERNAL_ERROR'], [409, 'IDEMPOTENCY_MISMATCH'], [409, 'RECOVERY_SCOPE_INVALID']]) {
    assert.equal(definiteRejection(new ApiError(status, code, {})), false);
  }
  assert.equal(definiteRejection(new Error('Network disconnected')), false);
});

test('collected money recovery reads the Worker error envelope without treating a message as evidence', () => {
  const error = new ApiError(409, 'QUOTE_CHANGED', {error:{code:'QUOTE_CHANGED',details:{paymentId:'payment-123',requiresReview:true}}});
  assert.equal(recoveryPaymentId(error), 'payment-123');
  assert.equal(recoveryPaymentId(new Error('payment-123')), undefined);
  assert.equal(recoveryPaymentId(new ApiError(409, 'QUOTE_CHANGED', {paymentId:'untrusted-shape'})), undefined);
});
