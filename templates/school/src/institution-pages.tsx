import { useState } from 'react';
import { Input } from '@tampiloka/ui-core';
import { Blocks } from './public.tsx';
import { Link, Pick, Collapsible, useApp, useText, Empty } from './ui.tsx';
import type { ContentData, ContentRecord, PageBlock, Tutor } from './domain/types.ts';
import { schoolBrand } from './institution-brand.ts';
import './styles/institution-pages.css';

export const institutionPageIds = ['school-admissions', 'school-profile', 'school-vision', 'school-contact', 'news', 'school-life', 'achievements', 'gallery', 'school-admin-info', 'school-teachers', 'school-activities', 'school-extracurricular', 'school-immersion', 'school-admissions-test', 'school-admissions-achievement', 'story'] as const;

function Image({ src, alt }: { src: string; alt: string }) {
  const { s, params } = useApp();
  const url = src.startsWith('/api/media/') && s.demo ? `${src}?preset=${encodeURIComponent(params.get('preset') ?? s.preset)}` : src;
  return <img src={url} alt={alt} loading="lazy" />;
}

function PageHero({ data }: { data: ContentData }) {
  const { lang } = useApp();
  return <header className="institution-inner-hero">{data.image && <Image src={data.image} alt="" />}<div><h1>{data.title[lang]}</h1>{data.summary[lang] && <p>{data.summary[lang]}</p>}</div></header>;
}

function PublishedList({ records }: { records: ContentRecord[] }) {
  const { lang } = useApp();
  const t = useText();
  if (!records.length) return <Empty>{t('Belum ada informasi yang diterbitkan.', 'There is no published content yet.')}</Empty>;
  const seenImages = new Set<string>();
  return <div className="institution-stories">{records.map(record => {
    const data = record.published!;
    const showImage = Boolean(data.image) && !seenImages.has(data.image);
    if (showImage) seenImages.add(data.image);
    return <article key={record.id} className={`institution-story ${showImage ? '' : 'institution-story-text'}`} data-school-reveal>{showImage && <Link to={{ page: 'story', story: record.id }} className="institution-story-image"><Image src={data.image} alt="" /></Link>}<div><StoryDate data={data} /><h2><Link to={{ page: 'story', story: record.id }}>{data.title[lang]}</Link></h2><p>{data.summary[lang]}</p><Link className="text-link" to={{ page: 'story', story: record.id }}>{t('Baca selengkapnya', 'Read more')}</Link></div></article>;
  })}</div>;
}

function StoryDate({ data }: { data: ContentData }) {
  const { lang } = useApp();
  const date = typeof data.attributes.date === 'string' ? data.attributes.date : '';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime())) return null;
  return <time className="institution-story-date" dateTime={date}>{new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed)}</time>;
}

function TeacherCard({ person }: { person: Tutor }) {
  const { lang } = useApp();
  const initials = person.name.split(' ').map(part => part[0]).slice(0, 2).join('');
  const hasPortrait = person.image && !['/images/teacher.jpg', '/images/workshop.jpg'].includes(person.image);
  return <article className="institution-person">{hasPortrait ? <Image src={person.image} alt="" /> : <div className="institution-person-initials" aria-hidden="true">{initials}</div>}<div><h3>{person.name}</h3><strong>{person.specialty[lang]}</strong><p>{person.bio[lang]}</p></div></article>;
}

function PageDetails({ blocks }: { blocks: PageBlock[] }) {
  const { lang } = useApp();
  const t = useText();
  const groups = [
    { prefix: 'timeline-', title: t('Tahapan penerimaan', 'Admissions timeline'), variant: 'timeline' },
    { prefix: 'checklist-', title: t('Dokumen yang perlu disiapkan', 'Documents to prepare'), variant: 'checklist' },
    { prefix: 'club-', title: t('Pilihan ekstrakurikuler', 'Extracurricular activities'), variant: 'club' },
    { prefix: 'schedule-', title: t('Sehari di sekolah', 'A day at school'), variant: 'timeline' },
    { prefix: 'facility-', title: t('Ruang belajar dan fasilitas', 'Learning spaces and facilities'), variant: 'facility' },
    { prefix: 'service-', title: t('Layanan tata usaha', 'School office services'), variant: 'service' },
    { prefix: 'calendar-', title: t('Kalender akademik', 'Academic calendar'), variant: 'timeline' },
    { prefix: 'faq-', title: t('Pertanyaan yang sering diajukan', 'Frequently asked questions'), variant: 'faq' },
  ];
  const remaining = blocks.filter(block => !groups.some(group => block.id.startsWith(group.prefix)));
  return <><Blocks blocks={remaining} />{groups.map(group => {
    const items = blocks.filter(block => block.id.startsWith(group.prefix));
    if (!items.length) return null;
    return <section className={`institution-detail-group institution-detail-${group.variant}`} key={group.prefix} data-school-reveal><h2>{group.title}</h2>{group.variant === 'faq' ? <div>{items.map(item => <Collapsible key={item.id} title={item.heading[lang]}><p>{item.body[lang]}</p></Collapsible>)}</div> : <ol>{items.map((item, index) => <li key={item.id}>{group.variant === 'timeline' && <span className="institution-detail-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}{group.variant === 'checklist' && <span className="institution-detail-check" aria-hidden="true">✓</span>}{item.image && <Image src={item.image} alt="" />}<div><h3>{item.heading[lang]}</h3><p>{item.body[lang]}</p></div></li>)}</ol>}</section>;
  })}</>;
}

function Teachers() {
  const { s, lang } = useApp();
  const t = useText();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');
  const leadership = s.tutors.filter(person => /kepala sekolah/i.test(person.specialty.id));
  const principals = leadership.filter(person => /^kepala sekolah/i.test(person.specialty.id));
  const deputies = leadership.filter(person => !principals.includes(person));
  const subjects = [...new Map(s.tutors.map(person => [person.specialty.id, person.specialty])).values()].sort((a, b) => a[lang].localeCompare(b[lang]));
  const filtered = s.tutors.filter(person => (subject === 'all' || person.specialty.id === subject) && `${person.name} ${person.specialty[lang]} ${person.bio[lang]}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const teacherImage = schoolBrand(s.demo).teacherImage;
  return <div className="institution-teacher-page"><header className="institution-inner-hero institution-teacher-hero">{teacherImage && <Image src={teacherImage} alt="" />}<div><h1>{t('Pendidik yang hadir untuk setiap proses', 'Educators who are there for every step')}</h1><p>{t('Kenali orang-orang yang mendampingi siswa bertanya, mencoba, dan bertumbuh.', 'Meet the people who support students as they question, explore, and grow.')}</p></div></header><div className="page-space institution-teachers">
    {leadership.length > 0 && <section className="institution-leadership" data-school-reveal><div><h2>{t('Struktur sekolah', 'School structure')}</h2><p>{t('Tim pimpinan bekerja bersama guru dan tenaga kependidikan untuk mendukung keseharian siswa.', 'The leadership team works with teachers and school staff to support students every day.')}</p></div><div className="institution-leadership-tree">{principals.map(person => <div className="institution-principal" key={person.id}><strong>{person.name}</strong><span>{person.specialty[lang]}</span></div>)}<div className="institution-leadership-list">{deputies.map(person => <div key={person.id}><strong>{person.name}</strong><span>{person.specialty[lang]}</span></div>)}</div><p>{t('Guru dan tenaga kependidikan', 'Teachers and school staff')}</p></div></section>}
    <section className="institution-directory"><div className="institution-directory-heading"><div><h2>{t('Guru dan tenaga pendidik', 'Teachers and educators')}</h2><p>{t('Temukan pendidik berdasarkan nama atau bidang pendampingan.', 'Find an educator by name or area of teaching.')}</p></div><span aria-live="polite">{filtered.length} {t('pendidik', 'educators')}</span></div><div className="institution-directory-filters"><label className="field">{t('Cari nama atau bidang', 'Search by name or subject')}<Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Nama atau bidang', 'Name or subject')} /></label><Pick label={t('Bidang', 'Subject')} value={subject} onChange={setSubject} options={[{ value: 'all', label: t('Semua bidang', 'All subjects') }, ...subjects.map(value => ({ value: value.id, label: value[lang] }))]} /></div>{filtered.length ? <div className="institution-person-grid">{filtered.map(person => <TeacherCard key={person.id} person={person} />)}</div> : <Empty>{t('Tidak ada pendidik yang cocok. Coba kata atau bidang lain.', 'No educators found. Try another name or subject.')}</Empty>}</section>
  </div></div>;
}

export function InstitutionPage() {
  const { s, lang, params } = useApp();
  const t = useText();
  const page = params.get('page') ?? '';
  const published = (id: string) => { const item = s.content.find(record => record.id === id); return params.get('preview') === 'true' && ['admin', 'editor'].includes(s.actor?.role ?? '') ? item?.draft : item?.published; };
  const records = (kind: string) => s.content.filter(item => item.collection === 'announcements' && item.published && (item.published.attributes.kind === kind || (kind === 'news' && !item.published.attributes.kind))).sort((a, b) => String(b.published?.attributes.date ?? '').localeCompare(String(a.published?.attributes.date ?? '')));
  if (page === 'story') {
    const story = s.content.find(item => item.collection === 'announcements' && (item.id === params.get('story') || item.slug === params.get('story')));
    const data = params.get('preview') === 'true' && ['admin', 'editor'].includes(s.actor?.role ?? '') ? story?.draft : story?.published;
    if (!data) return <section className="page-space"><Empty>{t('Cerita tidak tersedia.', 'This story is unavailable.')}</Empty><Link className="text-link" to={{ page: 'news', story: '' }}>{t('Kembali ke berita', 'Back to news')}</Link></section>;
    const back = data.attributes.kind === 'achievement' ? 'achievements' : data.attributes.kind === 'activity' ? 'school-life' : data.attributes.kind === 'administration' ? 'school-admin-info' : 'news';
    return <article className="institution-story-page"><PageHero data={data} /><div className="page-space institution-article"><Link className="text-link" to={{ page: back, story: '' }}>{t('Kembali', 'Go back')}</Link><div className="institution-article-copy"><StoryDate data={data} />{data.body[lang] !== data.summary[lang] && <p className="page-body">{data.body[lang]}</p>}<Blocks blocks={data.blocks} /></div></div></article>;
  }
  if (page === 'school-teachers') return <Teachers />;
  if (page === 'news' || page === 'achievements') return <section className="page-space institution-list"><div className="page-heading"><h1>{page === 'news' ? t('Kabar dari sekolah', 'Stories from school') : t('Karya dan prestasi siswa', 'Student work and achievements')}</h1><p className="lead">{page === 'news' ? t('Cerita kegiatan, karya, dan momen belajar dari keseharian sekolah.', 'Activities, creations, and learning moments from school life.') : t('Merayakan proses, keberanian mencoba, dan karya yang dibagikan bersama.', 'Celebrating the process, the courage to try, and work shared together.')}</p></div><PublishedList records={records(page === 'news' ? 'news' : 'achievement')} /></section>;
  if (page === 'gallery') {
    const media = s.content.filter(item => item.published && item.collection === 'gallery');
    return <section className="page-space institution-gallery"><div className="page-heading"><h1>{t('Galeri kegiatan', 'School gallery')}</h1><p className="lead">{t('Potret ilustrasi untuk demo sekolah fiktif.', 'Illustrative images for a fictional school demo.')}</p></div><div className="institution-gallery-grid">{media.map(item => <figure key={item.id}><Image src={item.published!.image} alt={t('Foto ilustrasi kegiatan sekolah', 'Illustrative photo of a school activity')} /><figcaption>{item.published!.title[lang]}</figcaption></figure>)}</div>{!media.length && <Empty>{t('Belum ada foto yang diterbitkan.', 'No photos have been published yet.')}</Empty>}</section>;
  }
  const data = published(page);
  if (!data) return <section className="page-space"><Empty>{t('Halaman belum terbit.', 'This page is not published yet.')}</Empty></section>;
  return <article className={`institution-feature-page institution-feature-${page}`}><PageHero data={data} /><div className="page-space institution-feature"><div className="institution-feature-body">{data.body[lang] && data.body[lang] !== data.summary[lang] && <p className="institution-feature-intro">{data.body[lang]}</p>}<PageDetails blocks={data.blocks} />{!data.body[lang] && !data.blocks.length && page !== 'school-contact' && <Empty>{t('Informasi halaman ini belum tersedia.', 'Information for this page is not available yet.')}</Empty>}
    {page === 'school-admissions' && <section className="institution-related"><h2>{t('Pilih jalur penerimaan', 'Choose an admissions pathway')}</h2><div className="institution-page-links"><Link className="text-link" to={{ page: 'school-admissions-test' }}>{t('Jalur tes', 'Test pathway')}</Link><Link className="text-link" to={{ page: 'school-admissions-achievement' }}>{t('Jalur prestasi', 'Achievement pathway')}</Link></div></section>}
    {['school-admissions', 'school-admissions-test', 'school-admissions-achievement'].includes(page) && s.programs.length > 0 && <Link className="action-link" to={s.capabilities.includes('enrollment') ? { page: 'apply', view: 'student', program: s.programs[0]?.id ?? '' } : { page: 'programs' }}>{s.capabilities.includes('enrollment') ? t('Ajukan pendaftaran', 'Apply to join') : t('Lihat program', 'Explore programs')}</Link>}
    {page === 'school-contact' && <section className="contact"><h2>{t('Kontak sekolah', 'School contact')}</h2>{s.institution.address && <p>{s.institution.address}</p>}{s.institution.email && <p><a href={`mailto:${s.institution.email}`}>{s.institution.email}</a></p>}{s.institution.whatsapp && <a className="action-link" href={`https://wa.me/${s.institution.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}{!s.institution.address && !s.institution.email && !s.institution.whatsapp && <Empty>{t('Informasi kontak belum tersedia.', 'Contact information is not available yet.')}</Empty>}</section>}
    {page === 'school-profile' && <section className="institution-related"><h2>{t('Kenali sekolah lebih dekat', 'Get to know our school')}</h2><div className="institution-page-links"><Link className="text-link" to={{ page: 'school-vision' }}>{t('Visi dan misi', 'Vision and mission')}</Link><Link className="text-link" to={{ page: 'school-teachers' }}>{t('Pendidik dan struktur sekolah', 'Educators and school structure')}</Link><Link className="text-link" to={{ page: 'school-contact' }}>{t('Hubungi sekolah', 'Contact the school')}</Link></div></section>}
    {page === 'school-life' && <section className="institution-related"><h2>{t('Jelajahi kehidupan sekolah', 'Explore school life')}</h2><div className="institution-page-links"><Link className="text-link" to={{ page: 'school-activities' }}>{t('Kegiatan sekolah', 'School activities')}</Link><Link className="text-link" to={{ page: 'school-extracurricular' }}>{t('Ekstrakurikuler', 'Extracurricular activities')}</Link><Link className="text-link" to={{ page: 'school-immersion' }}>Immersion</Link><Link className="text-link" to={{ page: 'achievements' }}>{t('Prestasi siswa', 'Student achievements')}</Link><Link className="text-link" to={{ page: 'gallery' }}>{t('Galeri kegiatan', 'School gallery')}</Link></div><PublishedList records={records('activity')} /></section>}
    {page === 'school-admin-info' && <section className="institution-related"><h2>{t('Pengumuman dan informasi', 'Announcements and information')}</h2><PublishedList records={records('administration')} />{s.capabilities.includes('portal') && <Link className="action-link" to={{ page: 'portal', view: 'student' }}>{t('Buka portal siswa', 'Open student portal')}</Link>}</section>}
  </div></div></article>;
}
