import test from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorText } from '../src/lib/error-text.ts';

test('rate limiting asks users to wait in both languages', () => {
  assert.match(apiErrorText('RATE_LIMIT', 'Too many attempts. Please try later.', 'id'), /Tunggu/);
  assert.equal(apiErrorText('RATE_LIMIT', 'Too many attempts. Please try later.', 'en'), 'Too many attempts. Please try later.');
});
test('payment changes and expired sessions retain recovery instructions', () => {
  assert.match(apiErrorText('PAYMENT_CHANGED', 'Payment changed. Reload the appointment.', 'id'), /Muat ulang detail janji/);
  assert.equal(apiErrorText('PAYMENT_CHANGED', 'Payment changed. Reload the appointment.', 'en'), 'Payment changed. Reload the appointment.');
  assert.match(apiErrorText('SESSION_EXPIRED', '', 'id'), /Muat ulang/);
});
test('unknown errors do not blame input or encourage unsafe retries', () => {
  assert.equal(apiErrorText('UNKNOWN', 'Unexpected problem.', 'id'), 'Terjadi kendala. Jika berlanjut, hubungi pengelola.');
  assert.equal(apiErrorText('UNKNOWN', 'Unexpected problem.', 'en'), 'Unexpected problem.');
  assert.match(apiErrorText('UNKNOWN', '', 'en'), /contact the business/);
});
