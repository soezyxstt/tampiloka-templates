import { useState, useEffect, type FormEvent } from 'react';
import { BookOpen, CalendarDays, LibraryBig, ChevronLeft, MapPin, Users, Search, Clock3, GraduationCap, Mail, Download, CheckCircle2, MessageCircle, LogIn } from 'lucide-react';
import { Button, Input, Dialog, Reveal } from '@tampiloka/ui-core';
import photoSources from '../content/photo-sources.json';
import type { ContentData, Program, PageBlock, Enrollment, Snapshot, Locale } from './domain/types.ts';
import { App, useApp, useText, Link, Pick, Collapsible, NavigationMenu, NavigationMenuItem, FieldInput, SectionTitle, Empty, Status, AsyncButton, money, when, local } from './ui.tsx';
export function programData(p: Program) { const { s, params } = useApp(); const c = s.content.find(c => c.id === p.contentId); return (params.get('preview') === 'true' ? c?.draft : c?.published) ?? c?.draft; }
export const programTitle = (s: Snapshot, id: string, lang: Locale) => s.content.find(c => c.id === s.programs.find(p => p.id === id)?.contentId)?.published?.title[lang] ?? s.programs.find(p => p.id === id)?.subject ?? id;
const activityPhotos = new Map(Object.entries(photoSources.activityPhotos).map(([name, data]) => [`/images/${name}.webp`, data]));
export function Photo({ src, alt, className, sizes = '(max-width: 760px) 100vw, 55vw', priority = false }: {
    src: string;
    alt: string;
    className?: string;
    sizes?: string;
    priority?: boolean;
}) {
    const { s, params, lang } = useApp();
    if (!src) return null;
    const bundled = activityPhotos.get(src);
    const url = src.startsWith('/api/media/') && s.demo ? `${src}?preset=${encodeURIComponent(params.get('preset') ?? s.preset)}` : src;
    return <img className={className} src={url} alt={bundled?.alt[lang] ?? alt}
        srcSet={bundled ? `${src.replace('.webp', '-480.webp')} 480w, ${src} 1120w` : undefined}
        sizes={bundled ? sizes : undefined} width={bundled ? 1120 : undefined} height={bundled?.height}
        style={bundled ? { objectPosition: bundled.focus } : undefined}
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"/>;
}
export function PublicNav() {
    const { s, lang } = useApp();
    const t = useText();
    const navigation = s.institution.navigation;
    const hasPortal = s.capabilities.includes('enrollment');
    const shortcut = hasPortal || !navigation.some(n => n.page === 'about')
        ? <Link className="school-control" to={hasPortal ? { page: 'portal', view: 'student' } : { page: 'about' }}>
            {hasPortal ? <LogIn aria-hidden/> : <Mail aria-hidden/>}
            {hasPortal ? t('Portal siswa', 'Student portal') : t('Hubungi kami', 'Contact')}
        </Link> : null;
    return <header className="site-nav">
        <Link className="institution-name" to={{ page: 'home' }}><GraduationCap aria-hidden/><span>{s.institution.name}</span></Link>
        <nav className="desktop-nav" aria-label={t('Navigasi utama', 'Main navigation')}>
            {navigation.map(n => <Link key={n.page} to={{ page: n.page }}>{n.label[lang]}</Link>)}
        </nav>
        <div className="nav-actions">
            {shortcut}
            <NavigationMenu label={t('Buka menu', 'Open menu')}>
                {navigation.map(n => <NavigationMenuItem key={n.page} asChild><Link to={{ page: n.page }}>{n.label[lang]}</Link></NavigationMenuItem>)}
                {shortcut && <NavigationMenuItem asChild>{shortcut}</NavigationMenuItem>}
            </NavigationMenu>
        </div>
    </header>;
}
export function Action({ program, large = false }: {
    program?: string;
    large?: boolean;
}) { const { s } = useApp(); const t = useText(); return <Link className={`action-link ${large ? 'large' : ''}`} to={s.capabilities.includes('enrollment') ? { page: 'apply', program: program ?? s.programs[0]?.id ?? '', view: 'student' } : s.capabilities.includes('inquiry') ? { page: 'inquiry', program: program ?? s.programs[0]?.id ?? '' } : { page: 'programs' }}>{s.capabilities.includes('enrollment') ? t('Ajukan pendaftaran', 'Apply to join') : s.capabilities.includes('inquiry') ? t('Tanya tentang kelas', 'Ask about a class') : t('Jelajahi program', 'Explore programs')}</Link>; }
function ProgramRow({ program: p, index, compact = false }: {
    program: Program;
    index: number;
    compact?: boolean;
}) {
    const { s, lang } = useApp();
    const t = useText();
    const d = programData(p);
    const cohort = s.cohorts.find(c => c.programId === p.id);
    if (!d) return null;
    return <article className={`program-row${compact ? ' compact' : ''}${d.image ? '' : ' no-image'}`}>
        <span className="row-number" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
        <Photo src={d.image} alt="" sizes={compact ? '(max-width: 760px) 90vw, 40vw' : '160px'} priority={compact && index === 0}/>
        <div>
            <p className="program-subject">{p.subject} · {p.format}</p>
            <h3><Link className="program-destination" to={{ page: 'program', program: p.id }}>{d.title[lang]}</Link></h3>
            {!compact && <p>{d.summary[lang]}</p>}
        </div>
        <div className="program-row-end">
            <strong>{cohort ? money(cohort.tuitionIdr, lang) : t('Hubungi kami', 'Contact us')}</strong><span>{p.duration[lang]}</span>
        </div>
    </article>;
}
function ProgramList() {
    const { s } = useApp();
    const t = useText();
    return <section className="program-section">
        <SectionTitle title={t('Temukan program Anda', 'Find your program')}>
            <Link className="school-control" to={{ page: 'programs' }}><LibraryBig aria-hidden/>{t('Bandingkan program', 'Compare programs')}</Link>
        </SectionTitle>
        {s.programs.map((p, i) => <Reveal key={p.id} delay={i * .04}><ProgramRow program={p} index={i}/></Reveal>)}
    </section>;
}
export const customBlocks = new Map<string, (block: PageBlock) => React.ReactNode>();
export function Blocks({ blocks }: {
    blocks: PageBlock[];
}) { const { lang } = useApp(); return <>{blocks.map((b, i) => { const Custom = customBlocks.get(b.type); if (Custom)
    return <section key={b.id}>{Custom(b)}</section>; if (b.type === 'faq')
    return <section key={b.id} className="faq-section"><Collapsible title={b.heading[lang]}><p>{b.body[lang]}</p></Collapsible></section>; if (b.type === 'testimonial')
    return <section className="testimonial" key={b.id}><p>{b.body[lang]}</p><small>{b.heading[lang]}</small></section>; return <Reveal key={b.id}><section className={`content-section ${i % 2 ? 'reverse' : ''}`}><div><h2>{b.heading[lang]}</h2><p>{b.body[lang]}</p></div>{b.image && <Photo src={b.image} alt={b.heading[lang]}/>}</section></Reveal>; })}</>; }
function Announcements() { const { s, lang, params } = useApp(); const t = useText(); return <section className="announcements"><SectionTitle as={params.get('page') === 'announcements' ? 'h1' : 'h2'} title={t('Kabar & informasi', 'News & notices')}/>{s.content.filter(c => c.collection === 'announcements' && c.published).map(c => <article key={c.id}><h3>{c.published!.title[lang]}</h3><p>{c.published!.body[lang]}</p></article>)}</section>; }
function Intakes() { const { s, lang } = useApp(); const t = useText(); return <section className="intake-list"><h2>{t('Kelas berikutnya', 'Next intakes')}</h2>{s.cohorts.map(c => <article key={c.id}><CalendarDays aria-hidden/><div><strong>{programTitle(s, c.programId, lang)}</strong><p>{when(c.startsAt, lang)}</p><small>{s.availability[c.id]} {t('kursi tersedia', 'seats available')}</small></div></article>)}</section>; }
export function Home() {
    const { s, lang, params } = useApp();
    const t = useText();
    const home = s.content.find(c => c.id === 'home');
    const d = params.get('preview') === 'true' ? home?.draft : home?.published;
    if (!d)
        return <Empty>{t('Halaman belum terbit.', 'This page is not published yet.')}</Empty>;
    const layout = params.get('layout') ?? 'academic-editorial';
    const copy = <><h1>{d.title[lang]}</h1><p className="lead">{d.summary[lang]}</p><Action large/></>;
    const image = <Photo src={d.image} alt={d.title[lang]} sizes="(max-width: 1280px) 100vw, 1280px" priority/>;
    if (layout === 'course-discovery') {
        const courseImages = s.programs.map(p => s.content.find(c => c.id === p.contentId)?.published?.image);
        const subjects = [...new Set(courseImages)].filter((src): src is string => !!src && src !== d.image).slice(0, 2);
        return <>
            <section className="school-finder">
                {d.image && <div className="finder-frieze" aria-hidden="true">
                    <Photo src={d.image} alt="" sizes="(max-width: 760px) 55vw, 42vw" priority/>
                    {subjects.map(src => <Photo key={src} src={src} alt="" sizes="32vw"/>)}
                </div>}
                <div className="finder-desk"><h1>{t('Apa yang ingin Anda pelajari?', 'What would you like to learn?')}</h1>
                    <form className="discovery-search" action="/">
                        <Search aria-hidden/><Input name="q" placeholder={t('Cari subjek atau program', 'Search a subject or program')} aria-label={t('Cari program', 'Search programs')}/>
                        {[...params.entries()].filter(([k]) => !['page', 'q'].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v}/>)}
                        <input type="hidden" name="page" value="programs"/><Button type="submit">{t('Cari', 'Search')}</Button>
                    </form>
                </div>
            </section>
            <div className="discovery-columns"><ProgramList /><div><Intakes /><Action /></div></div>
            <Blocks blocks={d.blocks}/>
        </>;
    }
    if (layout === 'contemporary-learning') return <>
        <section className="studio-opening">
            <header className="studio-type"><h1>{d.title[lang]}</h1><div><p>{d.summary[lang]}</p><Action /></div></header>
            <div className="studio-projects" aria-label={t('Lokakarya dan kelas', 'Workshops and classes')} role="region">
                {s.programs.map((p, i) => <ProgramRow key={p.id} program={p} index={i} compact/>)}
            </div>
        </section>
        <div className="studio-calendar">{d.image && <Photo src={d.image} alt={d.title[lang]}/>}<Intakes /></div>
        <Blocks blocks={d.blocks}/>
    </>;
    if (layout === 'institutional') {
        const next = s.cohorts.filter(c => Date.parse(c.startsAt) >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
        return <>
            <section className="school-bulletin">
                <header><h1>{d.title[lang]}</h1><div><p>{d.summary[lang]}</p><Action /></div></header>
                {(d.image || next) && <div className="bulletin-scene">{image}
                    {next && <Link className="bulletin-date" to={{ page: 'schedule' }}>
                        <CalendarDays aria-hidden/><span>{t('Kelas berikutnya', 'Next intake')}<strong>{programTitle(s, next.programId, lang)}</strong><time dateTime={next.startsAt}>{when(next.startsAt, lang)}</time></span>
                    </Link>}
                </div>}
            </section>
            <div className="institution-columns"><Announcements /><Intakes /></div><ProgramList /><Blocks blocks={d.blocks.filter(b => b.type !== 'testimonial')}/>
        </>;
    }
    return <>
        <section className={`school-poster${d.image ? ' has-photo' : ''}`}>
            {image}<div className="poster-copy">{copy}</div>
        </section>
        <ProgramList /><Blocks blocks={d.blocks}/>
    </>;
}
export function Discovery() { const { s, lang, params } = useApp(); const t = useText(); const [q, setQ] = useState(params.get('q') ?? ''); const [format, setFormat] = useState('all'); const [compare, setCompare] = useState<string[]>([]); const filtered = s.programs.filter(p => { const d = s.content.find(c => c.id === p.contentId)?.published; return d && (format === 'all' || format === p.format) && `${d.title[lang]} ${p.subject}`.toLowerCase().includes(q.toLowerCase()); }); return <section className="page-space"><div className="page-heading"><h1>{t('Program & kelas', 'Programs & courses')}</h1><p>{t('Bandingkan isi, format, biaya, dan waktu belajar.', 'Compare the content, format, fees, and learning schedule.')}</p></div><div className="filter-bar"><label className="search-field"><Search /><Input aria-label={t('Cari program', 'Search programs')} value={q} onChange={e => setQ(e.target.value)} placeholder={t('Cari program atau subjek', 'Search a program or subject')}/></label><Pick label={t('Format', 'Format')} value={format} options={['all', 'online', 'onsite', 'hybrid'].map(v => ({ value: v, label: v === 'all' ? t('Semua format', 'All formats') : v }))} onChange={setFormat}/><span>{filtered.length} {t('program', 'programs')}</span></div>{!filtered.length && <Empty>{t('Tidak ada hasil. Coba kata lain.', 'No results. Try another term.')}</Empty>}{filtered.map((p, i) => <div key={p.id}><ProgramRow program={p} index={i}/><label className="compare-check"><input type="checkbox" checked={compare.includes(p.id)} disabled={!compare.includes(p.id) && compare.length === 3} onChange={() => setCompare(compare.includes(p.id) ? compare.filter(x => x !== p.id) : [...compare, p.id])}/>{t('Bandingkan', 'Compare')}</label></div>)}{compare.length > 0 && <section className="comparison"><SectionTitle title={t('Perbandingan program', 'Program comparison')}><Button variant="ghost" onClick={() => setCompare([])}>{t('Hapus', 'Clear')}</Button></SectionTitle><div className="table-scroll"><table><thead><tr><th>{t('Program', 'Program')}</th><th>{t('Format', 'Format')}</th><th>{t('Durasi', 'Duration')}</th><th>{t('Biaya total', 'Total fees')}</th><th>{t('Kursi', 'Seats')}</th></tr></thead><tbody>{s.programs.filter(p => compare.includes(p.id)).map(p => { const c = s.cohorts.find(c => c.programId === p.id)!; return <tr key={p.id}><th>{s.content.find(x => x.id === p.contentId)?.published?.title[lang]}</th><td>{p.format}</td><td>{p.duration[lang]}</td><td>{money(c.tuitionIdr + c.registrationIdr, lang)}</td><td>{s.availability[c.id]}</td></tr>; })}</tbody></table></div></section>}</section>; }
export function ProgramDetail() { const { s, lang, params } = useApp(); const t = useText(); const p = s.programs.find(x => x.id === params.get('program')) ?? s.programs[0]; const record = p ? s.content.find(c => c.id === p.contentId) : null; const d = params.get('preview') === 'true' ? record?.draft : record?.published; if (!p || !d)
    return <Empty>{t('Program tidak tersedia.', 'Program unavailable.')}</Empty>; const cohorts = s.cohorts.filter(c => c.programId === p.id); return <section className="page-space"><Link className="school-control" to={{ page: 'programs' }}><ChevronLeft aria-hidden/>{t('Semua program', 'All programs')}</Link><div className="program-detail"><article><p className="program-subject">{p.subject} · {p.format}</p><h1>{d.title[lang]}</h1><p className="lead">{d.summary[lang]}</p><Photo src={d.image} alt={d.title[lang]} priority/><h2>{t('Yang akan Anda pelajari', 'What you will learn')}</h2>{s.courses.filter(c => c.programId === p.id).map(c => <div key={c.id}><h3>{c.title[lang]}</h3><ul>{c.outcomes.map((o, i) => <li key={i}>{o[lang]}</li>)}</ul></div>)}<dl className="program-facts">{Object.entries(d.attributes).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{Array.isArray(v) ? v.join(' · ') : String(v)}</dd></div>)}</dl><h2>{t('Pengajar', 'Teachers')}</h2>{s.tutors.filter(x => p.tutorIds.includes(x.id)).map(x => <article className="teacher-inline" key={x.id}><Photo src={x.image} alt={t('Foto ilustrasi pengajar', 'Illustrative teacher photo')}/><div><h3>{x.name}</h3><p>{x.bio[lang]}</p></div></article>)}<Blocks blocks={d.blocks}/></article><aside className="admission-box"><h2>{t('Jadwal & biaya', 'Schedule & fees')}</h2>{cohorts.map(c => <div key={c.id}><h3>{c.name}</h3><p><CalendarDays />{when(c.startsAt, lang)}</p><p><Users />{s.availability[c.id]} {t('kursi tersedia', 'seats available')}</p><p><Clock3 />{p.duration[lang]}</p><dl><div><dt>{t('Biaya program', 'Tuition')}</dt><dd>{money(c.tuitionIdr, lang)}</dd></div><div><dt>{t('Pendaftaran', 'Registration')}</dt><dd>{money(c.registrationIdr, lang)}</dd></div><div className="total"><dt>{t('Total', 'Total')}</dt><dd>{money(c.tuitionIdr + c.registrationIdr, lang)}</dd></div></dl><Action program={p.id}/><p className="small">{t('Pengajuan ditinjau staf. Kursi dan penerimaan mengikuti syarat kelas.', 'Staff review applications. Seats and admission follow class requirements.')}</p></div>)}</aside></div></section>; }
export function Teachers() { const { s, lang } = useApp(); const t = useText(); return <section className="page-space"><h1>{t('Kenali pengajar Anda', 'Meet your teachers')}</h1><p className="lead">{t('Cara mengajar yang memberi ruang untuk bertanya.', 'Teaching that makes room for questions.')}</p><div className="teacher-grid">{s.tutors.map(x => <article key={x.id}><Photo src={x.image} alt={t('Foto ilustrasi, bukan identitas pengajar', 'Illustrative photo, not the teacher’s identity')}/><h2>{x.name}</h2><p className="program-subject">{x.specialty[lang]}</p><p>{x.bio[lang]}</p></article>)}</div></section>; }
export function Schedule() { const { s, lang } = useApp(); const t = useText(); return <section className="page-space"><h1>{t('Jadwal belajar', 'Learning schedule')}</h1><p className="lead">{t('Semua waktu menggunakan WIB (UTC+7).', 'All times use Western Indonesia Time (UTC+7).')}</p><Intakes /><div className="schedule-list">{s.sessions.map(x => <article key={x.id}><time>{when(x.startsAt, lang)}</time><div><h3>{x.title[lang]}</h3><p>{s.tutors.find(t => t.id === x.tutorId)?.name} · {x.location}</p></div><span>{t('Sampai', 'Until')} {when(x.endsAt, lang)}</span></article>)}</div></section>; }
export function About() { const { s, lang } = useApp(); const t = useText(); return <section className="page-space"><h1>{t('Tentang', 'About')} {s.institution.name}</h1><p className="lead">{s.institution.description[lang]}</p><Blocks blocks={s.content.find(c => c.id === 'home')?.published?.blocks ?? []}/><section className="contact"><h2>{t('Datang dan kenali kami', 'Come and meet us')}</h2>{s.branches.map(b => <p key={b.id}><MapPin />{b.name} · {b.address}</p>)}<p><Mail />{s.institution.email || t('Email belum diatur', 'Email not configured')}</p>{s.institution.whatsapp && <a className="action-link" href={`https://wa.me/${s.institution.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}</section></section>; }
export function Inquiry() { const { s, lang, params } = useApp(); const t = useText(); const [program, setProgram] = useState(params.get('program') ?? s.programs[0]?.id); const [cohort, setCohort] = useState(''); const [branch, setBranch] = useState(s.branches[0]?.id ?? ''); const [message, setMessage] = useState(''); if (!s.capabilities.includes('inquiry'))
    return <Empty>{t('Konsultasi WhatsApp tidak tersedia pada level profil.', 'WhatsApp inquiry is not enabled in Profile mode.')}</Empty>; const c = s.cohorts.find(c => c.id === cohort && c.programId === program && c.branchId === branch) ?? s.cohorts.find(c => c.programId === program && c.branchId === branch); const title = programTitle(s, program, lang); const summary = `${t('Halo, saya ingin bertanya tentang', 'Hello, I would like to ask about')} ${title}.\n${s.branches.find(x => x.id === branch)?.name} · ${c?.name ?? ''}\n${c ? when(c.startsAt, lang) : ''}\n${s.preset === 'language' ? t('Mohon bantu penempatan tingkat kelas.', 'Please help with level placement.') : ''}`; return <section className="page-space form-page"><h1>{t('Bicarakan kebutuhan belajar', 'Discuss your learning needs')}</h1><p className="lead">{t('Ini permintaan informasi, bukan konfirmasi pendaftaran. Staf melanjutkan percakapan melalui WhatsApp.', 'This is an inquiry, not an enrollment confirmation. Staff will continue the conversation on WhatsApp.')}</p><Pick label={t('Program', 'Program')} value={program} options={s.programs.map(x => ({ value: x.id, label: programTitle(s, x.id, lang) }))} onChange={v => { setProgram(v); setCohort(''); }}/><Pick label={t('Cabang', 'Branch')} value={branch} options={s.branches.map(x => ({ value: x.id, label: x.name }))} onChange={setBranch}/><Pick label={t('Angkatan', 'Intake')} value={c?.id ?? 'none'} options={s.cohorts.filter(x => x.programId === program && x.branchId === branch).map(x => ({ value: x.id, label: `${x.name} · ${when(x.startsAt, lang)}` })).concat(c ? [] : [{ value: 'none', label: t('Belum tersedia', 'Not available') }])} onChange={setCohort}/><div className="inquiry-summary"><h2>{t('Ringkasan pertanyaan', 'Inquiry summary')}</h2><p>{summary}</p></div>{s.institution.whatsapp ? <a className="action-link" href={`https://wa.me/${s.institution.whatsapp}?text=${encodeURIComponent(summary)}`} target="_blank" rel="noreferrer"><MessageCircle /> {t('Lanjutkan di WhatsApp', 'Continue on WhatsApp')}</a> : <><p className="notice">{t('Nomor WhatsApp belum diatur. Demo tidak mengirim pesan ke nomor nyata.', 'No WhatsApp number is configured. The demo does not message a real phone number.')}</p><Button variant="outline" onClick={() => void navigator.clipboard.writeText(summary).then(() => setMessage(t('Ringkasan disalin.', 'Summary copied.')))}>{t('Salin ringkasan', 'Copy summary')}</Button><p role="status">{message}</p></>}</section>; }
export function Authentication() { const { s, request, refresh, setMessage } = useApp(); const t = useText(); const [register, setRegister] = useState(false); const [role, setRole] = useState('student'); async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); try {
    await request(`/api/auth/${register ? 'register' : 'login'}`, { ...data, role });
    await refresh();
}
catch (err) {
    setMessage((err as Error).message);
} } return <section className="form-page page-space"><h1>{register ? t('Buat akun', 'Create an account') : t('Masuk ke portal', 'Sign in to your portal')}</h1><p>{t('Gunakan akun Anda sendiri. Wali hanya dapat melihat siswa yang terhubung.', 'Use your own account. Guardians can only see linked learners.')}</p><form className="form-stack" onSubmit={e => void submit(e)}>{register && <><Pick label={t('Jenis akun', 'Account type')} value={role} options={[{ value: 'student', label: t('Siswa', 'Student') }, { value: 'guardian', label: t('Wali', 'Guardian') }]} onChange={setRole}/><label>{t('Nama Anda', 'Your name')}<Input name="name" required/></label>{role === 'guardian' && <label>{t('Nama siswa', 'Student name')}<Input name="studentName" required/></label>}</>}<label>Email<Input name="email" type="email" autoComplete="email" required/></label><label>{t('Kata sandi', 'Password')}<Input name="password" type="password" minLength={12} maxLength={128} required autoComplete={register ? 'new-password' : 'current-password'}/></label><Button type="submit"><LogIn />{register ? t('Buat akun', 'Create account') : t('Masuk', 'Sign in')}</Button></form>{s.capabilities.includes('enrollment') && <Button variant="ghost" onClick={() => setRegister(!register)}>{register ? t('Sudah punya akun', 'Already have an account') : t('Belum punya akun', 'Create a new account')}</Button>}</section>; }
export function Application() { const { s, lang, params, mutate, go, busy, setMessage } = useApp(); const t = useText(); const [program, setProgram] = useState(params.get('program') ?? s.programs[0]?.id); const [branch, setBranch] = useState(s.branches[0]?.id ?? ''); const [cohort, setCohort] = useState(''); const [student, setStudent] = useState(s.actor?.studentIds[0] ?? ''); const [values, setValues] = useState<Record<string, unknown>>({}); const draft = s.enrollments.find(e => e.id === params.get('draft') && e.status === 'draft'); useEffect(() => { if (draft) {
    const cl = s.cohorts.find(c => c.id === draft.cohortId);
    if (cl) {
        setProgram(cl.programId);
        setCohort(cl.id);
        setBranch(cl.branchId);
    }
    setStudent(draft.studentId);
    setValues(draft.answers);
} }, [draft?.id]); if (!s.capabilities.includes('enrollment'))
    return <Empty>{t('Pendaftaran daring tidak tersedia pada level ini.', 'Online enrollment is not enabled at this level.')}</Empty>; if (!s.actor)
    return <Authentication />; const cs = s.cohorts.filter(x => x.programId === program && x.branchId === branch), c = cs.find(x => x.id === cohort) ?? cs[0]; async function submit(action: string) { try {
    await mutate(action, { studentId: student || s.actor?.studentIds[0], cohortId: c?.id, answers: values });
    go({ page: 'portal', view: s.actor?.role === 'guardian' ? 'guardian' : 'student', draft: '' });
}
catch (err) {
    setMessage((err as Error).message);
} } return <section className="page-space application-layout"><div><h1>{t('Mulai pendaftaran', 'Start your application')}</h1><p className="lead">{t('Pilih kelas, lengkapi data, lalu pantau tinjauan staf di portal.', 'Choose a class, complete the form, and follow the staff review in your portal.')}</p>{s.demo && <p className="notice">{t('Gunakan data contoh saja. Jangan masukkan data pribadi anak.', 'Use sample data only. Do not enter a child’s personal information.')}</p>}<form className="form-stack" onSubmit={e => { e.preventDefault(); void submit('application.submit'); }}><Pick label={t('Siswa', 'Student')} value={student || s.actor.studentIds[0] || 'none'} options={s.students.filter(x => s.actor?.studentIds.includes(x.id)).map(x => ({ value: x.id, label: x.name })).concat(s.actor.studentIds.length ? [] : [{ value: 'none', label: t('Belum ada siswa', 'No linked learner') }])} onChange={setStudent}/><div className="form-grid"><Pick label={t('Program', 'Program')} value={program} options={s.programs.map(x => ({ value: x.id, label: programTitle(s, x.id, lang) }))} onChange={v => { setProgram(v); setCohort(''); }}/><Pick label={t('Cabang', 'Branch')} value={branch} options={s.branches.map(x => ({ value: x.id, label: x.name }))} onChange={setBranch}/></div><Pick label={t('Kelas & angkatan', 'Class & intake')} value={c?.id ?? 'none'} options={cs.length ? cs.map(x => ({ value: x.id, label: `${x.name} · ${when(x.startsAt, lang)}` })) : [{ value: 'none', label: t('Belum tersedia', 'Not available') }]} onChange={setCohort}/><hr /><h2>{t('Kebutuhan belajar', 'Learning needs')}</h2>{s.registrationFields.map(f => <FieldInput key={f.name} field={f} values={values} set={(k, v) => setValues({ ...values, [k]: v })}/>)}<label className="check-field"><input type="checkbox" required/><span>{t('Saya memahami pengajuan masih memerlukan tinjauan.', 'I understand this application still requires review.')}</span></label><div className="button-row"><Button type="submit" disabled={busy || !c || !s.actor.studentIds.length}>{t('Kirim pengajuan', 'Submit application')}</Button><Button variant="outline" disabled={busy || !c} onClick={() => void submit('application.save')}>{t('Simpan draf', 'Save draft')}</Button></div></form></div><aside className="admission-box"><h2>{t('Pilihan Anda', 'Your selection')}</h2>{c && <><h3>{programTitle(s, program, lang)}</h3><p>{c.name}</p><p>{when(c.startsAt, lang)}</p><p><Users />{s.availability[c.id]} {t('kursi tersedia', 'seats available')}</p><strong className="price">{money(c.tuitionIdr + c.registrationIdr, lang)}</strong><p>{t('Termasuk biaya pendaftaran. Pembayaran tidak diminta saat mengirim formulir.', 'Includes the registration fee. No payment is requested when submitting this form.')}</p>{s.availability[c.id] === 0 && <p className="notice">{t('Kelas penuh. Pengajuan masuk daftar tunggu.', 'This class is full. Your application will join the waitlist.')}</p>}</>}</aside></section>; }
export function EnrollmentCard({ e }: {
    e: Enrollment;
}) { const { s, lang, mutate, request, setMessage } = useApp(); const t = useText(); const [cancelOpen, setCancelOpen] = useState(false); const c = s.cohorts.find(c => c.id === e.cohortId)!; const invoice = s.invoices.find(i => i.enrollmentId === e.id); return <article className="enrollment-card" data-enrollment-id={e.id}><div className="section-title"><h2>{c ? programTitle(s, c.programId, lang) : e.id}</h2><Status value={e.status}/></div><p>{c?.name} · {s.students.find(x => x.id === e.studentId)?.name}</p><small>{e.id}</small><ol className="timeline">{s.events.filter(x => x.enrollmentId === e.id).map(event => <li key={event.id}><Status value={event.status}/><time>{when(event.at, lang)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol>{invoice && <div className="invoice-strip"><div><span>{t('Tagihan', 'Invoice')} {invoice.id.slice(-8)}</span><strong>{money(invoice.totalIdr, lang)}</strong><Status value={invoice.status}/></div>{invoice.status === 'unpaid' && (s.demo ? <AsyncButton action={() => mutate('payment.simulate', { id: invoice.id })}>{t('Simulasikan pembayaran', 'Simulate payment')}</AsyncButton> : s.paymentProvider === 'manual' ? <p>{t('Hubungi staf untuk metode pembayaran. Staf akan mencatat bukti penerimaan.', 'Contact staff for payment instructions. Staff will record receipt of your payment.')}</p> : <AsyncButton action={async () => { const r = await request<{
    url: string;
}>('/api/payments/start', { id: invoice.id }); window.location.assign(r.url); }}>{t('Bayar tagihan', 'Pay invoice')}</AsyncButton>)}</div>}{invoice?.needsReview && <p className="notice">{t('Staf perlu meninjau pembayaran atau pengembalian dana.', 'Staff must review this payment or refund.')}</p>}<div className="button-row">{e.status === 'draft' && <Link className="action-link" to={{ page: 'apply', program: c.programId, draft: e.id }}>{t('Lanjutkan pengajuan', 'Continue application')}</Link>}{!['cancelled', 'rejected', 'completed'].includes(e.status) && <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t('Batalkan pengajuan', 'Cancel application')}</Button>}</div><Dialog open={cancelOpen} onOpenChange={setCancelOpen} title={t('Batalkan pengajuan?', 'Cancel this application?')} description={t('Kursi Anda akan dilepas. Pembayaran yang telah diterima memerlukan tinjauan staf; pembatalan tidak mengirim pengembalian dana otomatis.', 'Your seat will be released. Staff must review any payment already received; cancellation does not send an automatic refund.')} closeLabel={t('Tutup', 'Close')}><div className="button-row"><Button variant="outline" onClick={() => setCancelOpen(false)}>{t('Tetap lanjutkan', 'Keep application')}</Button><AsyncButton variant="danger" action={async () => { await mutate('application.cancel', { id: e.id }); setCancelOpen(false); }}>{t('Konfirmasi pembatalan', 'Confirm cancellation')}</AsyncButton></div></Dialog></article>; }
export function AccountControls() { const { s, request, refresh, go } = useApp(); const t = useText(); const [open, setOpen] = useState(false), [old, setOld] = useState(''), [password, setPassword] = useState(''); return <>{!s.demo && <Button variant="ghost" onClick={() => setOpen(true)}>{t('Ganti sandi', 'Change password')}</Button>}<Dialog open={open} onOpenChange={setOpen} title={t('Ganti sandi', 'Change password')} closeLabel={t('Tutup', 'Close')}><div className="form-stack"><label>{t('Sandi saat ini', 'Current password')}<Input type="password" autoComplete="current-password" value={old} onChange={e => setOld(e.target.value)}/></label><label>{t('Sandi baru, minimal 12 karakter', 'New password, at least 12 characters')}<Input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)}/></label><AsyncButton disabled={password.length < 12} action={async () => { await request('/api/auth/password', { currentPassword: old, password }); setOld(''); setPassword(''); setOpen(false); await refresh(); go({ page: 'portal' }); }}>{t('Simpan sandi & keluar', 'Save password & sign out')}</AsyncButton></div></Dialog></>; }
export function Portal() { const { s, lang, params, refresh, request } = useApp(); const t = useText(); if (!s.capabilities.includes('enrollment'))
    return <Empty>{t('Portal tidak tersedia pada level ini.', 'The portal is not enabled at this level.')}</Empty>; if (!s.actor)
    return <Authentication />; const full = s.capabilities.includes('portal'); const active = s.enrollments.filter(e => e.status === 'active' || e.status === 'completed'); const cohorts = new Set(active.map(e => e.cohortId)); return <section className="page-space"><div className="page-heading section-title"><div><h1>{t('Ruang belajar Anda', 'Your learning space')}</h1><p>{s.actor.name} · {t('Perubahan status berasal dari staf dan server.', 'Status updates come from staff and the server.')}</p></div><AsyncButton variant="outline" action={refresh}>{t('Perbarui', 'Refresh')}</AsyncButton></div>{s.demo && <p className="notice">{t('Pembayaran di sini hanya simulasi. Tidak ada uang yang berpindah.', 'Payments here are simulations. No money moves.')}</p>}<section><SectionTitle title={t('Pengajuan & kelas', 'Applications & classes')}/>{!s.enrollments.length ? <Empty>{t('Belum ada pengajuan. Pilih program untuk mulai.', 'No applications yet. Choose a program to start.')} <Link className="school-control" to={{ page: 'programs', view: 'visitor' }}><LibraryBig aria-hidden/>{t('Lihat program', 'Browse programs')}</Link></Empty> : s.enrollments.map(e => <EnrollmentCard e={e} key={e.id}/>)}</section>{!s.demo && <div className="button-row"><AccountControls /><AsyncButton variant="ghost" action={async () => { await request('/api/auth/logout', {}); await refresh(); }}>{t('Keluar', 'Sign out')}</AsyncButton></div>}{full && <div className="portal-columns"><section><SectionTitle title={t('Pertemuan berikutnya', 'Upcoming sessions')}/>{s.sessions.filter(x => cohorts.has(x.cohortId)).map(x => <article className="session-row" key={x.id}><CalendarDays /><div><h3>{x.title[lang]}</h3><p>{when(x.startsAt, lang)}</p><small>{x.location}</small></div><Status value={s.attendance.find(a => a.sessionId === x.id)?.status ?? 'pending'}/></article>)}{!active.length && <Empty>{t('Jadwal pribadi muncul setelah kelas aktif.', 'Your schedule appears once enrollment is active.')}</Empty>}<SectionTitle title={t('Materi belajar', 'Learning resources')}/>{s.materials.map(x => <div className="resource-row" key={x.id}><BookOpen /><div><h3>{x.title[lang]}</h3><p>{x.description[lang]}</p></div><AsyncButton variant="outline" action={async () => { const u = new URL(`/api/materials/${x.id}`, location.origin); u.search = params.toString(); const r = await fetch(u, { headers: { 'X-Demo-Role': params.get('view') ?? 'student' } }); if (!r.ok)
    throw new Error(t('Tidak dapat mengunduh.', 'Download failed.')); const a = document.createElement('a'); const blob = URL.createObjectURL(await r.blob()); a.href = blob; a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'learning-resource'; a.click(); URL.revokeObjectURL(blob); }}><Download />{t('Unduh', 'Download')}</AsyncButton></div>)}</section><section className="progress-panel"><h2>{t('Catatan belajar', 'Learning notes')}</h2>{s.progress.length ? s.progress.map(x => <article key={x.id}><h3>{x.topic}</h3><p>{x.note}</p><label>{t('Kemajuan', 'Progress')} {x.percent}%<progress value={x.percent} max={100}/></label><small>{when(x.at, lang)}</small></article>) : <p>{t('Pengajar akan menambahkan catatan setelah kelas.', 'Your teacher will add notes after class.')}</p>}{s.modules['progress-reports'] && <Button variant="outline" onClick={() => window.print()}>{t('Cetak laporan', 'Print report')}</Button>}</section></div>}</section>; }
export function Footer() { const { s } = useApp(); const t = useText(); return <footer className="site-footer"><div><strong>{s.institution.name}</strong><p>{s.institution.address}</p>{s.demo && <small>{t('Institusi, peserta, dan testimoni adalah contoh fiktif. Foto bersifat ilustratif.', 'Institution, learners, and testimonials are fictional examples. Photos are illustrative.')}</small>}</div><nav><Link to={{ page: 'about' }}>{t('Kontak', 'Contact')}</Link><Link to={{ page: 'staff', view: 'staff' }}>{t('Ruang staf', 'Staff workspace')}</Link></nav></footer>; }
export function ContentPage() { const { s, params, lang } = useApp(); const t = useText(); const c = s.content.find(c => c.id === params.get('page') || c.slug === params.get('page')); const data = params.get('preview') === 'true' ? c?.draft : c?.published; return data ? <article className="page-space custom-page"><h1>{data.title[lang]}</h1><p className="lead">{data.summary[lang]}</p>{data.image && <Photo src={data.image} alt={data.title[lang]}/>}<p className="page-body">{data.body[lang]}</p><Blocks blocks={data.blocks}/></article> : <Empty>{t('Halaman tidak tersedia.', 'This page is not available.')} <Link className="text-link" to={{ page: 'home' }}>{t('Ke beranda', 'Return home')}</Link></Empty>; }
export function Public() { const { params } = useApp(); const page = params.get('page') ?? 'home'; return <><PublicNav /><main className="public-container" id="main-content">{page === 'home' ? <Home /> : page === 'programs' ? <Discovery /> : page === 'program' ? <ProgramDetail /> : page === 'teachers' ? <Teachers /> : page === 'schedule' ? <Schedule /> : page === 'inquiry' ? <Inquiry /> : page === 'apply' ? <Application /> : page === 'portal' ? <Portal /> : page === 'announcements' ? <Announcements /> : page === 'about' ? <About /> : <ContentPage />}</main><Footer /></>; }
