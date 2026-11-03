import config from '../config/school.json' with { type: 'json' };
import { layouts, levels, palettes, presets, typography } from './domain/capabilities.ts';

const routes: Record<string, [string, string]> = {
  home: ['', ''], 'school-profile': ['profil', 'school-profile'], 'school-vision': ['visi-misi', 'vision-mission'],
  'school-contact': ['kontak', 'contact'], 'school-admissions': ['penerimaan', 'admissions'],
  'school-admissions-test': ['penerimaan/jalur-tes', 'admissions/test-pathway'],
  'school-admissions-achievement': ['penerimaan/jalur-prestasi', 'admissions/achievement-pathway'],
  'school-life': ['kehidupan-sekolah', 'school-life'], 'school-activities': ['kegiatan', 'activities'],
  'school-extracurricular': ['ekstrakurikuler', 'extracurriculars'], 'school-immersion': ['immersion', 'immersion'],
  'school-teachers': ['tenaga-pendidik', 'educators'], news: ['berita', 'news'], achievements: ['prestasi', 'achievements'],
  gallery: ['galeri', 'gallery'], 'school-admin-info': ['informasi', 'information'],
  programs: ['program', 'programs'], teachers: ['pengajar', 'teachers'], schedule: ['jadwal', 'schedule'],
  about: ['tentang', 'about'], announcements: ['pengumuman', 'announcements'], inquiry: ['hubungi', 'inquiry'],
  apply: ['daftar', 'apply'], portal: ['portal', 'portal'], staff: ['admin', 'admin'],
};
const defaults: Record<string, string> = { preset: config.preset, level: config.level, layout: config.appearance.layout, theme: config.appearance.palette, typography: config.appearance.typography, view: 'visitor', lang: config.locale, page: 'home' };
const choices: Record<string, readonly string[]> = { preset: presets, level: levels, layout: layouts, theme: palettes, typography, view: ['visitor', 'student', 'guardian', 'staff', 'tutor'], lang: ['id', 'en'] };
const validSegment = (value: string) => value.length > 0 && !/[\u0000-\u001f/\\]/.test(value) && !['.', '..'].includes(value);

// Query page links remain readable for existing catalog links and saved bookmarks.
export function resolveLocation(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  let parts: string[];
  try { parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); }
  catch { parts = ['__invalid-path']; }
  const english = parts[0] === 'en';
  if (english) parts.shift();
  if (parts.length || english || !params.has('page')) {
    const language = english ? 1 : 0;
    const path = parts.join('/');
    const page = Object.keys(routes).find(key => routes[key][language] === path);
    params.delete('story');
    if (page !== 'apply') params.delete('program');
    if (page !== 'staff') params.delete('tab');
    if (page) params.set('page', page);
    else if (parts.length === 2 && validSegment(parts[1]) && ['berita', 'news', 'program', 'programs', 'halaman', 'pages', 'admin'].includes(parts[0])) {
      const kind = parts[0];
      params.set('page', kind === 'admin' ? 'staff' : ['berita', 'news'].includes(kind) ? 'story' : ['program', 'programs'].includes(kind) ? 'program' : parts[1]);
      if (kind === 'admin') params.set('tab', parts[1]);
      else if (['berita', 'news'].includes(kind)) params.set('story', parts[1]);
      else if (['program', 'programs'].includes(kind)) params.set('program', parts[1]);
    } else params.set('page', '__not-found');
    params.set('lang', english ? 'en' : (parts.length ? 'id' : params.get('lang') ?? config.locale));
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (!params.has(key) || choices[key] && !choices[key].includes(params.get(key)!)) params.set(key, value);
  }
  const page = params.get('page');
  params.set('view', page === 'staff' ? params.get('view') === 'tutor' ? 'tutor' : 'staff' : ['portal', 'apply'].includes(page!) ? params.get('view') === 'guardian' ? 'guardian' : 'student' : 'visitor');
  return params;
}

export function routeHref(current: URLSearchParams, patch: Record<string, string> = {}, hash = '') {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) value === '' ? params.delete(key) : params.set(key, value);
  const page = params.get('page') ?? 'home';
  const language = params.get('lang') === 'en' ? 1 : 0;
  let path = routes[page]?.[language];
  if (page === 'story') path = `${routes.news[language]}/${encodeURIComponent(params.get('story') ?? '')}`;
  else if (page === 'program') path = `${routes.programs[language]}/${encodeURIComponent(params.get('program') ?? '')}`;
  else if (page === 'staff' && params.get('tab') && params.get('tab') !== 'overview') path = `admin/${encodeURIComponent(params.get('tab')!)}`;
  else if (path === undefined) path = `${language ? 'pages' : 'halaman'}/${encodeURIComponent(page)}`;
  for (const key of ['page', 'story', 'tab', 'lang']) params.delete(key);
  if (page !== 'apply') params.delete('program');
  if (!(['portal', 'apply'].includes(page) && params.get('view') === 'guardian') && !(page === 'staff' && params.get('view') === 'tutor')) params.delete('view');
  if (!['staff', 'story'].includes(page)) params.delete('record');
  for (const [key, value] of Object.entries(defaults)) if (params.get(key) === value) params.delete(key);
  const query = params.toString();
  return `${language ? '/en' : ''}/${path}${query ? '?' + query : ''}${hash}`;
}
