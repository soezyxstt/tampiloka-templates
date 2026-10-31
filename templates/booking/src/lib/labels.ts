import type { Layout, Level } from "../domain/model";
export const layoutLabels: Record<Layout, [string, string]> = {
  "appointment-first": ["Janji utama", "Appointment first"],
  editorial: ["Editorial", "Editorial"],
  "service-market": ["Daftar layanan", "Service market"],
  "minimal-professional": ["Profesional minimal", "Minimal professional"],
};
export const levelLabels: Record<Level, [string, string]> = {
  catalog: ["Katalog", "Catalog"],
  whatsapp: ["WhatsApp", "WhatsApp"],
  booking: ["Pemesanan", "Booking"],
  full: ["Lengkap", "Full"],
};

export const statusLabels: Record<string, [string, string]> = {
  requested: ["Permintaan", "Requested"],
  pending_confirmation: ["Menunggu konfirmasi", "Pending confirmation"],
  awaiting_payment: ["Menunggu pembayaran", "Awaiting payment"],
  confirmed: ["Terkonfirmasi", "Confirmed"],
  checked_in: ["Sudah hadir", "Checked in"],
  completed: ["Selesai", "Completed"],
  cancelled: ["Dibatalkan", "Cancelled"],
  expired: ["Kedaluwarsa", "Expired"],
  no_show: ["Tidak hadir", "No-show"],
  not_required: ["Gratis", "Free"],
  unpaid: ["Belum dibayar", "Unpaid"],
  pending: ["Menunggu", "Pending"],
  partial: ["Uang muka diterima", "Deposit received"],
  paid: ["Lunas", "Paid"],
  failed: ["Percobaan gagal", "Attempt failed"],
  refund_due: ["Perlu pengembalian", "Refund due"],
  refunded: ["Dana kembali", "Refunded"],
  created: ["Disiapkan", "Prepared"],
  starting: ["Diproses", "Starting"],
  refund_pending: ["Pengembalian diproses", "Refund pending"],
};
export const eventLabels: Record<string, [string, string]> = {
  created: ["Janji dibuat", "Appointment created"],
  cancelled: ["Janji dibatalkan", "Appointment cancelled"],
  rescheduled: ["Jadwal berubah", "Appointment rescheduled"],
  staff_confirmed: ["Staf mengonfirmasi", "Staff confirmed"],
  staff_note: ["Catatan staf", "Staff note"],
  checked_in: ["Kehadiran tercatat", "Checked in"],
  completed: ["Janji selesai", "Appointment completed"],
  no_show: ["Tidak hadir", "No-show"],
  expired: ["Reservasi berakhir", "Reservation expired"],
  payment_started: ["Pembayaran disiapkan", "Payment prepared"],
  payment_pending: ["Pembayaran menunggu", "Payment pending"],
  payment_attempt_failed: [
    "Percobaan pembayaran gagal",
    "Payment attempt failed",
  ],
  payment_verified: ["Pembayaran terverifikasi", "Payment verified"],
  payment_expired: ["Pembayaran berakhir", "Payment expired"],
  late_payment_refund_due: [
    "Pembayaran terlambat, perlu pengembalian",
    "Late payment, refund due",
  ],
  location_payment_recorded: [
    "Pembayaran di lokasi tercatat",
    "On-site payment recorded",
  ],
  refund_requested: ["Pengembalian diajukan", "Refund requested"],
  refund_verified: ["Pengembalian terverifikasi", "Refund verified"],
};
