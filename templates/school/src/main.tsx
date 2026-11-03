import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { SlidersHorizontal, RotateCcw, Users, GraduationCap, BriefcaseBusiness, X, Info } from 'lucide-react';
import { Button, Dialog, MotionProvider } from '@tampiloka/ui-core';
import { animate } from 'motion/react';
import { DemoToolbarShell } from '@tampiloka/ui-core/demo';
import type { Snapshot, Locale, Layout, Field } from './domain/types.ts';
import { levels, presets, layouts, palettes, typography } from './domain/capabilities.ts';
import { App, Pick } from './ui.tsx';
import { Public } from './public.tsx';
const Staff = lazy(() => import('./staff.tsx').then(m => ({default: m.Staff}))); 
import { errorText } from './messages.ts';
import { resolveLocation, routeHref } from './routing.ts';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@tampiloka/ui-core/styles.css';
import './styles/school.css';
import './styles/institution-footer.css';
import './styles/institution-motion.css';
import '@tampiloka/ui-core/demo.css';
const isPrivatePage = (p: URLSearchParams) => ['staff', 'portal', 'apply'].includes(p.get('page') ?? '') || p.get('view') !== 'visitor';
function School() {
    const [params, setParams] = useState(() => resolveLocation(location.pathname, location.search));
    const [s, setS] = useState<Snapshot | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [appearance, setAppearance] = useState(false);
    const [reset, setReset] = useState(false);
    const [failed, setFailed] = useState(false);
    const registrationFields = useRef<Field[]>([]);
    registrationFields.current = s?.registrationFields ?? [];
    const sequence = useRef(0);
    const keys = useRef(new Map<string, string>());
    const lang = params.get('lang') as Locale;
    const t = (id: string, en: string) => lang === 'id' ? id : en;
    const role = params.get('preview') === 'true' ? 'admin' : params.get('view') === 'staff' ? (params.get('role') ?? 'admin') : params.get('view') ?? 'visitor';
    const href = (patch: Record<string, string>) => routeHref(params, patch, location.hash);
    const go = (patch: Record<string, string>) => { const url = href(patch); history.pushState(null, '', url); const target = new URL(url, location.origin); setParams(resolveLocation(target.pathname, target.search)); setMessage(''); if (patch.page || patch.view)
        window.scrollTo({ top: 0, behavior: 'instant' }); };
    useEffect(() => { const back = () => { setParams(resolveLocation(location.pathname, location.search)); setMessage(''); }; addEventListener('popstate', back); return () => removeEventListener('popstate', back); }, []);
    useEffect(() => { if (params.get('page') === '__not-found') return; const canonical = href({}); if (canonical !== location.pathname + location.search + location.hash) history.replaceState(null, '', canonical); }, [params]);
    const request = useCallback(async <T,>(path: string, data?: unknown): Promise<T> => { const u = new URL(path, location.origin); u.searchParams.set('preset', params.get('preset')!); u.searchParams.set('level', params.get('level')!); let r: Response; try {
        r = await fetch(u, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-School-Request': '1', 'X-Demo-Role': role }, body: data === undefined ? undefined : JSON.stringify(data) });
    }
    catch {
        throw new Error(errorText('network_error', lang));
    } const json = await r.json(); if (!r.ok)
        throw new Error(errorText(json.error ?? 'internal_error', lang, registrationFields.current)); return json as T; }, [params.get('preset'), params.get('level'), role, lang]);
    const refresh = useCallback(async () => { const id = ++sequence.current; try {
        const value = await request<Snapshot>('/api/bootstrap');
        if (sequence.current === id) {
            setS(value);
            setFailed(false);
        }
    }
    catch (e) {
        if (sequence.current === id) {
            setFailed(true);
            setMessage((e as Error).message);
        }
    } }, [request]);
    useEffect(() => { void refresh(); const timer = setInterval(() => { if (document.visibilityState === 'visible')
        void refresh(); }, 12000); const focus = () => void refresh(); addEventListener('focus', focus); return () => { sequence.current++; clearInterval(timer); removeEventListener('focus', focus); }; }, [refresh]);
    useEffect(() => { const root = document.documentElement; root.lang = lang; root.dataset.palette = params.get('theme')!; root.dataset.typography = params.get('typography')!; if (s) {
        const id = params.get('page') === 'program' ? s.programs.find(p => p.id === params.get('program'))?.contentId : params.get('page') === 'story' ? params.get('story') : params.get('page');
        const c = s.content.find(x => x.id === id || x.slug === id);
        const d = params.get('preview') === 'true' ? c?.draft : c?.published;
        document.title = (d?.seoTitle[lang] || d?.title[lang] || s.institution.name) + ' | ' + s.institution.name;
        document.querySelector('meta[name="description"]')?.setAttribute('content', d?.seoDescription[lang] || s.institution.description[lang]);
        document.querySelector('meta[name="robots"]')?.setAttribute('content', s.demo || params.get('preview') === 'true' || isPrivatePage(params) ? 'noindex, nofollow' : 'index, follow');
    } }, [s, lang, params]);
    useEffect(() => {
        if (s?.preset !== 'institution' || ['staff', 'tutor'].includes(params.get('view') ?? '')) return;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const active: ReturnType<typeof animate>[] = [];
        let observer: IntersectionObserver | undefined;
        const stop = () => { observer?.disconnect(); active.forEach(animation => animation.cancel()); active.length = 0; };
        const start = () => {
            stop();
            if (preference.matches || !('IntersectionObserver' in window)) return;
            const targets = Array.from(document.querySelectorAll<HTMLElement>('.school[data-preset="institution"] [data-school-reveal]'));
            const indexes = new Map<Element, number>();
            observer = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const target = entry.target as HTMLElement;
                    observer?.unobserve(target);
                    const parent = target.parentElement;
                    const index = parent ? indexes.get(parent) ?? 0 : 0;
                    if (parent) indexes.set(parent, index + 1);
                    active.push(animate(target, { opacity: [.82, 1], y: [20, 0] }, { duration: .75, ease: [.19, 1, .22, 1], delay: Math.min(index, 4) * .055 }));
                }
            }, { threshold: 0, rootMargin: '0px 0px 40px 0px' });
            for (const target of targets) {
                if (target.getBoundingClientRect().top >= window.innerHeight) observer.observe(target);
            }
        };
        start();
        preference.addEventListener('change', start);
        return () => { preference.removeEventListener('change', start); stop(); };
    }, [s?.preset, params.get('page'), params.get('story'), params.get('layout'), params.get('view')]);
    async function mutate(action: string, payload: Record<string, unknown>) { const fingerprint = JSON.stringify({ action, payload }); const key = keys.current.get(fingerprint) ?? crypto.randomUUID(); keys.current.set(fingerprint, key); setBusy(true); setMessage(''); try {
        const value = await request<{
            result: unknown;
            snapshot: Snapshot;
        }>('/api/command', { action, payload, key });
        sequence.current++;
        setS(value.snapshot);
        keys.current.delete(fingerprint);
        setMessage(t('Perubahan tersimpan.', 'Changes saved.'));
        return value.result;
    }
    finally {
        setBusy(false);
    } }
    if (!s)
        return <div className="initial-state"><GraduationCap size={44}/><h1>{failed ? t('Belum dapat memuat situs', 'Unable to load the site') : t('Menyiapkan ruang belajar', 'Loading your learning space')}</h1><p role="status">{message}</p>{failed && <Button onClick={() => void refresh()}>{t('Coba lagi', 'Try again')}</Button>}</div>;
    const available = [{ id: 'visitor', label: t('Pengunjung', 'Visitor'), icon: <Users size={17}/> }, ...(s.capabilities.includes('enrollment') ? [{ id: 'student', label: t('Siswa', 'Student'), icon: <GraduationCap size={17}/> }] : []), { id: 'staff', label: t('Staf', 'Staff'), icon: <BriefcaseBusiness size={17}/> }];
    const view = params.get('view')!;
    const isStaffView = view === 'staff' || view === 'tutor';
    const activeView = ['guardian', 'student'].includes(view) ? 'student' : view === 'tutor' ? 'staff' : view;
    const presetNames: Record<string, string> = { 'exam-prep': t('Bimbel & ujian', 'Exam preparation'), language: t('Kursus bahasa', 'Language school'), skills: t('Pelatihan keahlian', 'Skills training'), institution: t('Sekolah', 'Institution') };
    function changeLevel(level: string) { const patch: Record<string, string> = { level }; if (['profile', 'whatsapp'].includes(level) && ['student', 'guardian', 'tutor'].includes(view)) {
        patch.view = 'visitor';
        patch.page = 'home';
    } if (level !== 'full' && view === 'tutor') {
        patch.view = 'staff';
        patch.page = 'staff';
    } go(patch); }
    return <App.Provider value={{ s, lang, params, href, go, request, mutate, refresh, busy, message, setMessage }}><a className="skip-link" href="#main-content">{t('Langsung ke isi', 'Skip to content')}</a>{s.demo && <DemoToolbarShell family={t('Pendidikan', 'Learning')} label={t('Jelajahi demo', 'Explore the demo')} galleryLabel={t('Tampiloka / Pendidikan: kembali ke galeri', 'Tampiloka / Learning: back to gallery')} galleryUrl={`https://tampiloka.site${lang === 'en' ? '/en' : ''}/templates`} controls={<><Pick demo label={t('Preset bisnis', 'Business preset')} value={params.get('preset')!} options={presets.map(value => ({ value, label: presetNames[value] }))} onChange={preset => go({ preset, page: 'home', view: 'visitor', program: '', preview: '' })}/><Pick demo label={t('Tema demo', 'Demo theme')} value={params.get('theme')!} options={palettes.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} onChange={theme => go({ theme })}/><Pick demo label={t('Mode demo', 'Demo mode')} value={s.level} options={levels.map(value => ({ value, label: ({ profile: t('Profil', 'Profile'), whatsapp: 'WhatsApp', enrollment: t('Pendaftaran', 'Enrollment'), full: t('Lengkap', 'Full') })[value] }))} onChange={changeLevel}/></>} views={available.map(v => ({ ...v, href: href({ view: v.id, page: v.id === 'staff' ? 'staff' : v.id === 'student' ? 'portal' : 'home', preview: '' }), onSelect: undefined }))} activeView={activeView} viewLabel={t('Peran demo', 'Demo role')} actions={<Button variant="ghost" size="icon" aria-label={t('Tampilan & opsi demo', 'Appearance & demo options')} onClick={() => setAppearance(true)}><SlidersHorizontal /></Button>}/>}<div className={`school ${isStaffView ? 'staff-page' : 'public-page'}`} data-preset={s.preset} data-layout={params.get('layout')} data-role={s.actor?.role ?? 'visitor'} data-level={s.level}>{s.demo && <div className="demo-disclosure"><Info size={15}/><span>{t('Demo interaktif. Data fiktif dan pembayaran simulasi.', 'Interactive demo. Fictional data and simulated payments.')}</span></div>}{message && <div className="feedback" role="status"><span>{message}</span><Button size="icon" variant="ghost" aria-label={t('Tutup pesan', 'Dismiss message')} onClick={() => setMessage('')}><X /></Button></div>}<div key={`${params.get('page')}:${params.get('layout')}:${isStaffView}`}>{isStaffView ? <Suspense fallback={<div className="page-space" role="status">{t('Memuat ruang staf','Loading the staff workspace')}</div>}><Staff /></Suspense> : <Public />}</div></div><button className="tl-demo-language" type="button" aria-label={t('ID / EN: Ganti ke bahasa Inggris', 'ID / EN: Switch to Indonesian')} onClick={() => go({ lang: lang === 'id' ? 'en' : 'id' })}><span aria-current={lang === 'id' ? 'true' : undefined}>ID</span><span aria-hidden> / </span><span aria-current={lang === 'en' ? 'true' : undefined}>EN</span></button>{s.demo && <><Dialog open={appearance} onOpenChange={setAppearance} title={t('Tampilan & opsi demo', 'Appearance & demo options')} closeLabel={t('Tutup', 'Close')}><div className="form-stack"><Pick label={t('Susunan halaman', 'Page layout')} value={params.get('layout')!} options={layouts.map(value => ({ value, label: value.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join(' ') }))} onChange={layout => go({ layout })}/><Pick label={t('Tipografi', 'Typography')} value={params.get('typography')!} options={typography.map(value => ({ value, label: value }))} onChange={typography => go({ typography })}/><p>{t('Susunan, warna, jenis lembaga, dan level fitur tetap terpisah.', 'Layout, color, institution type, and feature level stay independent.')}</p>{s.capabilities.includes('portal') && <div className="button-row"><Button variant="outline" onClick={() => { go({ view: 'guardian', page: 'portal' }); setAppearance(false); }}>{t('Coba sebagai wali', 'Try as guardian')}</Button><Button variant="outline" onClick={() => { go({ view: 'tutor', page: 'staff', tab: 'academic' }); setAppearance(false); }}>{t('Coba sebagai tutor', 'Try as tutor')}</Button></div>}<Pick label={t('Peran ruang staf', 'Staff workspace role')} value={params.get('role') ?? 'admin'} options={[{ value: 'admin', label: t('Administrator', 'Administrator') }, { value: 'staff', label: t('Staf operasional', 'Operations staff') }, { value: 'editor', label: t('Editor konten', 'Content editor') }]} onChange={role => { go({ view: 'staff', role, page: 'staff', tab: role === 'editor' ? 'content' : 'overview', preview: '' }); setAppearance(false); }}/><Button variant="ghost" onClick={() => { setAppearance(false); setReset(true); }}><RotateCcw />{t('Atur ulang data contoh', 'Reset sample data')}</Button></div></Dialog><Dialog open={reset} onOpenChange={setReset} title={t('Atur ulang data demo?', 'Reset demo data?')} description={t('Hanya data contoh pada preset dan sesi ini yang berubah.', 'Only sample data in this preset and session will change.')} closeLabel={t('Tutup', 'Close')}><Button variant="danger" onClick={() => void request('/api/demo/reset', {}).then(() => { setReset(false); return refresh(); }).catch(e => setMessage(e.message))}>{t('Atur ulang', 'Reset')}</Button></Dialog></>}</App.Provider>;
}
createRoot(document.getElementById('root')!).render(<MotionProvider><School /></MotionProvider>);
