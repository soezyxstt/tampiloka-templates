import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocation, routeHref } from '../src/routing.ts';

test('page links use localized paths and retain independent demo and campaign state', () => {
  const current = resolveLocation('/', '?preset=institution&layout=institutional&theme=forest&campaign=school');
  const href = routeHref(current, { page: 'school-teachers' }, '#main-content');
  const url = new URL(href, 'https://school.example');
  assert.equal(url.pathname, '/tenaga-pendidik');
  assert.equal(url.searchParams.has('page'), false);
  assert.equal(url.searchParams.get('preset'), 'institution');
  assert.equal(url.searchParams.get('theme'), 'forest');
  assert.equal(url.searchParams.get('campaign'), 'school');
  assert.equal(url.hash, '#main-content');
  const state = resolveLocation(url.pathname, url.search);
  const english = new URL(routeHref(state, { lang: 'en' }), url);
  assert.equal(english.pathname, '/en/educators');
  assert.equal(english.searchParams.has('lang'), false);
  assert.equal(resolveLocation(english.pathname, english.search).get('page'), 'school-teachers');
});

test('private routes preserve role, selection and registration context without query page routing', () => {
  const current = resolveLocation('/', '?page=staff&view=staff&tab=content&role=editor&record=example');
  const admin = new URL(routeHref(current), 'https://school.example');
  assert.equal(admin.pathname, '/admin/content');
  const restored = resolveLocation(admin.pathname, admin.search);
  assert.equal(restored.get('view'), 'staff');
  assert.equal(restored.get('tab'), 'content');
  assert.equal(restored.get('record'), 'example');
  const application = new URL(routeHref(restored, { page: 'apply', view: 'student', program: 'kelas-vii' }), admin);
  assert.equal(application.pathname, '/daftar');
  assert.equal(resolveLocation(application.pathname, application.search).get('program'), 'kelas-vii');
  assert.equal(resolveLocation('/portal', '?view=guardian').get('view'), 'guardian');
  assert.equal(resolveLocation('/profil', '?page=staff&view=staff').get('view'), 'visitor');
});

test('legacy bookmarks normalize to routes and article slugs roundtrip safely', () => {
  const old = resolveLocation('/', '?page=story&story=cerita%20siswa&lang=en&preview=true');
  const url = new URL(routeHref(old), 'https://school.example');
  assert.equal(url.pathname, '/en/news/cerita%20siswa');
  assert.equal(url.searchParams.get('preview'), 'true');
  const parsed = resolveLocation(url.pathname, url.search);
  assert.equal(parsed.get('story'), 'cerita siswa');
  assert.equal(parsed.get('lang'), 'en');
  assert.equal(resolveLocation('/tenaga-pendidik/', '').get('page'), 'school-teachers');
  for (const path of ['/tidak-ada', '/berita/%2Fadmin', '/berita/%E0%A4%A']) assert.equal(resolveLocation(path, '').get('page'), '__not-found', path);
  assert.equal(routeHref(resolveLocation('/', ''), { page: 'school-profile' }), '/profil');
});
