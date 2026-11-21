import type { DemoTourContent, DemoTourStep, DemoTourText } from '@tampiloka/ui-core/demo';
import type { Bootstrap, Role } from '../domain/model';

const roles: Record<Role, DemoTourText> = {
  customer: ['Pelanggan', 'Customer'],
  owner: ['Pemilik', 'Owner'],
  operations: ['Operasional', 'Operations'],
  viewer: ['Pembaca', 'Viewer'],
};

export function bookingTour(data: Bootstrap, role: Role, language: 'id' | 'en'): DemoTourContent {
  const { booking, whatsapp } = data.capabilities;
  const steps: [DemoTourStep, ...DemoTourStep[]] = role === 'customer'
    ? [[['Pilih layanan', 'Choose a service'], ['Buka layanan untuk melihat harga dan durasinya.', 'Open a service to see its price and duration.'], ".b-nav-services", ".b-mobile-menu"]]
    : role === 'owner'
      ? [[['Atur layanan', 'Manage services'], ['Buka Layanan & harga untuk melihat dan mengubah layanan contoh.', 'Open Services & pricing to review and edit sample services.'], ".b-staff-link-content"]]
      : [[['Lihat tim dan jadwal', 'Review the team and schedule'], ['Buka Tim & jadwal untuk melihat petugas dan jam praktik atau layanan.', 'Open Team & schedules to see staff and their working hours.'], ".b-staff-link-resources"]];

  if (booking) steps.push(role === 'customer'
    ? [['Coba buat janji', 'Try booking an appointment'], ['Pilih waktu yang tersedia, lalu isi data contoh untuk menyelesaikan pemesanan.', 'Choose an available time, then enter sample details to complete the booking.'], ".b-service-book", ".b-nav-appointments", ".b-mobile-menu"]
    : role === 'viewer'
      ? [['Pantau jadwal janji', 'Monitor appointments'], ['Buka Kalender atau Daftar janji untuk melihat waktu dan status tiap janji.', 'Open Calendar or Appointments to review appointment times and statuses.'], ".b-staff-link-calendar", ".b-staff-link-bookings"]
      : [['Tangani janji', 'Manage appointments'], ['Buka Daftar janji, lalu pilih satu janji untuk melihat status dan tindakan yang tersedia.', 'Open Appointments, then select one to see its status and available actions.'], ".b-staff-link-bookings"]);
  else if (role === 'customer' && whatsapp) steps.push(
    [['Siapkan pesan WhatsApp', 'Prepare a WhatsApp message'], ['Pilih layanan dan isi formulir dengan data contoh, lalu salin pesan dari pratinjau.', 'Choose a service and fill out the form with sample details, then copy the message from the preview.'], ".b-service-book", ".b-nav-services", ".b-mobile-menu"],
  );

  return { id: `${role}:${data.config.level}`, language, role: roles[role], steps };
}
