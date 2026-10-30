import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeSystemMessage } from './system-messages.ts';

test('localizes known system messages without changing custom messages', () => {
  const message = 'Keranjang kosong. Tambahkan menu terlebih dahulu.';
  assert.equal(localizeSystemMessage(message, 'en'), 'The cart is empty. Add an item first.');
  assert.equal(localizeSystemMessage(message, 'id'), message);
  assert.equal(localizeSystemMessage('Teks buatan pengguna', 'en'), 'Teks buatan pengguna');
  assert.equal(localizeSystemMessage('Menu Kopi A sedang habis atau tidak tersedia.', 'en'), 'Kopi A is sold out or unavailable.');
  assert.equal(localizeSystemMessage('Pilihan wajib "Susu" pada Kopi belum lengkap.', 'en'), 'The required option "Susu" for Kopi is incomplete.');
});
