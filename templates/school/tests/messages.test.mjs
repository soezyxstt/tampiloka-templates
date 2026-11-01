import test from 'node:test';
import assert from 'node:assert/strict';
import { errorText } from '../src/messages.ts';

test('registration errors use localized extension labels and never expose unknown field keys', () => {
  const fields = [{ name: 'experience', label: { id: 'Pengalaman belajar', en: 'Learning experience' }, type: 'text' }];
  assert.equal(errorText('required:experience', 'id', fields), 'Lengkapi kolom Pengalaman belajar.');
  assert.equal(errorText('invalid:experience', 'en', fields), 'Check Learning experience.');
  for (const lang of ['id', 'en']) {
    assert.ok(!errorText('required:private_internal_key', lang, fields).includes('private_internal_key'));
    assert.ok(!errorText('unknown_internal_code', lang).includes('unknown_internal_code'));
  }
});
