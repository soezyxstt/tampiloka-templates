import catalog from './presets.json' with { type: 'json' };
import { demoInstitutionName, institutionBrand } from './institution-brand.ts';
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
export function seed(preset: Preset, config: SchoolConfig, demo: boolean, now = new Date(), brand = institutionBrand): SchoolState {
    const p = catalog[preset], today = now.getTime();
    const at = (days: number, hour = 9) => { const d = new Date(today + days * 86400000); d.setUTCHours(hour - 7, 0, 0, 0); return d.toISOString(); };
    const blocks = [{ id: 'approach', type: 'image-text', ...p.approach }, { id: 'facilities', type: 'facilities', ...p.facilities }, { id: 'faq', type: 'faq', heading: bi('Bagaimana memilih kelas?', 'How do I choose a class?'), body: bi('Lihat tujuan program, jadwal, dan biaya. Hubungi tim untuk membahas kebutuhan belajar. Pengajuan tidak menjamin penerimaan.', 'Review program goals, schedules, and fees. Contact the team to discuss your learning needs. An application does not guarantee admission.') }, { id: 'testimonial', type: 'testimonial', heading: bi('Catatan peserta contoh', 'Fictional learner feedback'), body: bi('“Jadwal yang jelas membantu saya menyiapkan latihan sebelum kelas.” Sinta, peserta fiktif untuk demonstrasi.', '“A clear schedule helps me prepare before class.” Sinta, a fictional learner for this demonstration.') }];
    const make = (id: string, collection: string, title: Text, body: Text, image: string, attrs: Record<string, string | boolean | string[]> = {}): ContentRecord => { const data: ContentData = { title, summary: body, body, image, seoTitle: title, seoDescription: body, blocks: [], attributes: attrs }; return { id, collection, slug: id, draft: structuredClone(data), published: structuredClone(data), version: 1, revisions: [] }; };
    const home = make('home', 'pages', p.headline, p.intro, p.image);
    home.draft.blocks = blocks;
    home.published!.blocks = structuredClone(blocks);
    const institutionContent = demo && preset === 'institution' ? [
        make('school-profile', 'pages', bi('Mengenal sekolah kami', 'Get to know our school'), bi('Sekolah menengah fiktif yang memberi ruang bagi siswa untuk belajar dan bertumbuh bersama.', 'A fictional secondary school where students learn and grow together.'), '/images/institution/students.jpg'),
        make('school-vision', 'pages', bi('Visi dan misi', 'Vision and mission'), bi('Arah bersama dalam mendampingi perjalanan belajar siswa.', 'Our shared direction in supporting each student’s learning journey.'), '/images/institution/science.jpg'),
        make('school-contact', 'pages', bi('Hubungi sekolah', 'Contact the school'), bi('Temukan informasi kontak dan layanan sekolah.', 'Find school contact information and services.'), '/images/institution/classroom.jpg'),
        make('school-admissions', 'pages', bi('Penerimaan siswa baru', 'Admissions'), bi('Kenali tahapan penerimaan dan persiapkan perjalanan belajar bersama kami.', 'Explore admissions and prepare for a new learning journey.'), '/images/institution/students.jpg'),
        make('school-admissions-test', 'pages', bi('Jalur tes', 'Test pathway'), bi('Contoh alur penerimaan melalui tes untuk calon siswa.', 'An example admissions pathway based on a test.'), '/images/institution/classroom.jpg'),
        make('school-admissions-achievement', 'pages', bi('Jalur prestasi', 'Achievement pathway'), bi('Contoh alur penerimaan melalui tinjauan prestasi dan karya.', 'An example admissions pathway based on achievements and work.'), '/images/institution/students.jpg'),
        make('school-activities', 'pages', bi('Kegiatan sekolah', 'School activities'), bi('Pengalaman di dalam dan di luar kelas yang mengajak siswa terlibat bersama.', 'Experiences in and beyond the classroom that bring students together.'), '/images/institution/students.jpg'),
        make('school-extracurricular', 'pages', bi('Ekstrakurikuler', 'Extracurricular activities'), bi('Ruang untuk mencoba minat, berlatih, dan bertemu teman baru.', 'Space to explore interests, practice, and meet new friends.'), '/images/institution/science.jpg'),
        make('school-immersion', 'pages', bi('Immersion', 'Immersion'), bi('Mengenal lingkungan dan perspektif baru lewat pengalaman bersama.', 'Discover new environments and perspectives through shared experiences.'), '/images/institution/classroom.jpg'),
        make('school-life', 'pages', bi('Kehidupan di sekolah', 'Life at school'), bi('Dari ruang kelas hingga kegiatan bersama, setiap hari memberi kesempatan untuk mencoba.', 'From the classroom to shared activities, each day is a chance to explore.'), '/images/institution/science.jpg'),
        make('school-admin-info', 'pages', bi('Informasi dan layanan sekolah', 'School information and services'), bi('Temukan informasi akademik dan layanan bagi keluarga sekolah.', 'Find academic information and services for school families.'), '/images/institution/classroom.jpg'),
        make('school-projects', 'announcements', bi('Menemukan ide lewat proyek sains', 'Finding ideas through science projects'), bi('Siswa bekerja bersama untuk mengamati dan menguji gagasan.', 'Students work together to observe and test ideas.'), '/images/institution/science.jpg', { kind: 'news' }),
        make('school-collaboration', 'announcements', bi('Cerita dari ruang belajar', 'Stories from the classroom'), bi('Diskusi dan kerja kelompok menjadi bagian dari keseharian belajar.', 'Discussion and teamwork are part of everyday learning.'), '/images/institution/classroom.jpg', { kind: 'news' }),
        make('school-clubs', 'announcements', bi('Mencoba hal baru lewat klub sekolah', 'Trying something new in school clubs'), bi('Pilihan kegiatan memberi ruang untuk mengeksplorasi minat.', 'School activities give students space to explore their interests.'), '/images/institution/science.jpg', { kind: 'activity' }),
        make('school-calendar', 'announcements', bi('Kalender kegiatan akademik', 'Academic activity calendar'), bi('Informasi kegiatan belajar tersedia melalui layanan administrasi sekolah.', 'Learning activity information is available through school administration.'), '/images/institution/classroom.jpg', { kind: 'administration' }),
        make('gallery-science', 'gallery', bi('Eksplorasi sains', 'Science exploration'), bi('Foto ilustrasi kegiatan belajar.', 'Illustrative learning photo.'), '/images/institution/science.jpg'),
        make('gallery-students', 'gallery', bi('Belajar bersama', 'Learning together'), bi('Foto ilustrasi kegiatan belajar.', 'Illustrative learning photo.'), '/images/institution/students.jpg'),
        make('gallery-classroom', 'gallery', bi('Di ruang kelas', 'In the classroom'), bi('Foto ilustrasi kegiatan belajar.', 'Illustrative learning photo.'), '/images/institution/classroom.jpg'),
        make('gallery-art', 'gallery', bi('Berkarya di studio seni', 'Creating in the art studio'), bi('Eksplorasi bahan dan gagasan bersama di kelas seni.', 'Exploring materials and ideas together in art class.'), '/images/institution/art.jpg'),
        make('gallery-project', 'gallery', bi('Proyek bersama teman', 'A project with classmates'), bi('Siswa menyusun ide dan membagi tugas untuk proyek kelas.', 'Students develop ideas and share tasks for a class project.'), '/images/institution/class-project.jpg'),
        make('gallery-lab', 'gallery', bi('Mencoba di laboratorium', 'Experimenting in the lab'), bi('Pengamatan dan percobaan menjadi bagian dari pelajaran sains.', 'Observation and experiments are part of science lessons.'), '/images/institution/lab.jpg'),
        make('gallery-lesson', 'gallery', bi('Diskusi di kelas', 'Classroom discussion'), bi('Siswa bertukar pertanyaan dan mendengarkan pendapat teman.', 'Students exchange questions and listen to one another.'), '/images/institution/lesson.jpg'),
        make('gallery-outdoors', 'gallery', bi('Waktu bersama di luar kelas', 'Time together outdoors'), bi('Kegiatan luar ruang memberi kesempatan bertemu dan bergerak bersama.', 'Outdoor activities create opportunities to meet and move together.'), '/images/institution/friends-outdoors.jpg'),
        make('school-showcase', 'announcements', bi('Panggung karya siswa', 'A showcase of student work'), bi('Siswa berbagi hasil eksplorasi dalam kegiatan sekolah.', 'Students share their explorations at a school activity.'), '/images/institution/students.jpg', { kind: 'achievement' }),
    ] : [];
    if (demo && preset === 'institution') {
        home.draft.image = '/images/institution/campus-project.webp';
        home.published!.image = home.draft.image;
        const profile = institutionContent.find(x => x.id === 'school-profile')!;
        profile.draft.blocks = [{ id: 'story', type: 'text', heading: bi('Belajar bersama', 'Learning together'), body: bi('Dalam demo ini, sekolah digambarkan sebagai tempat siswa belajar melalui kelas, kegiatan, dan pengalaman bersama.', 'In this demo, the school is imagined as a place where students learn through classes, activities, and shared experiences.') }];
        profile.published!.blocks = structuredClone(profile.draft.blocks);
        const vision = institutionContent.find(x => x.id === 'school-vision')!;
        vision.draft.blocks = [{ id: 'vision', type: 'text', heading: bi('Visi', 'Vision'), body: bi('Menjadi ruang belajar yang mendukung siswa untuk berpikir, berkarya, dan peduli.', 'Be a learning community that supports students to think, create, and care.') }, { id: 'mission', type: 'text', heading: bi('Misi', 'Mission'), body: bi('Menghadirkan pembelajaran yang aktif, membangun kebiasaan refleksi, dan memberi ruang bagi kerja sama.', 'Offer active learning, build habits of reflection, and make space for collaboration.') }];
        vision.published!.blocks = structuredClone(vision.draft.blocks);
        const contact = institutionContent.find(x => x.id === 'school-contact')!;
        contact.draft.blocks = [{ id: 'contact', type: 'text', heading: bi('Kontak demo', 'Demo contact'), body: bi('Informasi kontak dalam demo ini bersifat fiktif. Tidak ada pesan yang akan dikirim ke sekolah nyata.', 'Contact information in this demo is fictional. No message will be sent to a real school.') }];
        contact.published!.blocks = structuredClone(contact.draft.blocks);
        const admissions = institutionContent.find(x => x.id === 'school-admissions')!;
        admissions.draft.blocks = [
            { id: 'steps', type: 'text', heading: bi('Tahapan pendaftaran', 'How to apply'), body: bi('Pelajari informasi, siapkan dokumen, isi formulir, lalu ikuti proses seleksi dan daftar ulang sesuai petunjuk.', 'Review the information, prepare documents, complete the form, then follow the selection and enrollment steps.') },
            { id: 'documents', type: 'text', heading: bi('Dokumen yang disiapkan', 'Documents to prepare'), body: bi('Identitas calon siswa dan keluarga serta dokumen sekolah asal diperlukan sebagai contoh dalam demo ini.', 'Student and family identification and previous school documents are sample requirements in this demo.') },
        ];
        admissions.published!.blocks = structuredClone(admissions.draft.blocks);
        for (const id of ['school-admissions-test', 'school-admissions-achievement']) {
            const pathway = institutionContent.find(x => x.id === id)!;
            pathway.draft.blocks = [
                { id: 'steps', type: 'text', heading: bi('Tahapan', 'Steps'), body: id === 'school-admissions-test' ? bi('Isi formulir, lengkapi dokumen, ikuti tes contoh, lalu tinjau pengumuman dan daftar ulang.', 'Complete the form and documents, take the sample test, then review the announcement and complete enrollment.') : bi('Isi formulir, unggah ringkasan prestasi atau karya, ikuti peninjauan, lalu tinjau pengumuman dan daftar ulang.', 'Complete the form, share an achievement or work summary, attend the review, then check the announcement and complete enrollment.') },
                { id: 'requirements', type: 'text', heading: bi('Persyaratan contoh', 'Example requirements'), body: bi('Siapkan identitas calon siswa, data keluarga, dan dokumen sekolah asal. Untuk jalur prestasi, sertakan ringkasan karya atau prestasi.', 'Prepare student identification, family details, and documents from the previous school. For the achievement pathway, include a summary of work or achievements.') },
                { id: 'schedule', type: 'text', heading: bi('Jadwal dan biaya contoh', 'Example dates and fees'), body: bi('Dalam simulasi ini, formulir dibuka pada Januari, seleksi berlangsung pada Februari, dan hasil disampaikan pada Maret. Biaya belum ditetapkan; angka dan jadwal ini bukan informasi penerimaan sebenarnya.', 'In this simulation, applications open in January, selection takes place in February, and results are shared in March. Fees have not been set; these example dates are not actual admissions information.') },
            ];
            pathway.published!.blocks = structuredClone(pathway.draft.blocks);
        }
        for (const [id, titleId, titleEn, bodyId, bodyEn] of [
            ['school-activities', 'Kegiatan bersama', 'Activities together', 'Proyek kelas, kegiatan lingkungan, dan pertemuan sekolah menjadi contoh ruang belajar bersama.', 'Class projects, environmental activities, and school gatherings are examples of shared learning.'],
            ['school-extracurricular', 'Pilihan kegiatan', 'Explore activities', 'Sains, seni, dan olahraga adalah contoh pilihan kegiatan dalam demo sekolah fiktif ini.', 'Science, arts, and sports are example activities in this fictional school demo.'],
            ['school-immersion', 'Pengalaman di luar kelas', 'Learning beyond the classroom', 'Program contoh mengajak siswa berinteraksi, mengamati lingkungan, dan berbagi refleksi setelah kegiatan.', 'The example program invites students to interact, observe a different environment, and share reflections afterward.'],
        ]) {
            const activity = institutionContent.find(x => x.id === id)!;
            activity.draft.blocks = [{ id: 'overview', type: 'text', heading: bi(titleId, titleEn), body: bi(bodyId, bodyEn) }];
            activity.published!.blocks = structuredClone(activity.draft.blocks);
        }
        const life = institutionContent.find(x => x.id === 'school-life')!;
        life.draft.blocks = [{ id: 'activities', type: 'text', heading: bi('Kegiatan dan ekstrakurikuler', 'Activities and clubs'), body: bi('Siswa dapat mengenal sains, seni, olahraga, dan kegiatan bersama melalui pilihan kegiatan sekolah.', 'Students can explore science, arts, sports, and shared experiences through school activities.') }];
        life.published!.blocks = structuredClone(life.draft.blocks);
        const admin = institutionContent.find(x => x.id === 'school-admin-info')!;
        admin.draft.blocks = [{ id: 'academic', type: 'text', heading: bi('Administrasi akademik', 'Academic administration'), body: bi('Keluarga dapat melihat informasi akademik dan menghubungi sekolah untuk kebutuhan administrasi.', 'Families can review academic information and contact the school about administration.') }, { id: 'fees', type: 'text', heading: bi('Informasi pembayaran', 'Payment information'), body: bi('Pembayaran dalam demo bersifat simulasi. Tidak ada transaksi nyata.', 'Payments in this demo are simulated. No real transaction takes place.') }];
        admin.published!.blocks = structuredClone(admin.draft.blocks);
    }
    if (demo && preset === 'institution') {
        // These stories, people, dates and fees describe a fictional school for this demo.
        const details: Record<string, [string, string, string, string][]> = {
            'school-profile': [
                ['Berawal dari ruang untuk bertanya', 'A place to ask questions', 'Kisah SMP Nusa Cendekia dimulai pada 2012 dengan satu angkatan kecil dan gagasan sederhana: siswa perlu berani bertanya, mencoba, dan memperbaiki jawabannya bersama teman.', 'The story of SMP Nusa Cendekia begins in 2012 with a small first cohort and a simple idea: students need room to ask questions, experiment, and refine their answers together.'],
                ['Belajar yang dekat dengan kehidupan', 'Learning connected to life', 'Kelas VII sampai IX memadukan pelajaran inti, diskusi, praktik laboratorium, dan proyek lintas mata pelajaran. Guru mendampingi siswa menyusun pertanyaan, menguji ide, lalu mempresentasikan hasilnya.', 'Grades 7–9 combine core subjects, discussion, laboratory practice, and cross-subject projects. Teachers guide students as they formulate questions, test ideas, and present their findings.'],
                ['Ruang untuk menemukan minat', 'Spaces to discover interests', 'Perpustakaan, laboratorium sains dan komputer, studio seni, lapangan serbaguna, serta ruang konseling mendukung kegiatan di kampus. Siswa menggunakannya untuk belajar, berlatih, dan bekerja bersama.', 'The campus includes a library, science and computer labs, an art studio, a multipurpose court, and a counseling room. Students use them to study, practice, and collaborate.'],
            ],
            'school-vision': [
                ['Visi', 'Vision', 'Menjadi komunitas belajar yang menumbuhkan rasa ingin tahu, integritas, dan kepedulian agar setiap siswa berani berkontribusi.', 'To be a learning community that nurtures curiosity, integrity, and care so every student can contribute with confidence.'],
                ['Misi', 'Mission', 'Mengajak siswa berpikir kritis melalui pembelajaran aktif; membangun kebiasaan jujur dan bertanggung jawab; menyediakan ruang untuk berkarya; serta bekerja bersama keluarga dan lingkungan sekitar.', 'Engage students in critical thinking through active learning; build honesty and responsibility; create room for expression; and work alongside families and the wider community.'],
                ['Nilai dalam keseharian', 'Values in daily life', 'Rasa ingin tahu terlihat saat siswa mengajukan pertanyaan. Kepedulian hadir dalam kerja kelompok dan proyek lingkungan. Tanggung jawab dilatih melalui refleksi serta komitmen menyelesaikan tugas.', 'Curiosity appears in the questions students ask. Care is practiced in group work and environmental projects. Responsibility grows through reflection and completing commitments.'],
            ],
            'school-contact': [
                ['Kunjungi kampus', 'Visit the campus', 'SMP Nusa Cendekia, Jalan Cakrawala No. 18, Kota Arunika. Layanan tata usaha dibuka Senin–Jumat, pukul 07.30–15.30 WIB.', 'SMP Nusa Cendekia, 18 Jalan Cakrawala, Kota Arunika. The school office is open Monday–Friday, 7:30 a.m.–3:30 p.m. WIB.'],
                ['Hubungi tata usaha', 'Contact the school office', 'Untuk pertanyaan penerimaan, dokumen, atau jadwal kunjungan, tulis ke halo@nusacendekia.example. Alamat dan surel ini hanya contoh demo dan tidak menerima pesan.', 'For admissions, documents, or visit inquiries, write to halo@nusacendekia.example. This address and email are demo examples and do not receive messages.'],
            ],
            'school-admissions': [
                ['Dua jalur, satu komunitas', 'Two pathways, one community', 'Calon siswa dapat memilih jalur tes atau jalur prestasi. Keduanya mencakup verifikasi dokumen dan percakapan dengan calon siswa serta orang tua. Seluruh informasi berikut adalah simulasi penerimaan, bukan pendaftaran sekolah nyata.', 'Applicants may choose the test or achievement pathway. Both include document verification and a conversation with the applicant and parents. All information here is a fictional admissions simulation.'],
                ['Jadwal contoh 2027/2028', 'Sample 2027/2028 timeline', 'Pendaftaran 4 Januari–12 Februari 2027; verifikasi 15–19 Februari; tes atau peninjauan portofolio 27 Februari; pengumuman 8 Maret; daftar ulang 9–19 Maret. Tanggal ini hanya contoh untuk demo.', 'Applications: January 4–February 12, 2027; verification: February 15–19; test or portfolio review: February 27; results: March 8; enrollment: March 9–19. These dates are examples for the demo only.'],
                ['Dokumen yang disiapkan', 'Documents to prepare', 'Siapkan salinan akta kelahiran dan kartu keluarga, rapor kelas IV–V dan semester terakhir kelas VI, pasfoto, serta surat keterangan sekolah asal. Jalur prestasi menambahkan portofolio atau sertifikat yang relevan.', 'Prepare copies of the birth certificate and family card, grade 4–5 reports and the latest grade 6 report, a portrait photograph, and a letter from the current school. Achievement applicants also provide a relevant portfolio or certificates.'],
                ['Biaya simulasi', 'Sample fees', 'Contoh biaya pendaftaran Rp500.000 dan biaya program Rp6.500.000 per semester. Angka ini fiktif, bukan tagihan, dan tidak ada pembayaran nyata melalui demo.', 'Example fees are IDR 500,000 for registration and IDR 6,500,000 per semester. These fictional figures are not invoices; the demo accepts no real payments.'],
            ],
            'school-admissions-test': [
                ['Cara mengikuti jalur tes', 'How the test pathway works', 'Isi formulir simulasi dan lengkapi dokumen. Setelah verifikasi, calon siswa mengikuti tes literasi Bahasa Indonesia, numerasi, dan pemahaman Bahasa Inggris, dilanjutkan percakapan bersama keluarga.', 'Complete the sample form and provide the documents. After verification, applicants take Indonesian literacy, numeracy, and English comprehension assessments, followed by a family conversation.'],
                ['Yang dinilai', 'What is reviewed', 'Tes contoh meninjau pemahaman bacaan dan cara berpikir, bukan hanya jawaban akhir. Percakapan membantu sekolah mengenal minat, kebutuhan belajar, dan harapan keluarga.', 'The sample assessment reviews reading comprehension and reasoning, not just final answers. The conversation helps the school understand each student’s interests, learning needs, and family expectations.'],
                ['Jadwal dan biaya contoh', 'Example dates and fees', 'Pendaftaran 4 Januari–12 Februari 2027; tes 27 Februari; pengumuman 8 Maret. Biaya pendaftaran simulasi Rp500.000. Tidak ada pembayaran nyata.', 'Apply January 4–February 12, 2027; test February 27; results March 8. The simulated application fee is IDR 500,000. No real payment is collected.'],
            ],
            'school-admissions-achievement': [
                ['Tunjukkan proses dan karya', 'Share your process and work', 'Jalur ini terbuka bagi calon siswa dengan karya atau pengalaman akademik, seni, olahraga, kepemimpinan, maupun kegiatan sosial. Sertakan maksimal tiga karya atau sertifikat beserta cerita singkat tentang prosesnya.', 'This pathway welcomes academic, arts, sports, leadership, or community achievements. Submit up to three works or certificates with a short account of the process behind them.'],
                ['Peninjauan portofolio', 'Portfolio review', 'Tim contoh meninjau keterlibatan, perkembangan, dan refleksi calon siswa, lalu mengundang siswa untuk menceritakan satu karya. Verifikasi rapor dan percakapan keluarga juga menjadi bagian seleksi.', 'The sample review considers involvement, growth, and reflection, then invites the applicant to discuss one piece of work. Report verification and a family conversation are also part of selection.'],
                ['Jadwal dan biaya contoh', 'Example dates and fees', 'Pendaftaran 4 Januari–12 Februari 2027; peninjauan 27 Februari; pengumuman 8 Maret. Biaya pendaftaran simulasi Rp500.000; tidak ada transaksi nyata.', 'Apply January 4–February 12, 2027; portfolio review February 27; results March 8. The simulated application fee is IDR 500,000; no actual transaction occurs.'],
            ],
            'school-activities': [
                ['Kegiatan sepanjang tahun', 'Activities throughout the year', 'Masa orientasi memperkenalkan teman dan lingkungan sekolah; pekan bahasa mengundang siswa membaca serta tampil; proyek kelas menghubungkan pelajaran dengan persoalan sekitar. Setiap semester ditutup dengan berbagi karya dan refleksi.', 'Orientation introduces classmates and the campus; language week brings reading and performance; class projects connect lessons to local questions. Each semester closes with a showcase and reflection.'],
                ['Belajar bersama masyarakat', 'Learning with the community', 'Dalam program Sahabat Lingkungan, siswa mengamati sampah di sekitar sekolah, menyusun usulan pengurangan, dan membagikan hasilnya. Guru mendampingi dari perencanaan hingga evaluasi.', 'In the Environment Friends program, students observe waste around school, develop reduction ideas, and share their findings. Teachers guide planning through evaluation.'],
            ],
            'school-extracurricular': [
                ['Temukan kegiatanmu', 'Find your activity', 'Pilihan kegiatan meliputi klub sains dan robotika, jurnalistik, klub bahasa Inggris, seni rupa, musik, tari, basket, futsal, bulu tangkis, dan pramuka. Siswa dapat mencoba beberapa kegiatan sebelum memilih.', 'Activities include science and robotics, journalism, English club, visual arts, music, dance, basketball, futsal, badminton, and scouting. Students can try activities before choosing.'],
                ['Jadwal dan pendampingan', 'Schedule and guidance', 'Latihan berlangsung setelah pelajaran, umumnya Selasa hingga Kamis pukul 15.00–16.30. Setiap klub didampingi guru atau pelatih; jadwal dan pilihan dalam demo ini adalah contoh.', 'Activities usually run after classes Tuesday through Thursday, 3:00–4:30 p.m. Each club has a teacher or coach; the activities and schedule are examples for this demo.'],
                ['Dari latihan ke panggung', 'From practice to sharing', 'Anggota klub menetapkan target bersama, berlatih rutin, lalu berbagi hasil dalam pameran, pertunjukan, atau pertandingan persahabatan. Pengalaman belajar tetap penting di setiap tahap.', 'Club members set shared goals, practice regularly, and share their work through exhibitions, performances, or friendly matches. Learning remains central throughout.'],
            ],
            'school-immersion': [
                ['Belajar di lingkungan baru', 'Learning in a new setting', 'Program immersion kelas VIII mengajak siswa mengunjungi komunitas dan mengenal cara hidup yang berbeda melalui observasi, percakapan, serta kegiatan bersama selama tiga hari.', 'The grade 8 immersion invites students to visit a community and learn about different ways of life through observation, conversation, and shared activities over three days.'],
                ['Sebelum, selama, dan sesudah', 'Before, during, and after', 'Sebelum berangkat, siswa mempelajari etika kunjungan dan menyusun pertanyaan. Selama kegiatan mereka didampingi guru; setelah kembali, mereka mengolah catatan dan mempresentasikan refleksi.', 'Before departure, students learn visitor etiquette and prepare questions. Teachers accompany them during the visit; afterward, students organize their notes and present reflections.'],
                ['Kesiapan keluarga', 'Preparing as a family', 'Sekolah memberikan rincian agenda, pendamping, perlengkapan, dan persetujuan orang tua sebelum kegiatan. Tujuan dan rincian ini merupakan ilustrasi program, bukan perjalanan yang sedang ditawarkan.', 'The school shares an itinerary, supervision details, packing list, and parental consent information beforehand. This is an illustrative program, not an actual trip on offer.'],
            ],
            'school-life': [
                ['Hari yang memberi ruang untuk tumbuh', 'A day with room to grow', 'Hari dimulai dengan pertemuan wali kelas, dilanjutkan pelajaran, istirahat, dan kegiatan pilihan. Diskusi kelompok, praktik, dan waktu membaca memberi siswa beragam cara untuk belajar.', 'The day begins with homeroom, followed by lessons, breaks, and chosen activities. Group discussion, practice, and reading time give students different ways to learn.'],
                ['Pendampingan siswa', 'Student support', 'Wali kelas dan guru bimbingan konseling membantu siswa menyesuaikan diri, mengelola tantangan belajar, dan membangun hubungan yang sehat. Keluarga dapat menjadwalkan percakapan dengan sekolah.', 'Homeroom and counseling teachers help students adjust, navigate learning challenges, and build healthy relationships. Families can arrange a conversation with the school.'],
                ['Bersama di luar kelas', 'Together beyond class', 'Klub, kegiatan olahraga, panggung seni, proyek lingkungan, dan immersion menjadi kesempatan untuk mencoba hal baru serta menghargai kemampuan teman.', 'Clubs, sports, performances, environmental projects, and immersion offer chances to try something new and appreciate one another’s strengths.'],
            ],
            'school-admin-info': [
                ['Layanan tata usaha', 'Administrative services', 'Keluarga dapat mengajukan surat keterangan siswa, pembaruan data, dan permintaan dokumen akademik melalui tata usaha. Contoh waktu layanan: Senin–Jumat, 07.30–15.30 WIB; penyelesaian surat sekitar tiga hari kerja.', 'Families may request student certificates, update records, and request academic documents from the school office. Example service hours: Monday–Friday, 7:30 a.m.–3:30 p.m. WIB; letters take approximately three working days.'],
                ['Kalender akademik contoh', 'Example academic calendar', 'Tahun ajaran dimulai Juli. Penilaian tengah semester berlangsung September dan Maret; penilaian akhir semester pada Desember dan Juni. Tanggal tepatnya dibagikan sekolah melalui kalender keluarga.', 'The academic year begins in July. Mid-semester assessments take place in September and March; end-of-semester assessments in December and June. Exact dates are shared in the family calendar.'],
                ['Pembayaran dan data keluarga', 'Payments and family records', 'Contoh informasi biaya program tersedia pada halaman penerimaan. Perubahan data orang tua atau wali diajukan dengan dokumen pendukung. Semua layanan dan angka pada situs ini adalah simulasi; tidak ada transaksi nyata.', 'Sample program fee information is available on the admissions page. Parent or guardian details can be updated with supporting documents. All services and figures on this site are simulated; no real transactions occur.'],
            ],
        };
        for (const [id, entries] of Object.entries(details)) {
            const record = institutionContent.find(x => x.id === id)!;
            record.draft.blocks = entries.map(([headingId, headingEn, bodyId, bodyEn], i) => ({ id: `${id}-${i + 1}`, type: 'text', heading: bi(headingId, headingEn), body: bi(bodyId, bodyEn) }));
            record.published!.blocks = structuredClone(record.draft.blocks);
        }
        const structured: Record<string, [string, string, string, string, string, string, string?][]> = {
            'school-profile': [
                ['facility-01', 'text', 'Perpustakaan', 'Library', 'Koleksi bacaan dan meja diskusi mendukung jam membaca, riset tugas, dan pertemuan klub buku.', 'Reading collections and discussion tables support reading time, research, and book club meetings.'],
                ['facility-02', 'image-text', 'Laboratorium sains', 'Science laboratory', 'Meja praktik dan alat peraga digunakan untuk pengamatan serta percobaan yang didampingi guru.', 'Workbenches and learning equipment support teacher-guided observations and experiments.', '/images/institution/lab.jpg'],
                ['facility-03', 'image-text', 'Studio seni', 'Art studio', 'Ruang untuk menggambar, mengeksplorasi bahan, dan menyiapkan karya pameran siswa.', 'A place to draw, explore materials, and prepare student work for exhibitions.', '/images/institution/art.jpg'],
                ['facility-04', 'image-text', 'Ruang kelas kolaboratif', 'Collaborative classrooms', 'Meja dapat diatur ulang untuk diskusi kelompok, presentasi, dan kerja proyek.', 'Desks can be rearranged for group discussion, presentations, and project work.', '/images/institution/classroom.jpg'],
            ],
            'school-admissions': [
                ['timeline-01', 'text', '4 Januari–12 Februari 2027', 'January 4–February 12, 2027', 'Isi formulir dan pilih jalur tes atau prestasi.', 'Complete the form and choose the test or achievement pathway.'],
                ['timeline-02', 'text', '15–19 Februari 2027', 'February 15–19, 2027', 'Tim penerimaan memeriksa kelengkapan dokumen.', 'The admissions team verifies submitted documents.'],
                ['timeline-03', 'text', '27 Februari 2027', 'February 27, 2027', 'Ikuti tes atau peninjauan portofolio sesuai jalur.', 'Attend the test or portfolio review for your chosen pathway.'],
                ['timeline-04', 'text', '8 Maret 2027', 'March 8, 2027', 'Hasil seleksi diumumkan kepada keluarga.', 'Selection results are shared with families.'],
                ['timeline-05', 'text', '9–19 Maret 2027', 'March 9–19, 2027', 'Keluarga yang diterima menyelesaikan daftar ulang.', 'Admitted families complete enrollment.'],
                ['checklist-01', 'text', 'Identitas calon siswa', 'Student identification', 'Salinan akta kelahiran dan pasfoto terbaru.', 'A copy of the birth certificate and a recent portrait photograph.'],
                ['checklist-02', 'text', 'Data keluarga', 'Family information', 'Salinan kartu keluarga dan identitas orang tua atau wali.', 'A copy of the family card and parent or guardian identification.'],
                ['checklist-03', 'text', 'Rapor sekolah asal', 'Previous school reports', 'Rapor kelas IV–V dan semester terakhir kelas VI.', 'Grade 4–5 reports and the latest grade 6 report.'],
                ['checklist-04', 'text', 'Surat sekolah', 'School letter', 'Surat keterangan dari sekolah asal.', 'A letter from the student’s current school.'],
                ['checklist-05', 'text', 'Portofolio jalur prestasi', 'Achievement pathway portfolio', 'Maksimal tiga karya atau sertifikat dengan keterangan singkat prosesnya.', 'Up to three works or certificates with a short account of the process.'],
                ['faq-01', 'faq', 'Apakah calon siswa harus memilih satu jalur?', 'Does an applicant choose one pathway?', 'Ya. Pilih jalur tes atau prestasi saat mengisi formulir agar tim dapat menjadwalkan seleksi yang sesuai.', 'Yes. Choose either the test or achievement pathway in the form so the team can schedule the appropriate review.'],
                ['faq-02', 'faq', 'Apakah prestasi harus berupa juara lomba?', 'Must an achievement be a competition prize?', 'Tidak. Portofolio dapat berisi karya atau pengalaman seni, olahraga, akademik, kepemimpinan, maupun kegiatan sosial.', 'No. A portfolio may include work or experience in the arts, sports, academics, leadership, or community activities.'],
                ['faq-03', 'faq', 'Apakah orang tua mengikuti seleksi?', 'Do parents take part in selection?', 'Orang tua atau wali mengikuti percakapan bersama calon siswa agar sekolah dapat mengenal kebutuhan dan harapan keluarga.', 'A parent or guardian joins the applicant for a conversation about the family’s needs and expectations.'],
                ['faq-04', 'faq', 'Apakah biaya dalam halaman ini harus dibayar?', 'Are the fees shown here payable?', 'Tidak. Jadwal dan biaya merupakan simulasi untuk demo sekolah fiktif ini, dan situs tidak menerima pembayaran nyata.', 'No. Dates and fees are a simulation for this fictional school demo, and the site does not accept real payments.'],
            ],
            'school-admissions-test': [
                ['timeline-01', 'text', '4 Januari–12 Februari 2027', 'January 4–February 12, 2027', 'Pilih jalur tes pada formulir dan lengkapi dokumen.', 'Choose the test pathway in the form and provide the required documents.'],
                ['timeline-02', 'text', '15–19 Februari 2027', 'February 15–19, 2027', 'Tim memverifikasi dokumen dan membagikan petunjuk tes.', 'The team verifies documents and shares test instructions.'],
                ['timeline-03', 'text', '27 Februari 2027', 'February 27, 2027', 'Calon siswa mengikuti tes literasi, numerasi, dan pemahaman Bahasa Inggris serta percakapan keluarga.', 'Applicants take literacy, numeracy, and English comprehension assessments and attend a family conversation.'],
                ['timeline-04', 'text', '8–19 Maret 2027', 'March 8–19, 2027', 'Pengumuman pada 8 Maret; daftar ulang berlangsung 9–19 Maret.', 'Results are shared March 8; enrollment runs March 9–19.'],
                ['checklist-01', 'text', 'Identitas dan data keluarga', 'Identification and family details', 'Siapkan akta kelahiran, kartu keluarga, identitas orang tua atau wali, dan pasfoto.', 'Prepare a birth certificate, family card, parent or guardian identification, and portrait photograph.'],
                ['checklist-02', 'text', 'Dokumen sekolah', 'School documents', 'Siapkan rapor kelas IV–V dan semester terakhir kelas VI serta surat keterangan sekolah asal.', 'Prepare grade 4–5 reports, the latest grade 6 report, and a letter from the current school.'],
                ['faq-01', 'faq', 'Apa yang dinilai dalam tes?', 'What does the test assess?', 'Literasi Bahasa Indonesia, numerasi, dan pemahaman Bahasa Inggris; penilaian juga memperhatikan cara calon siswa bernalar.', 'Indonesian literacy, numeracy, and English comprehension; the assessment also considers how applicants reason.'],
                ['faq-02', 'faq', 'Apakah keluarga ikut hadir?', 'Does the family attend?', 'Orang tua atau wali ikut dalam percakapan bersama calon siswa setelah tahapan verifikasi.', 'A parent or guardian joins the applicant for a conversation after verification.'],
            ],
            'school-admissions-achievement': [
                ['timeline-01', 'text', '4 Januari–12 Februari 2027', 'January 4–February 12, 2027', 'Pilih jalur prestasi, lengkapi dokumen, dan sertakan portofolio.', 'Choose the achievement pathway, provide the documents, and include a portfolio.'],
                ['timeline-02', 'text', '15–19 Februari 2027', 'February 15–19, 2027', 'Tim memverifikasi dokumen dan memberikan petunjuk peninjauan.', 'The team verifies documents and shares review instructions.'],
                ['timeline-03', 'text', '27 Februari 2027', 'February 27, 2027', 'Calon siswa menceritakan salah satu karya dan mengikuti percakapan keluarga.', 'Applicants discuss one piece of work and attend a family conversation.'],
                ['timeline-04', 'text', '8–19 Maret 2027', 'March 8–19, 2027', 'Pengumuman pada 8 Maret; daftar ulang berlangsung 9–19 Maret.', 'Results are shared March 8; enrollment runs March 9–19.'],
                ['checklist-01', 'text', 'Identitas dan dokumen sekolah', 'Identification and school documents', 'Siapkan akta kelahiran, kartu keluarga, identitas wali, pasfoto, rapor kelas IV–V dan semester terakhir kelas VI, serta surat sekolah asal.', 'Prepare a birth certificate, family card, guardian identification, photograph, grade 4–5 reports and latest grade 6 report, and a school letter.'],
                ['checklist-02', 'text', 'Portofolio', 'Portfolio', 'Sertakan maksimal tiga karya atau sertifikat dan cerita singkat mengenai peran serta proses belajar calon siswa.', 'Include up to three works or certificates and a short account of the applicant’s role and learning process.'],
                ['faq-01', 'faq', 'Apakah harus memiliki sertifikat juara?', 'Is a winning certificate required?', 'Tidak. Karya dan pengalaman akademik, seni, olahraga, kepemimpinan, atau sosial dapat disertakan.', 'No. Academic, arts, sports, leadership, and community work or experience may be included.'],
                ['faq-02', 'faq', 'Bagaimana portofolio ditinjau?', 'How is the portfolio reviewed?', 'Tim melihat keterlibatan, perkembangan, dan refleksi; calon siswa juga menceritakan salah satu karya.', 'The team considers involvement, development, and reflection; applicants also discuss one piece of work.'],
            ],
            'school-extracurricular': [
                ['club-01', 'text', 'Klub Sains', 'Science Club', 'Kelas VII–IX · Selasa 15.00–16.30 · Laboratorium sains · Pembina: Saras Wulandari. Pengamatan dan percobaan sederhana dari pertanyaan siswa.', 'Grades 7–9 · Tuesday 3:00–4:30 p.m. · Science lab · Mentor: Saras Wulandari. Student questions lead to observation and hands-on experiments.'],
                ['club-02', 'text', 'Robotika', 'Robotics', 'Kelas VII–IX · Rabu 15.00–16.30 · Laboratorium komputer · Pembina: Ardi Setiawan. Merancang, merakit, dan menguji purwarupa dalam tim.', 'Grades 7–9 · Wednesday 3:00–4:30 p.m. · Computer lab · Mentor: Ardi Setiawan. Design, build, and test prototypes in teams.'],
                ['club-03', 'text', 'Jurnalistik', 'Journalism', 'Kelas VII–IX · Kamis 15.00–16.30 · Perpustakaan · Pembina: Rani Puspita. Wawancara, menulis cerita, dan menyunting majalah sekolah.', 'Grades 7–9 · Thursday 3:00–4:30 p.m. · Library · Mentor: Rani Puspita. Interview, write stories, and edit the school magazine.'],
                ['club-04', 'text', 'English Club', 'English Club', 'Kelas VII–IX · Selasa 15.00–16.30 · Ruang bahasa · Pembina: Maya Kirana. Percakapan, permainan peran, dan presentasi singkat.', 'Grades 7–9 · Tuesday 3:00–4:30 p.m. · Language room · Mentor: Maya Kirana. Conversation, role play, and short presentations.'],
                ['club-05', 'text', 'Seni Rupa', 'Visual Arts', 'Kelas VII–IX · Rabu 15.00–16.30 · Studio seni · Pembina: Intan Kusuma. Eksplorasi gambar, warna, dan pameran karya.', 'Grades 7–9 · Wednesday 3:00–4:30 p.m. · Art studio · Mentor: Intan Kusuma. Explore drawing and color, then exhibit your work.'],
                ['club-06', 'text', 'Ansambel Musik', 'Music Ensemble', 'Kelas VII–IX · Kamis 15.00–16.30 · Ruang musik · Pembina: Laras Sekar. Latihan mendengar, menjaga tempo, dan tampil bersama.', 'Grades 7–9 · Thursday 3:00–4:30 p.m. · Music room · Mentor: Laras Sekar. Practice listening, keeping time, and performing together.'],
                ['club-07', 'text', 'Basket', 'Basketball', 'Kelas VII–IX · Selasa 15.00–16.30 · Lapangan · Pembina: Galih Ramadhan. Dasar permainan, kebugaran, dan kerja sama tim.', 'Grades 7–9 · Tuesday 3:00–4:30 p.m. · Court · Mentor: Galih Ramadhan. Game fundamentals, fitness, and teamwork.'],
                ['club-08', 'text', 'Klub Baca', 'Reading Club', 'Kelas VII–IX · Rabu 15.00–16.30 · Perpustakaan · Pembina: Rani Puspita. Memilih buku, bertukar rekomendasi, dan berdiskusi.', 'Grades 7–9 · Wednesday 3:00–4:30 p.m. · Library · Mentor: Rani Puspita. Choose books, exchange recommendations, and discuss them.'],
            ],
            'school-life': [
                ['schedule-01', 'text', '07.00–07.20', '7:00–7:20 a.m.', 'Kedatangan dan pertemuan wali kelas.', 'Arrival and homeroom.'],
                ['schedule-02', 'text', '07.20–09.40', '7:20–9:40 a.m.', 'Pelajaran pagi dan diskusi kelas.', 'Morning lessons and classroom discussion.'],
                ['schedule-03', 'text', '09.40–10.00', '9:40–10:00 a.m.', 'Istirahat dan waktu bersama teman.', 'Break and time with friends.'],
                ['schedule-04', 'text', '10.00–12.00', '10:00 a.m.–12:00 p.m.', 'Pelajaran, praktik, atau kerja kelompok.', 'Lessons, practical work, or group projects.'],
                ['schedule-05', 'text', '12.00–13.00', '12:00–1:00 p.m.', 'Istirahat, makan siang, dan ibadah.', 'Lunch break and time for worship.'],
                ['schedule-06', 'text', '13.00–16.30', '1:00–4:30 p.m.', 'Pelajaran siang, dilanjutkan kegiatan pilihan pada hari klub.', 'Afternoon lessons, followed by optional activities on club days.'],
            ],
            'school-activities': [
                ['timeline-01', 'text', 'Juli · Orientasi siswa baru', 'July · New student orientation', 'Kelas VII mengenal wali kelas, teman, ruang belajar, dan kebiasaan sekolah melalui tur serta permainan kelompok.', 'Grade 7 students meet homeroom teachers and classmates and learn about school spaces and routines through a tour and group activities.'],
                ['timeline-02', 'text', 'Agustus · Proyek lingkungan', 'August · Environmental project', 'Kelas VIII mengamati penggunaan air atau kondisi kebun, mencatat temuan, dan menyampaikan usulan perbaikan.', 'Grade 8 students observe water use or garden conditions, record findings, and propose improvements.'],
                ['timeline-03', 'text', 'September · Pekan literasi', 'September · Literacy week', 'Kelas VII–IX bertukar rekomendasi buku, membaca nyaring, dan menulis ulasan untuk teman.', 'Grades 7–9 exchange book recommendations, read aloud, and write reviews for classmates.'],
                ['timeline-04', 'text', 'Oktober · Hari olahraga', 'October · Sports day', 'Tim lintas kelas mengikuti permainan beregu sambil melatih kerja sama dan sportivitas.', 'Mixed-class teams play group games while practicing teamwork and sportsmanship.'],
                ['timeline-05', 'text', 'Akhir semester · Panggung karya', 'End of semester · Student showcase', 'Kelas VII–IX mempresentasikan proses proyek, karya seni, dan hasil latihan kepada keluarga serta teman.', 'Grades 7–9 present project processes, artwork, and practice outcomes to families and classmates.'],
            ],
            'school-immersion': [
                ['timeline-01', 'text', 'Hari 1 · Mengenal tempat dan tuan rumah', 'Day 1 · Getting to know the place and hosts', 'Siswa kelas VIII tiba bersama guru, bertemu pendamping komunitas, mengenal aturan kunjungan, dan mencatat pertanyaan awal.', 'Grade 8 students arrive with teachers, meet community hosts, learn visitor guidelines, and record their first questions.'],
                ['timeline-02', 'text', 'Hari 2 · Belajar melalui kegiatan bersama', 'Day 2 · Learning through shared activities', 'Dalam kelompok kecil, siswa mengamati kegiatan warga dan mengikuti lokakarya yang dipandu tuan rumah. Malam hari digunakan untuk menulis jurnal dan berbagi temuan bersama guru.', 'In small groups, students observe community activities and join a host-led workshop. In the evening they write journals and share observations with teachers.'],
                ['timeline-03', 'text', 'Hari 3 · Merangkum dan berpamitan', 'Day 3 · Reflecting and saying goodbye', 'Siswa menyiapkan rangkuman singkat untuk tuan rumah, membereskan perlengkapan, lalu kembali bersama rombongan. Refleksi proyek dilanjutkan di sekolah.', 'Students prepare a short reflection for their hosts, pack their belongings, and return with the group. Project reflection continues at school.'],
                ['checklist-01', 'text', 'Persetujuan dan informasi keluarga', 'Consent and family information', 'Orang tua atau wali menerima agenda dan mengisi persetujuan serta informasi kesehatan dan kontak darurat sebelum keberangkatan.', 'Parents or guardians receive the itinerary and provide consent, health information, and emergency contacts before departure.'],
                ['checklist-02', 'text', 'Perlengkapan pribadi', 'Personal packing list', 'Bawa pakaian secukupnya, perlengkapan mandi, botol minum, topi, alat tulis, dan obat pribadi sesuai kebutuhan yang telah disampaikan kepada guru.', 'Bring suitable clothing, toiletries, a water bottle, hat, writing supplies, and any personal medication discussed with the teacher.'],
                ['checklist-03', 'text', 'Pendampingan selama kegiatan', 'Support during the visit', 'Guru mendampingi kelompok, memeriksa kehadiran, dan menjadi penghubung keluarga serta tuan rumah. Rincian pendamping dan kontak dibagikan sebelum kegiatan.', 'Teachers accompany groups, check attendance, and connect families with hosts. Supervision details and contacts are shared before the visit.'],
            ],
            'school-admin-info': [
                ['service-01', 'text', 'Surat keterangan siswa', 'Student certificate', 'Ajukan melalui tata usaha dengan identitas siswa dan tujuan surat. Contoh waktu penyelesaian: tiga hari kerja.', 'Submit the student’s details and purpose to the school office. Example turnaround: three working days.'],
                ['service-02', 'text', 'Salinan dokumen akademik', 'Academic document copies', 'Sertakan identitas siswa, jenis dokumen, dan tahun ajaran. Contoh waktu penyelesaian: lima hari kerja.', 'Provide the student’s details, document type, and academic year. Example turnaround: five working days.'],
                ['service-03', 'text', 'Pembaruan data keluarga', 'Update family information', 'Sampaikan perubahan kontak atau data wali beserta dokumen pendukung kepada tata usaha. Contoh waktu verifikasi: dua hari kerja.', 'Provide the school office with updated contacts or guardian details and supporting documents. Example verification time: two working days.'],
                ['service-04', 'text', 'Pertemuan dengan wali kelas', 'Meet the homeroom teacher', 'Sampaikan nama siswa, pokok pembicaraan, dan waktu yang diinginkan kepada tata usaha untuk pengaturan jadwal.', 'Provide the student’s name, discussion topic, and preferred time to the office to arrange an appointment.'],
                ['calendar-01', 'text', 'Juli', 'July', 'Awal tahun ajaran dan orientasi siswa.', 'Start of the academic year and student orientation.'],
                ['calendar-02', 'text', 'September & Maret', 'September & March', 'Penilaian tengah semester dan pertemuan perkembangan siswa.', 'Mid-semester assessments and student progress meetings.'],
                ['calendar-03', 'text', 'Desember', 'December', 'Penilaian akhir semester ganjil dan pembagian rapor.', 'First semester assessments and report distribution.'],
                ['calendar-04', 'text', 'Juni', 'June', 'Penilaian akhir tahun dan pembagian rapor.', 'End-of-year assessments and report distribution.'],
            ],
        };
        for (const [id, entries] of Object.entries(structured)) {
            const record = institutionContent.find(x => x.id === id)!;
            if (id === 'school-admissions') record.draft.blocks = record.draft.blocks.filter(block => !['school-admissions-2', 'school-admissions-3'].includes(block.id));
            if (id === 'school-admin-info') record.draft.blocks = record.draft.blocks.filter(block => !['school-admin-info-1', 'school-admin-info-2'].includes(block.id));
            if (id === 'school-admissions-test' || id === 'school-admissions-achievement') record.draft.blocks = record.draft.blocks.filter(block => ![`${id}-1`, `${id}-3`].includes(block.id));
            record.draft.blocks.push(...entries.map(([blockId, type, headingId, headingEn, bodyId, bodyEn, image]) => ({ id: blockId, type, heading: bi(headingId, headingEn), body: bi(bodyId, bodyEn), ...(image ? { image } : {}) })));
            record.published!.blocks = structuredClone(record.draft.blocks);
        }
        const stories: [string, string, string, string, string, string, string][] = [
            ['school-water-project', 'Siswa meneliti jejak air di sekolah', 'Students trace water use at school', 'Kelompok kelas VIII mencatat penggunaan air selama sepekan, membandingkan temuan, lalu mempresentasikan usulan penghematan kepada teman sekelas.', 'Grade 8 groups tracked water use for a week, compared findings, and presented conservation ideas to classmates.', 'news', '/images/institution/science.jpg'],
            ['school-reading-week', 'Pekan membaca mempertemukan cerita dan pembaca', 'Reading week brings stories and readers together', 'Siswa bertukar rekomendasi buku, membaca nyaring, dan membuat ulasan singkat dalam pekan literasi contoh sekolah.', 'Students exchanged book recommendations, read aloud, and wrote short reviews during the school’s sample literacy week.', 'news', '/images/institution/classroom.jpg'],
            ['school-art-stage', 'Karya siswa memenuhi panggung seni', 'Student work takes the arts stage', 'Pameran dan pertunjukan akhir semester memberi kesempatan klub musik, tari, dan seni rupa menunjukkan proses latihan mereka.', 'An end-of-semester exhibition and performance gave music, dance, and visual arts clubs a chance to share their practice.', 'news', '/images/institution/students.jpg'],
            ['school-community-garden', 'Merawat kebun, mencatat perubahan', 'Caring for a garden and recording change', 'Siswa membagi tugas merawat kebun kelas dan mencatat pertumbuhan tanaman sebagai bagian dari proyek lingkungan.', 'Students shared responsibility for a class garden and recorded plant growth as part of an environmental project.', 'news', '/images/institution/science.jpg'],
            ['school-debate', 'Tim debat berlatih mendengar sebelum menjawab', 'Debate team practices listening before responding', 'Dalam latihan persahabatan, siswa menyusun argumen, menanggapi pendapat berbeda, dan saling memberi masukan.', 'In a friendly practice, students built arguments, responded to different perspectives, and gave one another feedback.', 'news', '/images/institution/classroom.jpg'],
            ['school-sports-day', 'Sehari bergerak bersama di lapangan', 'A day of movement on the field', 'Kegiatan olahraga antarkelas mempertemukan permainan beregu dan tantangan gerak yang dapat diikuti seluruh siswa.', 'An interclass sports day combined team games and movement challenges open to every student.', 'news', '/images/institution/students.jpg'],
            ['school-robotics-award', 'Tim robotika meraih penghargaan proyek kreatif', 'Robotics team earns creative project recognition', 'Tim merancang alat penyiram sederhana dan memaparkan proses pengujiannya pada pameran pelajar.', 'The team designed a simple watering device and presented its testing process at a student showcase.', 'achievement', '/images/institution/science.jpg'],
            ['school-music-award', 'Ansambel sekolah tampil di festival pelajar', 'School ensemble performs at a student festival', 'Persiapan ansambel berlangsung dari latihan rutin hingga berbagi panggung dengan kelompok sekolah lain.', 'The ensemble prepared from regular rehearsals to sharing a stage with other school groups.', 'achievement', '/images/institution/students.jpg'],
            ['school-writing-award', 'Cerita pendek siswa mendapat apresiasi juri', 'Student short story receives jury recognition', 'Karya seorang siswa kelas IX mendapat apresiasi dalam pameran literasi pelajar setelah melalui beberapa putaran penyuntingan.', 'A grade 9 student’s short story received recognition at a student literacy showcase after several rounds of editing.', 'achievement', '/images/institution/lesson.jpg'],
        ];
        const storyDetails: Record<string, [string, string, string, string][]> = {
            'school-water-project': [
                ['Mengukur penggunaan air', 'Measuring water use', 'Pada 18 Agustus 2026, siswa kelas VIII membagi tugas untuk mencatat penggunaan air di keran kelas dan taman selama lima hari sekolah. Mereka membandingkan catatan harian dengan pembacaan meter bersama guru IPA.', 'On August 18, 2026, grade 8 students divided into teams to record water use at classroom and garden taps over five school days. They compared daily observations with meter readings alongside their science teacher.'],
                ['Dari catatan menjadi usulan', 'From observations to ideas', 'Setiap kelompok membuat tabel, mencari waktu pemakaian tertinggi, lalu memeriksa kebiasaan yang mungkin menjelaskannya. Siswa mengusulkan pemeriksaan keran dan jadwal penyiraman yang lebih teratur.', 'Each group made a table, identified peak usage, and examined habits that might explain it. Students proposed checking taps and creating a more regular watering schedule.'],
                ['Membaca data dengan hati-hati', 'Reading data carefully', 'Dalam presentasi kelas, siswa menyadari bahwa perbedaan jumlah pengguna juga memengaruhi hasil. Mereka sepakat mengulang pengamatan sebelum menarik kesimpulan tentang penghematan.', 'During presentations, students realized that differences in the number of users also affected the results. They agreed to repeat their observations before drawing conclusions about savings.'],
            ],
            'school-reading-week': [
                ['Buku berpindah tangan', 'Books change hands', 'Pekan membaca pada 7–11 September 2026 dimulai dengan pertukaran buku antarkelas VII. Setiap siswa membawa rekomendasi dan menjelaskan alasan memilihnya kepada teman dalam kelompok kecil.', 'Reading week on September 7–11, 2026 began with a book exchange among grade 7 classes. Each student brought a recommendation and explained the choice to a small group.'],
                ['Membaca dan menanggapi', 'Reading and responding', 'Di perpustakaan, siswa membaca nyaring bagian favorit, lalu menulis ulasan pendek tentang tokoh atau gagasan yang menarik perhatian. Ulasan dipajang di dekat rak agar dapat dibaca pengunjung lain.', 'In the library, students read favorite passages aloud, then wrote short reviews about a character or idea that caught their attention. Reviews were displayed by the shelves for other readers.'],
                ['Pilihan bacaan berikutnya', 'The next reading choice', 'Pada akhir pekan, pustakawan mengumpulkan judul yang paling banyak direkomendasikan untuk diskusi klub baca berikutnya. Siswa juga berbagi cara memilih buku yang belum pernah mereka coba.', 'At the end of the week, the librarian gathered the most recommended titles for the next reading club discussion. Students also shared how they chose books outside their usual interests.'],
            ],
            'school-art-stage': [
                ['Persiapan di tiga ruang', 'Preparing in three spaces', 'Menjelang pentas 30 Oktober 2026, klub musik berlatih ansambel, anggota tari menyusun gerak, dan siswa seni rupa menyiapkan karya untuk foyer. Panitia siswa mengatur urutan tampil dan kebutuhan panggung.', 'Ahead of the October 30, 2026 performance, the music club rehearsed an ensemble, dancers developed choreography, and art students prepared work for the foyer. A student committee organized the running order and stage needs.'],
                ['Karya yang dibagikan', 'Work shared with the community', 'Keluarga diajak melihat sketsa dan catatan proses sebelum pertunjukan dimulai. Di panggung, kelompok kelas VII–IX bergantian menampilkan musik dan tari yang telah mereka latih selama satu semester.', 'Families were invited to see sketches and process notes before the show. On stage, grade 7–9 groups took turns presenting music and dance they had practiced throughout the semester.'],
                ['Belajar dari balik panggung', 'Lessons backstage', 'Setelah acara, panitia meninjau pergantian penampil dan pembagian tugas. Mereka mencatat perlunya waktu pemeriksaan suara yang lebih panjang untuk kegiatan berikutnya.', 'Afterward, the committee reviewed transitions and responsibilities. They noted that the next event would need more time for sound checks.'],
            ],
            'school-community-garden': [
                ['Menanam dan mencatat', 'Planting and observing', 'Pada 14 Juli 2026, siswa kelas VII menyiapkan petak kecil untuk menanam kangkung dan cabai. Kelompok bergiliran menyiram, membersihkan area, dan mengukur pertumbuhan setiap pekan.', 'On July 14, 2026, grade 7 students prepared small plots for water spinach and chilies. Groups took turns watering, caring for the area, and measuring growth each week.'],
                ['Membandingkan kondisi', 'Comparing conditions', 'Catatan kelompok memuat tinggi tanaman, cuaca, dan kondisi tanah. Di kelas IPA, siswa membandingkan dua petak yang menerima cahaya berbeda dan membahas faktor lain yang mungkin berpengaruh.', 'Group notes included plant height, weather, and soil condition. In science class, students compared two plots with different light exposure and discussed other factors that might matter.'],
                ['Merawat sebagai tim', 'Caring as a team', 'Ketika beberapa tanaman layu setelah akhir pekan, siswa meninjau jadwal penyiraman dan menambahkan pemeriksaan tanah sebelum menyiram. Hasil catatan disimpan sebagai acuan bagi angkatan berikutnya.', 'When some plants wilted after a weekend, students reviewed their watering rota and added a soil check before watering. Their notes were kept for the next cohort.'],
            ],
            'school-debate': [
                ['Menyusun argumen bersama', 'Building arguments together', 'Pada 2 Oktober 2026, klub debat kelas VIII dan IX membahas penggunaan gawai saat jam istirahat. Setiap tim menyiapkan pendapat, alasan, dan pertanyaan untuk tim lain sebelum latihan dimulai.', 'On October 2, 2026, the grade 8 and 9 debate club discussed device use during breaks. Each team prepared a position, reasons, and questions for the other team before practice.'],
                ['Mendengar dan merespons', 'Listening and responding', 'Pembicara bergantian menyampaikan argumen dalam batas waktu. Anggota yang tidak tampil mencatat tanggapan yang menjawab pertanyaan lawan secara langsung dan bagian yang masih memerlukan penjelasan.', 'Speakers took turns presenting within a time limit. Members who were not speaking noted responses that addressed the other team’s questions directly and points needing clarification.'],
                ['Catatan untuk latihan berikutnya', 'Notes for the next practice', 'Pembina mengajak siswa membedakan pendapat dan bukti. Kedua tim sepakat mengumpulkan sudut pandang teman sekelas sebelum mengangkat topik tersebut kembali.', 'The coach helped students distinguish opinion from evidence. Both teams agreed to collect classmates’ perspectives before revisiting the topic.'],
            ],
            'school-sports-day': [
                ['Bergerak lintas kelas', 'Moving across classes', 'Hari olahraga pada 23 Oktober 2026 mempertemukan siswa kelas VII–IX dalam permainan estafet, basket, dan tantangan koordinasi. Tim dibentuk lintas kelas agar siswa bertemu teman baru.', 'Sports day on October 23, 2026 brought grades 7–9 together for relays, basketball, and coordination challenges. Mixed-class teams helped students meet new friends.'],
                ['Peran di dalam dan luar lapangan', 'Roles on and off the field', 'Selain bermain, siswa membantu mencatat skor, menyiapkan perlengkapan, dan memandu perpindahan kelompok. Guru olahraga menyesuaikan aturan beberapa permainan agar lebih banyak siswa dapat ikut.', 'Alongside playing, students recorded scores, prepared equipment, and guided groups between activities. Physical education teachers adapted several rules so more students could participate.'],
                ['Menutup hari bersama', 'Closing the day together', 'Setiap tim memilih satu momen kerja sama untuk diceritakan saat penutupan. Panitia mencatat kebutuhan tempat istirahat dan air minum yang lebih mudah dijangkau pada acara berikutnya.', 'Each team shared a moment of cooperation at the closing gathering. Organizers noted the need for more accessible rest and drinking-water stations next time.'],
            ],
            'school-robotics-award': [
                ['Berangkat dari kebun sekolah', 'Starting in the school garden', 'Tim robotika kelas VIII menerima penghargaan proyek kreatif pada pameran pelajar 12 September 2026. Ide alat penyiram muncul saat anggota tim mengamati jadwal perawatan tanaman di kebun sekolah.', 'The grade 8 robotics team received creative project recognition at a student showcase on September 12, 2026. The watering-device idea came from observing the school garden’s care schedule.'],
                ['Membuat dan menguji purwarupa', 'Building and testing a prototype', 'Tim merakit sensor kelembapan, pompa kecil, dan wadah air, lalu mencoba alat pada beberapa kondisi tanah. Mereka mencatat kapan pompa menyala dan menyesuaikan ambang sensor setelah pengujian awal.', 'The team assembled a moisture sensor, small pump, and water container, then tested the device with different soil conditions. They recorded when the pump started and adjusted the sensor threshold after initial tests.'],
                ['Menerima masukan pengunjung', 'Learning from visitor feedback', 'Di pameran, siswa menjelaskan cara kerja purwarupa dan keterbatasannya. Pertanyaan pengunjung tentang daya dan ketahanan alat menjadi daftar perbaikan untuk sesi klub berikutnya.', 'At the showcase, students explained the prototype and its limitations. Visitor questions about power and durability became a list of improvements for the next club session.'],
            ],
            'school-music-award': [
                ['Menuju panggung festival', 'Preparing for the festival stage', 'Ansambel siswa kelas VII–IX tampil pada festival pelajar 15 Agustus 2026. Kelompok memilih aransemen bersama pembina dan membagi bagian melodi, irama, serta pengiring sesuai instrumen.', 'The grade 7–9 student ensemble performed at a student festival on August 15, 2026. With their coach, members chose an arrangement and divided melody, rhythm, and accompaniment parts by instrument.'],
                ['Latihan sebagai ansambel', 'Rehearsing as an ensemble', 'Latihan mingguan dimulai dari kelompok instrumen kecil sebelum seluruh pemain bergabung. Siswa merekam satu sesi untuk mendengarkan keseimbangan suara dan menandai bagian yang perlu dilatih ulang.', 'Weekly rehearsals began in small instrument groups before the full ensemble joined. Students recorded a session to listen to balance and identify passages that needed more practice.'],
                ['Setelah penampilan', 'After the performance', 'Usai tampil, anggota mendiskusikan cara memberi aba-aba dan menjaga tempo ketika gugup. Mereka membawa catatan itu ke persiapan pentas sekolah berikutnya.', 'After performing, members discussed giving cues and maintaining tempo when nervous. They brought those notes into preparation for the next school performance.'],
            ],
        };
        storyDetails['school-writing-award'] = [
            ['Cerita dari perjalanan sehari-hari', 'A story from an everyday journey', 'Pada pameran literasi pelajar 5 September 2026, cerita pendek karya siswa kelas IX mendapat apresiasi juri. Cerita tersebut berangkat dari pengamatan perjalanan seorang anak menuju sekolah.', 'At a student literacy showcase on September 5, 2026, a grade 9 student’s short story received jury recognition. The story grew from observations of a child’s journey to school.'],
            ['Menulis ulang dan meminta tanggapan', 'Rewriting and seeking feedback', 'Penulis membuat kerangka tokoh dan latar, lalu membacakan draf kepada kelompok jurnalistik. Masukan tentang urutan peristiwa dan dialog digunakan untuk menyunting naskah sebelum dikirim.', 'The writer outlined the characters and setting, then read a draft to the journalism group. Feedback on the sequence of events and dialogue informed revisions before submission.'],
            ['Berbagi proses dengan teman', 'Sharing the process with classmates', 'Sepulang dari pameran, penulis memperlihatkan perubahan antara draf awal dan akhir kepada teman sekelas. Diskusi berfokus pada bagaimana tanggapan pembaca membantu memperjelas cerita.', 'After the showcase, the writer showed classmates the changes between the first and final drafts. The discussion focused on how reader feedback helped make the story clearer.'],
        ];
        for (const [id, titleId, titleEn, bodyId, bodyEn, kind, image] of stories) {
            const story = make(id, 'announcements', bi(titleId, titleEn), bi(bodyId, bodyEn), image, { kind });
            story.draft.blocks = storyDetails[id].map(([headingId, headingEn, detailId, detailEn], i) => ({ id: `${id}-${i + 1}`, type: 'text', heading: bi(headingId, headingEn), body: bi(detailId, detailEn) }));
            story.published!.blocks = structuredClone(story.draft.blocks);
            institutionContent.push(story);
        }
        const publicationDates: Record<string, string> = {
            'school-water-project': '2026-08-25', 'school-reading-week': '2026-09-11', 'school-art-stage': '2026-10-30',
            'school-community-garden': '2026-07-28', 'school-debate': '2026-10-02', 'school-sports-day': '2026-10-23',
            'school-robotics-award': '2026-09-12', 'school-music-award': '2026-08-15', 'school-writing-award': '2026-09-05',
            'school-projects': '2026-08-04', 'school-collaboration': '2026-09-18', 'school-clubs': '2026-07-21',
            'school-calendar': '2026-07-01', 'school-showcase': '2026-10-09',
        };
        for (const [id, date] of Object.entries(publicationDates)) {
            const record = institutionContent.find(x => x.id === id)!;
            record.draft.attributes.date = date;
            record.published!.attributes.date = date;
        }
        const originalStories: Record<string, [string, string, string, string][]> = {
            'school-projects': [
                ['Pertanyaan dari sekitar sekolah', 'Questions from around school', 'Pada awal Agustus 2026, kelas VIII memilih persoalan yang dapat diamati di lingkungan sekolah. Satu kelompok meneliti kondisi tanah di kebun, sementara kelompok lain mengamati penggunaan air.', 'In early August 2026, grade 8 classes chose questions they could investigate around school. One group studied soil in the garden while another observed water use.'],
                ['Mengamati dan menguji', 'Observing and testing', 'Setiap kelompok menyusun pertanyaan, mencatat hasil pengamatan, dan mendiskusikan cara menguji dugaan bersama guru IPA. Hasil sementara disajikan dalam tabel dan gambar.', 'Each group developed a question, recorded observations, and discussed how to test an idea with the science teacher. Preliminary findings were presented in tables and drawings.'],
                ['Berbagi hasil', 'Sharing findings', 'Pada 4 Agustus, siswa mempresentasikan rencana percobaan dan menerima pertanyaan dari kelas lain. Mereka menggunakan masukan itu untuk memperjelas langkah pengamatan berikutnya.', 'On August 4, students presented experiment plans and answered questions from another class. They used that feedback to clarify the next observation steps.'],
            ],
            'school-collaboration': [
                ['Menyusun majalah kelas', 'Making a class magazine', 'Pada 18 September 2026, siswa kelas VII menyusun majalah bertema tempat yang berarti bagi mereka. Kelompok memilih narasumber, membagi peran penulis dan ilustrator, lalu membuat jadwal pengerjaan.', 'On September 18, 2026, grade 7 students created a magazine about places meaningful to them. Groups chose interview subjects, assigned writing and illustration roles, and planned their work.'],
                ['Mendengar sebelum menulis', 'Listening before writing', 'Siswa berlatih membuat pertanyaan terbuka dan memeriksa kembali catatan wawancara. Guru Bahasa Indonesia membantu mereka memilih kutipan yang sesuai dan menyunting tulisan agar mudah diikuti.', 'Students practiced open-ended questions and checked interview notes. Their Indonesian teacher helped them choose suitable quotations and edit their writing for clarity.'],
                ['Membaca karya teman', 'Reading one another’s work', 'Setiap kelompok membacakan satu halaman dan menerima tanggapan mengenai urutan cerita serta tampilan. Hasilnya disimpan di perpustakaan kelas untuk dibaca bersama.', 'Each group read a page aloud and received feedback on story order and presentation. The finished magazines were kept in the classroom library for everyone to read.'],
            ],
            'school-showcase': [
                ['Panggung untuk proses belajar', 'A stage for the learning process', 'Pada 9 Oktober 2026, siswa kelas VII–IX memamerkan proyek semester kepada keluarga dan teman. Di setiap meja, pengunjung dapat melihat rancangan awal, catatan percobaan, serta karya yang sudah diperbaiki.', 'On October 9, 2026, grades 7–9 shared semester projects with families and classmates. At each table, visitors could see early sketches, experiment notes, and revised work.'],
                ['Siswa menjelaskan pilihan', 'Students explain their choices', 'Kelompok bergantian memperkenalkan pertanyaan proyek, cara membagi tugas, dan perubahan yang dibuat setelah mendapat masukan. Pengunjung menuliskan pertanyaan pada kartu untuk dibahas di kelas.', 'Groups took turns explaining their project questions, how they shared tasks, and changes made after feedback. Visitors wrote questions on cards for later classroom discussion.'],
                ['Refleksi setelah pameran', 'Reflection after the showcase', 'Pada pertemuan berikutnya, siswa memilih satu pertanyaan pengunjung yang membantu mereka melihat proyek dari sudut pandang baru dan mencatat apa yang ingin mereka kembangkan.', 'At the next meeting, students chose one visitor question that offered a new perspective and noted what they wanted to develop further.'],
            ],
            'school-clubs': [
                ['Pekan mencoba klub', 'Club trial week', 'Pada 21 Juli 2026, siswa kelas VII berkenalan dengan pilihan ekstrakurikuler melalui sesi perkenalan singkat. Pengurus siswa dan pembina menjelaskan kegiatan serta menjawab pertanyaan.', 'On July 21, 2026, grade 7 students explored extracurricular choices in short introductory sessions. Student representatives and mentors explained activities and answered questions.'],
                ['Dari robotika hingga musik', 'From robotics to music', 'Siswa mencoba tantangan merakit sederhana di meja robotika, melihat contoh majalah jurnalistik, dan mengikuti latihan ritme bersama ansambel musik. Klub olahraga dan seni juga membuka sesi perkenalan.', 'Students tried a simple building challenge at the robotics table, saw journalism magazine examples, and joined a rhythm exercise with the music ensemble. Sports and art clubs also offered introductory sessions.'],
                ['Memilih kegiatan', 'Choosing an activity', 'Setelah mencoba, siswa mencatat minat dan memeriksa jadwal bersama keluarga. Pembina membantu memilih kegiatan yang sesuai dengan waktu belajar dan komitmen lain.', 'After trying activities, students noted their interests and reviewed schedules with their families. Mentors helped them choose an activity that fit their study time and other commitments.'],
            ],
            'school-calendar': [
                ['Awal tahun ajaran', 'Beginning the academic year', 'Kalender contoh dibuka dengan orientasi dan awal pembelajaran pada Juli. Keluarga menerima jadwal kelas, informasi kegiatan, serta waktu pertemuan dengan wali kelas.', 'The example calendar begins with orientation and classes in July. Families receive class schedules, activity information, and homeroom meeting times.'],
                ['Penilaian dan laporan belajar', 'Assessments and progress reports', 'Penilaian tengah semester direncanakan pada September dan Maret; penilaian akhir semester pada Desember dan Juni. Rapor dibagikan setelah penilaian akhir semester.', 'Mid-semester assessments are planned for September and March, with end-of-semester assessments in December and June. Reports are shared after end-of-semester assessments.'],
                ['Mengikuti pembaruan', 'Following updates', 'Tanggal kegiatan terperinci disampaikan melalui layanan tata usaha dan kalender keluarga. Jadwal ini merupakan contoh untuk demo sekolah dan bukan kalender sekolah nyata.', 'Detailed activity dates are shared through the school office and family calendar. This schedule is an example for the demo, not a real school calendar.'],
            ],
        };
        for (const [id, entries] of Object.entries(originalStories)) {
            const record = institutionContent.find(x => x.id === id)!;
            record.draft.blocks = entries.map(([headingId, headingEn, bodyId, bodyEn], i) => ({ id: `${id}-${i + 1}`, type: 'text', heading: bi(headingId, headingEn), body: bi(bodyId, bodyEn) }));
            record.published!.blocks = structuredClone(record.draft.blocks);
        }
    }
    if (demo && preset === 'institution') {
        if (brand.heroImage) home.draft.image = home.published!.image = brand.heroImage;
        for (const [id, image] of [['school-activities', brand.images.activities], ['school-extracurricular', brand.images.extracurricular], ['school-immersion', brand.images.immersion]] as const) {
            const record = institutionContent.find(item => item.id === id)!;
            if (image) record.draft.image = record.published!.image = image;
        }
        if (brand.name) {
            for (const record of [home, ...institutionContent]) for (const data of [record.draft, record.published!]) {
                for (const field of [data.title, data.summary, data.body, data.seoTitle, data.seoDescription, ...data.blocks.flatMap(block => [block.heading, block.body])]) {
                    for (const lang of ['id', 'en'] as const) field[lang] = field[lang].replaceAll('SMP Nusa Cendekia', brand.name);
                }
            }
        }
        if (brand.address || brand.email) {
            const contact = institutionContent.find(item => item.id === 'school-contact')!;
            const address = brand.address || 'Jalan Cakrawala No. 18, Kota Arunika';
            const email = brand.email || 'halo@nusacendekia.example';
            contact.draft.blocks = [
                { id: 'contact-address', type: 'text', heading: bi('Kunjungi kampus', 'Visit the campus'), body: bi(address, address) },
                { id: 'contact-email', type: 'text', heading: bi('Hubungi tata usaha', 'Contact the school office'), body: bi(email, email) },
            ];
            contact.published!.blocks = structuredClone(contact.draft.blocks);
        }
    }
    const programSeeds = !demo && preset === 'institution' ? [] : p.programs;
    const programs = programSeeds.map((x, i) => ({ id: x.id, contentId: x.id, type: preset, subject: x.subject, format: x.format as 'online' | 'onsite' | 'hybrid', duration: x.duration, tutorIds: [i % 2 === 0 ? 'tutor-ayu' : 'tutor-raka'] }));
    const cohorts = programSeeds.map((x, i) => ({ id: `${x.id}-nov`, programId: x.id, branchId: 'main', name: preset === 'institution' ? 'Penerimaan 2027' : `Batch ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(at(35 + i)))}`, capacity: x.capacity, opensAt: at(-30), closesAt: at(30), startsAt: at(35 + i), endsAt: at(110 + i), tuitionIdr: x.tuitionIdr, registrationIdr: x.registrationIdr, requiresApproval: true, requiresPayment: true }));
    if (!demo && preset === 'institution') {
        home.draft.image = brand.heroImage;
        home.draft.title = bi(brand.name || config.brandName, brand.name || config.brandName);
        home.draft.summary = bi('', '');
        home.draft.body = bi('', '');
        home.draft.seoTitle = structuredClone(home.draft.title);
        home.draft.seoDescription = bi('', '');
        home.draft.blocks = [];
        home.published = structuredClone(home.draft);
        const starterPages: [string, string, string, string][] = [
            ['school-profile', 'Profil sekolah', 'School profile', ''],
            ['school-vision', 'Visi dan misi', 'Vision and mission', ''],
            ['school-contact', 'Hubungi sekolah', 'Contact the school', ''],
            ['school-admissions', 'Penerimaan siswa baru', 'Admissions', ''],
            ['school-admissions-test', 'Jalur tes', 'Test pathway', ''],
            ['school-admissions-achievement', 'Jalur prestasi', 'Achievement pathway', ''],
            ['school-life', 'Kehidupan di sekolah', 'School life', ''],
            ['school-activities', 'Kegiatan sekolah', 'School activities', brand.images.activities],
            ['school-extracurricular', 'Ekstrakurikuler', 'Extracurricular activities', brand.images.extracurricular],
            ['school-immersion', 'Immersion', 'Immersion', brand.images.immersion],
            ['school-admin-info', 'Informasi dan layanan sekolah', 'School information and services', ''],
        ];
        for (const [id, titleId, titleEn, image] of starterPages) institutionContent.push(make(id, 'pages', bi(titleId, titleEn), bi('', ''), image));
    }
    if (preset === 'institution') {
        home.draft.blocks = [
            { id: 'welcome', type: 'text', heading: bi('Setiap hari adalah kesempatan untuk menemukan hal baru.', 'Every day is a chance to discover something new.'), body: bi('Belajar menjadi kesempatan untuk bertanya, mencoba, dan mengenal dunia bersama.', 'Learning is a chance to ask questions, try things, and discover the world together.') },
            { id: 'journey', type: 'text', heading: bi('Belajar, berkarya, dan berteman.', 'Learn, create, and find your people.'), body: bi('Kenali kegiatan belajar dan ruang untuk mencoba minat baru.', 'Explore learning activities and opportunities to try something new.') },
            { id: 'information', type: 'text', heading: bi('Informasi untuk keluarga sekolah', 'Information for school families'), body: bi('Temukan informasi sekolah dan penerimaan siswa baru.', 'Find school information and admissions details.') },
            { id: 'news', type: 'text', heading: bi('Ada banyak cerita di sekolah kita.', 'There are stories to share.'), body: bi('Ikuti kabar dan kegiatan sekolah.', 'Follow school news and activities.') },
            { id: 'achievement', type: 'text', heading: bi('Cerita di balik setiap karya', 'The story behind every creation'), body: bi('Jelajahi karya dan pengalaman siswa.', 'Explore students’ work and experiences.') },
            { id: 'immersion', type: 'text', heading: bi('Belajar dari pengalaman baru', 'Learning through new experiences'), body: bi('Kenali kegiatan belajar di luar keseharian.', 'Explore learning experiences beyond the everyday.') },
            { id: 'activities', type: 'text', heading: bi('Banyak cara untuk menemukan minat.', 'Many ways to discover what you love.'), body: bi('Jelajahi kegiatan dan pilihan belajar di sekolah.', 'Explore activities and learning opportunities at school.') },
            { id: 'invitation', type: 'text', heading: bi('Mari kenali sekolah lebih dekat.', 'Get to know our school.'), body: bi('Temukan informasi penerimaan dan langkah berikutnya.', 'Explore admissions information and next steps.') },
        ];
        home.published!.blocks = structuredClone(home.draft.blocks);
    }
    const institutionTeachers = [
        ['tutor-ayu', 'Ayu Prameswari', 'Kepala sekolah', 'Principal', 'Memimpin pengembangan sekolah dan mendampingi kolaborasi guru serta keluarga.', 'Leads school development and supports collaboration between teachers and families.'],
        ['tutor-raka', 'Raka Wicaksana', 'Wakil kepala sekolah bidang kurikulum', 'Vice principal for curriculum', 'Mengembangkan perencanaan pembelajaran dan mendampingi refleksi guru.', 'Develops learning plans and supports teacher reflection.'],
        ['tutor-nadia', 'Nadia Larasati', 'Wakil kepala sekolah bidang kesiswaan', 'Vice principal for student affairs', 'Mendampingi kegiatan siswa, kepemimpinan, dan kesejahteraan di sekolah.', 'Supports student activities, leadership, and wellbeing at school.'],
        ['tutor-bima', 'Bima Adiputra', 'Wakil kepala sekolah bidang sarana', 'Vice principal for facilities', 'Mengelola ruang dan fasilitas agar mendukung kegiatan belajar sehari-hari.', 'Coordinates spaces and facilities that support daily learning.'],
        ['tutor-rani', 'Rani Puspita', 'Bahasa Indonesia', 'Indonesian language', 'Mengajak siswa membaca kritis dan menemukan suara melalui tulisan.', 'Invites students to read critically and find their voice through writing.'],
        ['tutor-dimas', 'Dimas Pratama', 'Matematika', 'Mathematics', 'Membimbing siswa menjelaskan strategi dan mencoba berbagai cara memecahkan masalah.', 'Guides students to explain strategies and try different ways to solve problems.'],
        ['tutor-saras', 'Saras Wulandari', 'Ilmu pengetahuan alam', 'Science', 'Menghubungkan konsep sains dengan pengamatan dan percobaan sederhana.', 'Connects science concepts with observation and hands-on experiments.'],
        ['tutor-fajar', 'Fajar Nugroho', 'Ilmu pengetahuan sosial', 'Social studies', 'Mengajak siswa membaca peta, menelaah sumber, dan memahami masyarakat.', 'Helps students read maps, examine sources, and understand communities.'],
        ['tutor-maya', 'Maya Kirana', 'Bahasa Inggris', 'English', 'Membangun keberanian berkomunikasi melalui cerita, percakapan, dan presentasi.', 'Builds communication confidence through stories, conversation, and presentations.'],
        ['tutor-putri', 'Putri Maharani', 'Pendidikan Pancasila', 'Civics', 'Mengajak siswa mendiskusikan tanggung jawab dan keputusan dalam kehidupan bersama.', 'Engages students in discussing responsibility and decisions in community life.'],
        ['tutor-ardi', 'Ardi Setiawan', 'Informatika', 'Computing', 'Mendampingi siswa mengembangkan logika, keamanan digital, dan karya sederhana.', 'Guides students in computational thinking, digital safety, and making projects.'],
        ['tutor-intan', 'Intan Kusuma', 'Seni rupa', 'Visual arts', 'Membuka ruang eksplorasi bahan, sketsa, dan gagasan visual siswa.', 'Creates space for students to explore materials, sketches, and visual ideas.'],
        ['tutor-galih', 'Galih Ramadhan', 'Pendidikan jasmani', 'Physical education', 'Membimbing kebugaran, kerja sama tim, dan sportivitas melalui permainan.', 'Teaches fitness, teamwork, and sportsmanship through games.'],
        ['tutor-laras', 'Laras Sekar', 'Musik', 'Music', 'Mendampingi siswa mendengarkan, berlatih, dan tampil bersama dalam ansambel.', 'Guides students in listening, practicing, and performing together in an ensemble.'],
        ['tutor-dewi', 'Dewi Anggraini', 'Bimbingan dan konseling', 'Counseling', 'Mendampingi siswa mengenali kebutuhan dan mencari dukungan saat menghadapi tantangan.', 'Helps students identify their needs and find support when facing challenges.'],
        ['tutor-eko', 'Eko Saputra', 'Pendidikan agama', 'Religious education', 'Membimbing refleksi nilai dan sikap saling menghormati dalam keseharian.', 'Encourages reflection on values and mutual respect in daily life.'],
        ['tutor-nisa', 'Nisa Rahma', 'Bahasa Inggris', 'English', 'Mengajak siswa berlatih bahasa melalui proyek dan percakapan sehari-hari.', 'Helps students practice language through projects and everyday conversation.'],
        ['tutor-bayu', 'Bayu Mahendra', 'Matematika', 'Mathematics', 'Menggunakan model dan contoh sehari-hari untuk membantu siswa memahami konsep.', 'Uses models and everyday examples to help students understand concepts.'],
    ].map(([id, name, roleId, roleEn, bioId, bioEn]) => ({ id, name, specialty: bi(roleId, roleEn), bio: bi(`${bioId}`, `${bioEn}`), image: photo.teacher }));
    return { schemaVersion: 1, institution: { name: preset === 'institution' ? (brand.name || (demo ? demoInstitutionName : config.brandName)) : demo ? p.name : config.brandName, description: !demo && preset === 'institution' ? bi('', '') : p.intro, address: demo && preset === 'institution' ? (brand.address || 'Jalan Cakrawala No. 18, Kota Arunika') : demo ? 'Ruang belajar contoh, Jawa Barat' : preset === 'institution' ? brand.address : '', email: demo && preset === 'institution' ? (brand.email || 'halo@nusacendekia.example') : demo ? 'hello@example.test' : preset === 'institution' ? brand.email : '', whatsapp: config.whatsapp, timezone: 'Asia/Jakarta', navigation: preset === 'institution' ? [{ label: bi('Tentang', 'About'), page: 'school-profile' }, { label: bi('Penerimaan', 'Admissions'), page: 'school-admissions' }, { label: bi('Kehidupan sekolah', 'School life'), page: 'school-life' }, { label: bi('Pendidik', 'Educators'), page: 'school-teachers' }, { label: bi('Berita', 'News'), page: 'news' }, { label: bi('Informasi', 'Information'), page: 'school-admin-info' }] : [{ label: bi('Program', 'Programs'), page: 'programs' }, { label: bi('Pengajar', 'Teachers'), page: 'teachers' }, { label: bi('Jadwal', 'Schedules'), page: 'schedule' }, { label: bi('Tentang', 'About'), page: 'about' }] }, branches: [{ id: 'main', name: 'Kampus utama', address: preset === 'institution' ? (brand.address || (demo ? 'Jalan Cakrawala No. 18, Kota Arunika' : '')) : 'Alamat contoh, bukan lokasi nyata' }], programs, courses: programSeeds.map(x => ({ id: `course-${x.id}`, programId: x.id, title: x.title, outcomes: [x.body, bi('Menerapkan materi dalam latihan terarah', 'Apply concepts through guided practice')] })), cohorts,
        sessions: cohorts.flatMap((c, i) => [0, 1, 2].map(n => ({ id: `session-${i}-${n}`, cohortId: c.id, tutorId: i % 2 === 0 ? 'tutor-ayu' : 'tutor-raka', title: bi(`Pertemuan ${n + 1}: ${programSeeds[i].title.id}`, `Session ${n + 1}: ${programSeeds[i].title.en}`), startsAt: at(35 + i + n * 7), endsAt: at(35 + i + n * 7, 11), location: i === 2 ? 'Kelas daring / Online classroom' : 'Studio 1' }))),
        tutors: preset === 'institution' && !demo ? [] : demo && preset === 'institution' ? institutionTeachers : [{ id: 'tutor-ayu', name: 'Ayu Prameswari', bio: bi('Pengajar fiktif. Membantu peserta memahami konsep lewat diskusi dan latihan.', 'Fictional teacher. Helps learners understand concepts through discussion and practice.'), specialty: bi(preset === 'language' ? 'English & percakapan' : 'Konsep & praktik', preset === 'language' ? 'English & conversation' : 'Concepts & practice'), image: photo.teacher }, { id: 'tutor-raka', name: 'Raka Wicaksana', bio: bi('Pengajar fiktif. Memimpin kelas kecil dan memberi umpan balik pada proses belajar.', 'Fictional teacher. Leads small classes and gives feedback on learning.'), specialty: bi('Kelas & lokakarya', 'Classes & workshops'), image: photo.workshop }],
        users: demo ? [{ id: 'admin', name: 'Nadia · Demo', email: 'admin@example.test', role: 'admin', studentIds: [] }, { id: 'staff', name: 'Dian · Demo', email: 'staff@example.test', role: 'staff', studentIds: [] }, { id: 'editor', name: 'Editor · Demo', email: 'editor@example.test', role: 'editor', studentIds: [] }, { id: 'tutor', name: 'Ayu · Demo', email: 'tutor@example.test', role: 'tutor', studentIds: [], tutorId: 'tutor-ayu' }, { id: 'student', name: 'Sinta · Demo', email: 'student@example.test', role: 'student', studentIds: ['student-sinta'] }, { id: 'guardian', name: 'Wali · Demo', email: 'guardian@example.test', role: 'guardian', studentIds: ['student-sinta'] }, { id: 'other', name: 'Peserta lain · Demo', email: 'other@example.test', role: 'student', studentIds: ['student-other'] }] : [],
        students: demo ? [{ id: 'student-sinta', name: 'Sinta · Peserta fiktif', email: 'student@example.test' }, { id: 'student-other', name: 'Peserta lain · Fiktif', email: 'other@example.test' }] : [],
        enrollments: demo ? [{ id: 'application-sample', studentId: 'student-other', cohortId: cohorts[0].id, status: 'submitted', answers: {}, createdAt: at(-1), updatedAt: at(-1), version: 1 }] : [], events: demo ? [{ id: 'event-sample', enrollmentId: 'application-sample', status: 'submitted', at: at(-1), by: 'other', note: 'Sample application' }] : [], invoices: [], payments: [], attendance: [], progress: [],
        materials: cohorts.map(c => ({ id: `material-${c.id}`, cohortId: c.id, title: bi('Persiapan pertemuan pertama', 'Prepare for your first session'), description: bi('Catatan belajar dan latihan awal.', 'Study notes and introductory exercises.'), sampleText: 'Sample learning resource\n\n1. List your learning goals.\n2. Review the program outline.\n3. Bring one question to the first session.\n\nReplace with your own teaching material.' })), media: [],
        content: [home, ...institutionContent, ...programSeeds.map(x => make(x.id, 'programs', x.title, x.body, x.image, { ...p.attributes, kind: x.kind })), ...(preset === 'institution' ? [] : [make('admissions', 'announcements', bi('Pendaftaran kelas berikutnya', 'Next intake applications'), bi('Lihat jadwal dan persyaratan sebelum mengajukan pendaftaran.', 'Check schedules and requirements before applying.'), photo.library)])],
        modules: { ...config.modules }, registrationFields: [...p.fields, ...config.registrationFields] as SchoolState['registrationFields'], outbox: [], idempotency: {} };
}
