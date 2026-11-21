import type { DemoTourContent, DemoTourStep, DemoTourText } from '@tampiloka/ui-core/demo';
import type { Locale, Role, Snapshot } from './domain/types';

const roles: Record<Role, DemoTourText> = {
  visitor: ['Pengunjung', 'Visitor'],
  student: ['Siswa', 'Student'],
  guardian: ['Wali', 'Guardian'],
  tutor: ['Tutor', 'Tutor'],
  admin: ['Administrator', 'Administrator'],
  staff: ['Staf operasional', 'Operations staff'],
  editor: ['Editor konten', 'Content editor'],
};

const firstSteps: Record<Role, DemoTourStep> = {
  visitor: [['Jelajahi sekolah atau kursus', 'Explore the school or course'], ['Buka menu situs untuk melihat informasi lembaga dan pilihan belajar.', 'Use the site navigation to learn about the institution and explore learning options.'], ".site-nav .desktop-nav a", ".site-nav .mobile-menu"],
  student: [['Cek pendaftaran', 'Check your application'], ['Buka Portal siswa untuk melihat status pengajuan dan kelas contoh.', 'Open the Student portal to check application status and sample classes.'], "[data-demo-target=school-applications]", "[data-demo-target=school-portal]"],
  guardian: [['Pantau pendaftaran siswa', 'Track the learner’s application'], ['Buka portal untuk melihat status pengajuan siswa yang terhubung dengan akun wali.', 'Open the portal to see application status for learners linked to the guardian account.'], "[data-demo-target=school-applications]", "[data-demo-target=school-portal]"],
  tutor: [['Lihat agenda mengajar', 'Review your teaching schedule'], ['Buka Ringkasan untuk melihat kegiatan belajar yang ditangani.', 'Open Overview to see the learning activities assigned to you.'], "[data-demo-target=school-overview]"],
  admin: [['Lihat ringkasan', 'Review the overview'], ['Buka Ringkasan untuk melihat kegiatan lembaga, lalu buka Akun & akses untuk meninjau peran akun contoh.', 'Open Overview to see institution activity, then open Accounts & access to review sample account roles.'], "[data-demo-target=school-overview]"],
  staff: [['Cek program dan jadwal', 'Review programs and schedules'], ['Buka Program untuk melihat pilihan belajar, lalu cek jadwalnya di Jadwal.', 'Open Programs to see learning options, then check their dates in Schedule.'], "[data-demo-target=school-programs]"],
  editor: [['Pilih konten', 'Choose content'], ['Buka Konten, lalu pilih halaman atau pengumuman yang ingin dilihat.', 'Open Content, then choose a page or announcement to review.'], "[data-demo-target=school-content]"],
};

export function schoolTour({ capabilities, level }: Snapshot, role: Role, language: Locale): DemoTourContent {
  const steps: [DemoTourStep, ...DemoTourStep[]] = [firstSteps[role]];
  if (role === 'visitor' && capabilities.includes('enrollment')) steps.push(
    [['Coba daftar', 'Try applying'], ['Pilih program dan kelas, lalu isi formulir dengan data contoh.', 'Choose a program and class, then fill out the form with sample details.'], "a.action-link[href*=\"daftar\"]", ".action-link", "[data-demo-target=school-portal]", ".site-nav .mobile-menu"],
  );
  if ((role === 'student' || role === 'guardian') && capabilities.includes('portal')) steps.push(
    [['Lihat kegiatan belajar', 'Review learning activity'], ['Di portal, lihat jadwal dan catatan belajar yang tersedia untuk akun ini.', 'In the portal, check the schedule and learning records available to this account.'], ".progress-panel h2", "[data-demo-target=school-portal]"],
  );
  if (role === 'tutor' && capabilities.includes('attendance')) steps.push(
    [['Coba catat kehadiran', 'Try recording attendance'], ['Buka Kehadiran & materi, lalu pilih sesi untuk melihat daftar siswa.', 'Open Attendance & resources, then choose a session to see its learners.'], "[data-demo-target=school-academic]"],
  );
  if ((role === 'admin' || role === 'staff') && capabilities.includes('applications')) steps.push(
    [['Tinjau pendaftaran', 'Review applications'], ['Buka Pengajuan untuk melihat rincian dan status pendaftaran contoh.', 'Open Applications to see sample application details and statuses.'], "[data-demo-target=school-enrollments]"],
  );
  if (role === 'editor') steps.push(
    [['Tinjau draf', 'Preview a draft'], ['Edit draf contoh dan lihat pratinjau sebelum menerbitkannya di demo.', 'Edit a sample draft and preview it before publishing in the demo.'], ".workspace-view h1", "[data-demo-target=school-content]"],
  );
  return { id: `${role}:${level}`, language, role: roles[role], steps };
}
