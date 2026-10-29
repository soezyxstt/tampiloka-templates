import type { OrderStatus, PaymentStatus, ReturnStatus } from '../shared/contracts';
export const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
export const dateTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const shortDate = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
export const orderLabels: Record<OrderStatus, string> = { awaiting_payment: 'Menunggu pembayaran', confirmed: 'Siap diproses', processing: 'Sedang disiapkan', shipped: 'Dalam pengiriman', completed: 'Selesai', cancelled: 'Dibatalkan' };
export const paymentLabels: Record<PaymentStatus, string> = { unpaid: 'Belum dibayar', pending: 'Menunggu pembayaran', pending_verification: 'Perlu dicek', paid: 'Lunas', failed: 'Pembayaran gagal', refund_due: 'Perlu pengembalian dana', refunded: 'Dana dikembalikan' };
export const returnLabels: Record<ReturnStatus, string> = { none: '', requested: 'Retur diajukan', approved: 'Retur disetujui', rejected: 'Retur ditolak', received: 'Barang retur diterima', refunded: 'Dana dikembalikan' };
export const levelLabels = { catalog: 'Katalog', whatsapp: 'Keranjang + WhatsApp', store: 'Toko', advanced: 'Toko lengkap' };
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(row => row.map(value => { const text = String(value); return `"${/^[=+@\-]/.test(text) ? "'" : ''}${text.replaceAll('"', '""')}"`; }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
