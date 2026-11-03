import catalog from './presets.json' with { type: 'json' };
import type { ContentData, ContentRecord, Preset, SchoolConfig, SchoolState, Text } from '../src/domain/types.ts';
export const bi = (id: string, en: string): Text => ({ id, en });
export const photo = { classroom: '/images/classroom.jpg', library: '/images/library.jpg', workshop: '/images/workshop.jpg', teacher: '/images/teacher.jpg' };
export const presetContent = catalog;
// Returning demo visitors may still have the original, shared classroom pictures.
// Project the new sample media without writing to the CMS or replacing a saved edit.
export function refreshDemoPhotos(record: ContentRecord, preset: Preset): ContentRecord {
    if (!record.published) return record;
    // A first revision preserves the original draft when an unrelated edit is saved.
    // It also lets us recognize an unchanged published baseline after that save.
    const baseline = record.version === 1 && !record.revisions.length
        || record.revisions.some(rev => rev.version === 1 && JSON.stringify(rev.data) === JSON.stringify(record.published));
    if (!baseline) return record;
    const profile = catalog[preset];
    const isHome = record.collection === 'pages' && record.id === 'home';
    const program = record.collection === 'programs' && profile.programs.find(p => p.id === record.id);
    if (!isHome && !program) return record;
    const previous = record.id === 'photo-workshop' ? photo.workshop : photo.classroom;
    if (record.published.image !== previous) return record;

    function refresh(data: ContentData): ContentData {
        if (program) return { ...data, image: program.image };
        const blocks = data.blocks.map(block => {
            if (block.id === 'approach' && block.type === 'image-text' && block.image === photo.workshop)
                return { ...block, ...profile.approach };
            if (block.id === 'facilities' && block.type === 'facilities' && block.image === photo.library)
                return { ...block, ...profile.facilities };
            return block;
        });
        return { ...data, image: profile.image, blocks };
    }
    return { ...record, draft: record.version === 1 && !record.revisions.length && record.draft.image === previous ? refresh(record.draft) : record.draft, published: refresh(record.published) };
}
export function seed(preset: Preset, config: SchoolConfig, demo: boolean, now = new Date()): SchoolState {
    const p = catalog[preset], today = now.getTime();
    const at = (days: number, hour = 9) => { const d = new Date(today + days * 86400000); d.setUTCHours(hour - 7, 0, 0, 0); return d.toISOString(); };
    const blocks = [{ id: 'approach', type: 'image-text', ...p.approach }, { id: 'facilities', type: 'facilities', ...p.facilities }, { id: 'faq', type: 'faq', heading: bi('Bagaimana memilih kelas?', 'How do I choose a class?'), body: bi('Lihat tujuan program, jadwal, dan biaya. Hubungi tim untuk membahas kebutuhan belajar. Pengajuan tidak menjamin penerimaan.', 'Review program goals, schedules, and fees. Contact the team to discuss your learning needs. An application does not guarantee admission.') }, { id: 'testimonial', type: 'testimonial', heading: bi('Catatan peserta contoh', 'Fictional learner feedback'), body: bi('“Jadwal yang jelas membantu saya menyiapkan latihan sebelum kelas.” Sinta, peserta fiktif untuk demonstrasi.', '“A clear schedule helps me prepare before class.” Sinta, a fictional learner for this demonstration.') }];
    const make = (id: string, collection: string, title: Text, body: Text, image: string, attrs: Record<string, string | boolean | string[]> = {}): ContentRecord => { const data: ContentData = { title, summary: body, body, image, seoTitle: title, seoDescription: body, blocks: [], attributes: attrs }; return { id, collection, slug: id, draft: structuredClone(data), published: structuredClone(data), version: 1, revisions: [] }; };
    const home = make('home', 'pages', p.headline, p.intro, p.image);
    home.draft.blocks = blocks;
    home.published!.blocks = structuredClone(blocks);
    const programs = p.programs.map((x, i) => ({ id: x.id, contentId: x.id, type: preset, subject: x.subject, format: x.format as 'online' | 'onsite' | 'hybrid', duration: x.duration, tutorIds: [i % 2 === 0 ? 'tutor-ayu' : 'tutor-raka'] }));
    const cohorts = p.programs.map((x, i) => ({ id: `${x.id}-nov`, programId: x.id, branchId: 'main', name: preset === 'institution' ? 'Penerimaan 2027' : `Batch ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(at(35 + i)))}`, capacity: x.capacity, opensAt: at(-30), closesAt: at(30), startsAt: at(35 + i), endsAt: at(110 + i), tuitionIdr: x.tuitionIdr, registrationIdr: x.registrationIdr, requiresApproval: true, requiresPayment: true }));
    return { schemaVersion: 1, institution: { name: demo ? p.name : config.brandName, description: p.intro, address: demo ? 'Ruang belajar contoh, Jawa Barat' : '', email: demo ? 'hello@example.test' : '', whatsapp: config.whatsapp, timezone: 'Asia/Jakarta', navigation: [{ label: bi('Program', 'Programs'), page: 'programs' }, { label: bi('Pengajar', 'Teachers'), page: 'teachers' }, { label: bi('Jadwal', 'Schedules'), page: 'schedule' }, { label: bi('Tentang', 'About'), page: 'about' }] }, branches: [{ id: 'main', name: 'Kampus utama', address: 'Alamat contoh, bukan lokasi nyata' }], programs, courses: p.programs.map(x => ({ id: `course-${x.id}`, programId: x.id, title: x.title, outcomes: [x.body, bi('Menerapkan materi dalam latihan terarah', 'Apply concepts through guided practice')] })), cohorts,
        sessions: cohorts.flatMap((c, i) => [0, 1, 2].map(n => ({ id: `session-${i}-${n}`, cohortId: c.id, tutorId: i % 2 === 0 ? 'tutor-ayu' : 'tutor-raka', title: bi(`Pertemuan ${n + 1}: ${p.programs[i].title.id}`, `Session ${n + 1}: ${p.programs[i].title.en}`), startsAt: at(35 + i + n * 7), endsAt: at(35 + i + n * 7, 11), location: i === 2 ? 'Kelas daring / Online classroom' : 'Studio 1' }))),
        tutors: [{ id: 'tutor-ayu', name: 'Ayu Prameswari', bio: bi('Pengajar fiktif. Membantu peserta memahami konsep lewat diskusi dan latihan.', 'Fictional teacher. Helps learners understand concepts through discussion and practice.'), specialty: bi(preset === 'language' ? 'English & percakapan' : 'Konsep & praktik', preset === 'language' ? 'English & conversation' : 'Concepts & practice'), image: photo.teacher }, { id: 'tutor-raka', name: 'Raka Wicaksana', bio: bi('Pengajar fiktif. Memimpin kelas kecil dan memberi umpan balik pada proses belajar.', 'Fictional teacher. Leads small classes and gives feedback on learning.'), specialty: bi('Kelas & lokakarya', 'Classes & workshops'), image: photo.workshop }],
        users: demo ? [{ id: 'admin', name: 'Nadia · Demo', email: 'admin@example.test', role: 'admin', studentIds: [] }, { id: 'staff', name: 'Dian · Demo', email: 'staff@example.test', role: 'staff', studentIds: [] }, { id: 'editor', name: 'Editor · Demo', email: 'editor@example.test', role: 'editor', studentIds: [] }, { id: 'tutor', name: 'Ayu · Demo', email: 'tutor@example.test', role: 'tutor', studentIds: [], tutorId: 'tutor-ayu' }, { id: 'student', name: 'Sinta · Demo', email: 'student@example.test', role: 'student', studentIds: ['student-sinta'] }, { id: 'guardian', name: 'Wali · Demo', email: 'guardian@example.test', role: 'guardian', studentIds: ['student-sinta'] }, { id: 'other', name: 'Peserta lain · Demo', email: 'other@example.test', role: 'student', studentIds: ['student-other'] }] : [],
        students: demo ? [{ id: 'student-sinta', name: 'Sinta · Peserta fiktif', email: 'student@example.test' }, { id: 'student-other', name: 'Peserta lain · Fiktif', email: 'other@example.test' }] : [],
        enrollments: demo ? [{ id: 'application-sample', studentId: 'student-other', cohortId: cohorts[0].id, status: 'submitted', answers: {}, createdAt: at(-1), updatedAt: at(-1), version: 1 }] : [], events: demo ? [{ id: 'event-sample', enrollmentId: 'application-sample', status: 'submitted', at: at(-1), by: 'other', note: 'Sample application' }] : [], invoices: [], payments: [], attendance: [], progress: [],
        materials: cohorts.map(c => ({ id: `material-${c.id}`, cohortId: c.id, title: bi('Persiapan pertemuan pertama', 'Prepare for your first session'), description: bi('Catatan belajar dan latihan awal.', 'Study notes and introductory exercises.'), sampleText: 'Sample learning resource\n\n1. List your learning goals.\n2. Review the program outline.\n3. Bring one question to the first session.\n\nReplace with your own teaching material.' })), media: [],
        content: [home, ...p.programs.map(x => make(x.id, 'programs', x.title, x.body, x.image, { ...p.attributes, kind: x.kind })), make('admissions', 'announcements', bi('Pendaftaran kelas berikutnya', 'Next intake applications'), bi('Lihat jadwal dan persyaratan sebelum mengajukan pendaftaran.', 'Check schedules and requirements before applying.'), photo.library)],
        modules: { ...config.modules }, registrationFields: [...p.fields, ...config.registrationFields] as SchoolState['registrationFields'], outbox: [], idempotency: {} };
}
