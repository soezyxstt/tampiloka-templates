import test from 'node:test';
import assert from 'node:assert/strict';
import { samplePhotos } from './sample-photos.ts';

test('legacy sample illustrations use real photos without overwriting custom images', () => {
  assert.deepEqual(samplePhotos([
    '/images/menu/es-kopi-susu-aren.svg',
    '/images/menu/es-kopi-susu-aren-2.svg',
    'https://example.com/custom.jpg',
  ]), ['/images/menu/photos/kopi-aren.jpg', 'https://example.com/custom.jpg']);
  assert.deepEqual(samplePhotos(['/images/menu/manual-brew-v60.svg', '/images/menu/nasi-ayam-rempah-2.svg', '/images/menu/matcha-latte-uji.svg', '/images/menu/croissant-mentega.svg']), [
    '/images/menu/photos/v60.jpg', '/images/menu/photos/ayam.jpg', '/images/menu/photos/matcha.jpg', '/images/menu/photos/croissant.jpg',
  ]);
  assert.deepEqual(samplePhotos([]), []);
});
