import { Empty, Link, useApp, useText } from './ui.tsx';
import { schoolBrand } from './institution-brand.ts';

export function InstitutionHome() {
  const { s, lang, params } = useApp();
  const t = useText();
  const record = s.content.find(item => item.id === 'home');
  const home = params.get('preview') === 'true' && ['admin', 'editor'].includes(s.actor?.role ?? '') ? record?.draft : record?.published;
  const mediaUrl = (image: string) => image.startsWith('/api/media/') && s.demo ? `${image}?preset=${encodeURIComponent(params.get('preset') ?? s.preset)}` : image;
  const brand = schoolBrand(s.demo);
  const heroImage = mediaUrl(home?.image || brand.heroImage || brand.fallbackHeroImage);
  const stories = s.content.filter(item => item.collection === 'announcements' && (!item.published?.attributes.kind || item.published.attributes.kind === 'news') && item.published).sort((a, b) => String(b.published?.attributes.date ?? '').localeCompare(String(a.published?.attributes.date ?? ''))).slice(0, 6);
  const activities = [
    { page: 'school-activities', image: brand.images.activities, id: 'Kegiatan sekolah', en: 'School activities', detailId: 'Belajar bersama di dalam dan luar kelas', detailEn: 'Learning together in and beyond class' },
    { page: 'school-extracurricular', image: brand.images.extracurricular, id: 'Ekstrakurikuler', en: 'Extracurriculars', detailId: 'Mencoba minat dan mengasah keterampilan', detailEn: 'Explore interests and build skills' },
    { page: 'school-immersion', image: brand.images.immersion, id: 'Immersion', en: 'Immersion', detailId: 'Mengenal lingkungan dan perspektif baru', detailEn: 'Discover new places and perspectives' },
    { page: 'school-teachers', image: brand.teacherImage, id: 'Pendidik kami', en: 'Our educators', detailId: 'Mengenal orang-orang di balik pembelajaran', detailEn: 'Meet the people behind the learning' },
  ];
  const usedImages = new Set([home?.image || brand.heroImage || brand.fallbackHeroImage, ...Object.values(brand.images), brand.teacherImage, ...activities.map(item => item.image)].filter(Boolean));
  const storyItems = stories.map(story => {
    const image = story.published?.image;
    if (!image || usedImages.has(image)) return { story, image: '' };
    usedImages.add(image);
    return { story, image };
  });
  const photoStories = storyItems.filter(item => item.image);
  const textStories = storyItems.filter(item => !item.image);
  const gallery = s.content.filter(item => { const image = item.published?.image; if (item.collection !== 'gallery' || !image || usedImages.has(image)) return false; usedImages.add(image); return true; }).slice(0, 5);
  if (!home) return <Empty>{t('Halaman belum terbit.', 'This page is not published yet.')}</Empty>;
  const copy = (id: string, fallbackHeading: string, fallbackBody: string) => {
    const block = home.blocks.find(item => item.id === id);
    return { heading: block?.heading[lang] || fallbackHeading, body: block?.body[lang] || fallbackBody };
  };
  const welcome = copy('welcome', t('Setiap hari adalah kesempatan untuk menemukan hal baru.', 'Every day is a chance to discover something new.'), t('Di sini, belajar berarti berani bertanya, mencoba bersama teman, dan mengenal dunia dengan cara yang lebih dekat.', 'Here, learning means asking questions, trying things with friends, and getting to know the world firsthand.'));
  const journey = copy('journey', t('Belajar, berkarya, dan berteman.', 'Learn, create, and find your people.'), t('Dari ruang kelas hingga kegiatan setelah sekolah, ada banyak cara untuk mencoba minat baru dan tumbuh bersama.', 'From the classroom to after-school activities, there are many ways to explore new interests and grow together.'));
  const information = copy('information', t('Informasi untuk keluarga sekolah', 'Information for school families'), t('Ikuti informasi sekolah dan kenali pilihan penerimaan siswa baru.', 'Follow school updates and explore admissions pathways.'));
  const news = copy('news', t('Ada banyak cerita di sekolah kita.', 'There is always a story to share.'), t('Ikuti kegiatan, gagasan, dan karya yang hadir dari keseharian siswa.', 'Explore the activities, ideas, and creations that shape student life.'));
  const achievement = copy('achievement', t('Cerita di balik setiap karya', 'The story behind every creation'), t('Lihat proses dan karya yang dibagikan siswa.', 'Explore the work and process students share.'));
  const immersion = copy('immersion', t('Belajar dari pengalaman baru', 'Learning through new experiences'), t('Mengenal lingkungan dan perspektif di luar keseharian.', 'Discover new places and perspectives beyond the everyday.'));
  const activitiesCopy = copy('activities', t('Banyak cara untuk menemukan minat.', 'Many ways to discover what you love.'), t('Kegiatan sekolah membuka ruang untuk mencoba, bekerja sama, dan bertumbuh.', 'School activities make room to explore, work together, and grow.'));
  const invitation = copy('invitation', t(`Mari kenali ${s.institution.name} lebih dekat.`, `Get to know ${s.institution.name}.`), t('Temukan informasi penerimaan dan langkah untuk memulai perjalanan baru bersama kami.', 'Explore admissions and the steps to begin a new journey with us.'));
  return <div className="institution-home">
    <section className="school-opening">
      <div className="school-opening-image" aria-hidden="true">{heroImage && <img src={heroImage} alt="" />}</div>
      <div className="school-opening-inner">
        <h1>{home.title[lang] || s.institution.name}</h1>
        {home.summary[lang] && <p>{home.summary[lang]}</p>}
        <div className="school-opening-actions"><Link className="action-link" to={{ page: 'school-admissions' }}>{t('Penerimaan siswa baru', 'Admissions')}</Link><Link className="school-opening-link" to={{ page: 'school-profile' }}>{t('Kenali sekolah', 'Discover our school')}</Link></div>
      </div>
      <svg className="school-opening-wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60C300 10 560 100 850 49S1260 18 1440 54V90H0Z"/></svg>
    </section>
    <section className="school-welcome" data-school-reveal><div className="school-welcome-title"><h2>{welcome.heading}</h2><Link className="school-inline-link" to={{ page: 'school-profile' }}>{t('Tentang sekolah', 'About our school')}</Link></div><div className="school-welcome-copy"><p>{welcome.body}</p><svg viewBox="0 0 200 36" aria-hidden="true"><path d="M2 24C31 4 48 5 69 19S107 34 130 15 171 1 198 12"/></svg></div></section>
    <section className={`school-journey${!brand.images.journeyMain && !brand.images.journeyDetail ? ' no-images' : ''}`} data-school-reveal>{(brand.images.journeyMain || brand.images.journeyDetail) && <div className="school-journey-images">{brand.images.journeyMain && <img className="school-journey-main" src={mediaUrl(brand.images.journeyMain)} alt=""/>}{brand.images.journeyDetail && <img className="school-journey-small" src={mediaUrl(brand.images.journeyDetail)} alt=""/>}<span className="school-journey-stroke" aria-hidden="true" /></div>}<div className="school-journey-copy"><h2>{journey.heading}</h2><p>{journey.body}</p><Link className="school-inline-link" to={{ page: 'school-life' }}>{t('Jelajahi kehidupan sekolah', 'Explore school life')}</Link></div></section>
    <section className="school-info-board" data-school-reveal><div><h2>{information.heading}</h2><p>{information.body}</p><Link className="school-inline-link" to={{ page: 'school-admin-info' }}>{t('Lihat informasi sekolah', 'School information')}</Link></div><div className="school-admission-paths"><div className="school-event">{brand.images.event && <img src={mediaUrl(brand.images.event)} alt="" />}<div><h3>{t('Agenda sekolah', 'School calendar')}</h3><p>{t('Temukan informasi kegiatan dan pengumuman untuk keluarga sekolah.', 'Find activities and announcements for school families.')}</p><Link to={{ page: 'school-admin-info' }}>{t('Lihat agenda', 'View the calendar')}</Link></div></div><h3>{t('Penerimaan siswa baru', 'Admissions')}</h3><Link to={{ page: 'school-admissions-test' }}><span>01</span><strong>{t('Jalur tes', 'Test pathway')}</strong></Link><Link to={{ page: 'school-admissions-achievement' }}><span>02</span><strong>{t('Jalur prestasi', 'Achievement pathway')}</strong></Link></div></section>
    <section className="school-community"><div><h2>{news.heading}</h2><p>{news.body}</p><Link className="school-inline-link" to={{ page: 'news' }}>{t('Lihat semua kabar', 'See all stories')}</Link></div><div className={`school-community-grid${textStories.length && photoStories.length ? ' has-text-stories' : ''}`}>
      {photoStories.length > 0 && <div className="school-community-photos">{photoStories.map(({ story, image }) => <article key={story.id} data-school-reveal><Link to={{ page: 'story', story: story.id }}><img src={mediaUrl(image)} alt=""/><h3>{story.published?.title[lang]}</h3><p>{story.published?.summary[lang]}</p></Link></article>)}</div>}
      {textStories.length > 0 && <div className="school-community-text">{textStories.map(({ story }) => <article key={story.id} data-school-reveal><Link to={{ page: 'story', story: story.id }}><h3>{story.published?.title[lang]}</h3><p>{story.published?.summary[lang]}</p></Link></article>)}</div>}
    </div>{!stories.length && <Empty>{t('Belum ada berita yang diterbitkan.', 'No news has been published yet.')}</Empty>}</section>
    <section className="school-highlights" aria-label={t('Sorotan sekolah', 'School highlights')}>
      <div data-school-reveal><Link to={{ page: 'achievements' }} className="school-highlight">{brand.images.achievement && <img src={mediaUrl(brand.images.achievement)} alt=""/>}<div><h2>{achievement.heading}</h2><p>{achievement.body}</p><span>{t('Lihat prestasi', 'See achievements')}</span></div></Link></div>
      <div data-school-reveal><Link to={{ page: 'school-immersion' }} className="school-highlight">{brand.images.immersionFeature && <img src={mediaUrl(brand.images.immersionFeature)} alt=""/>}<div><h2>{immersion.heading}</h2><p>{immersion.body}</p><span>{t('Jelajahi immersion', 'Explore immersion')}</span></div></Link></div>
    </section>
    <section className="school-activities">
      <div className="school-activities-heading"><div><h2>{activitiesCopy.heading}</h2><p>{activitiesCopy.body}</p></div><Link className="school-inline-link" to={{ page: 'school-life' }}>{t('Semua kegiatan', 'Explore school life')}</Link></div>
      <div className="school-activity-grid">{activities.map(activity => { const data = s.content.find(item => item.id === activity.page)?.published; const title = data?.title[lang] || (lang === 'id' ? activity.id : activity.en); const detail = data?.summary[lang] || (s.demo ? (lang === 'id' ? activity.detailId : activity.detailEn) : ''); return <article key={activity.page} data-school-reveal><Link to={{ page: activity.page }}>{activity.image && <div className="school-activity-image"><img src={mediaUrl(activity.image)} alt="" loading="lazy" /></div>}<h3>{title}</h3>{detail && <p>{detail}</p>}</Link></article>; })}</div>
    </section>
    {gallery.length > 0 && <section className="school-gallery-preview" data-school-reveal><div><h2>{t(`Momen di ${s.institution.name}`, `Moments at ${s.institution.name}`)}</h2><p>{t('Lihat lebih dekat keseharian dan kegiatan sekolah.', 'Take a closer look at school life and activities.')}</p><Link className="school-inline-link" to={{ page: 'gallery' }}>{t('Buka galeri', 'View the gallery')}</Link></div><div className="school-gallery-ribbon">{gallery.map(item => <Link to={{ page: 'gallery' }} key={item.id} aria-label={item.published!.title[lang]}><img src={mediaUrl(item.published!.image)} alt="" loading="lazy" /></Link>)}</div></section>}
    <section className={`school-invite${brand.images.invitation ? '' : ' no-image'}`} data-school-reveal><div><h2>{invitation.heading}</h2><p>{invitation.body}</p><Link className="action-link" to={{ page: 'school-admissions' }}>{t('Lihat panduan penerimaan', 'Explore admissions')}</Link></div>{brand.images.invitation && <img src={mediaUrl(brand.images.invitation)} alt=""/>}</section>
  </div>;
}
