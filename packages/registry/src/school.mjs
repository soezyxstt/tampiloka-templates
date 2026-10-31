export const schoolLevels=Object.freeze({
 profile:{name:'Profil',description:'Profil, program, pengajar, jadwal, dan editor konten.',capabilities:['content']},
 whatsapp:{name:'WhatsApp',description:'Pilihan program dan ringkasan pertanyaan WhatsApp, tanpa konfirmasi pendaftaran.',capabilities:['content','inquiry']},
 enrollment:{name:'Pendaftaran',description:'Pengajuan, kapasitas, tinjauan staf, daftar tunggu, dan riwayat pribadi.',capabilities:['content','inquiry','enrollment','applications','records']},
 full:{name:'Lengkap',description:'Pendaftaran, tagihan, pembayaran, portal, kehadiran, materi, dan catatan belajar.',capabilities:['content','inquiry','enrollment','applications','records','finance','portal','attendance','materials','progress','reports']},
});
export const schoolPresets=Object.freeze({
 'exam-prep':{name:'Bimbel & persiapan ujian',description:'Mata pelajaran, kelas intensif/reguler, dan target ujian.',layout:'academic-editorial',palette:'cobalt',typography:'editorial',url:'https://school.tampiloka.site/?layout=academic-editorial&preset=exam-prep&theme=cobalt&typography=editorial&level=full&view=visitor&lang=en'},
 language:{name:'Kursus bahasa',description:'Bahasa, tingkat kemampuan, konsultasi penempatan, dan batch.',layout:'contemporary-learning',palette:'forest',typography:'modern',url:'https://school.tampiloka.site/?layout=course-discovery&preset=language&theme=forest&typography=modern&level=full&view=visitor&lang=en'},
 skills:{name:'Pelatihan keahlian',description:'Hasil belajar, prasyarat, proyek, dan lokakarya.',layout:'course-discovery',palette:'neutral',typography:'modern',url:'https://school.tampiloka.site/?layout=contemporary-learning&preset=skills&theme=neutral&typography=editorial&level=full&view=visitor&lang=en'},
 institution:{name:'Sekolah',description:'Program akademik, penerimaan, kalender, pengumuman, dan fasilitas.',layout:'institutional',palette:'burgundy',typography:'editorial',url:'https://school.tampiloka.site/?layout=institutional&preset=institution&theme=burgundy&typography=modern&level=full&view=visitor&lang=en'},
});
export const schoolLayouts=Object.freeze(['academic-editorial','course-discovery','contemporary-learning','institutional']);
export const schoolPalettes=Object.freeze(['cobalt','forest','neutral','burgundy']);
export const schoolTypography=Object.freeze(['editorial','modern','humanist']);
export const schoolModuleIds=Object.freeze(['progress-reports','additional-branches','notifications']);
export function schoolModulesFor(level,features='none'){
 if(!Object.hasOwn(schoolLevels,level))throw new Error('Level school tidak dikenal.');
 if(typeof features!=='string')throw new Error('Fitur school harus berupa teks.');
 const values=features==='all'?[...schoolModuleIds]:features==='none'||features===''?[]:features.split(',').map(x=>x.trim());
 if(values.some(x=>!schoolModuleIds.includes(x))||new Set(values).size!==values.length)throw new Error('Modul school tidak dikenal atau berulang.');
 if(values.includes('progress-reports')&&level!=='full')throw new Error('progress-reports membutuhkan full.');
 if(values.includes('notifications')&&!['enrollment','full'].includes(level))throw new Error('notifications membutuhkan enrollment atau full.');
 return Object.fromEntries(schoolModuleIds.map(id=>[id,values.includes(id)]));
}
export const schoolTemplate=Object.freeze({id:'school',name:'School & learning center',description:'Profil lembaga, pendaftaran, dan operasional pusat belajar.',status:'available',directory:'templates/school',presets:schoolPresets,levels:schoolLevels,defaultPreset:'exam-prep',defaultLevel:'profile',demoUrl:'https://school.tampiloka.site'});
