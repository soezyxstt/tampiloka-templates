/** Reproducible actors and expected amounts for the customer/staff browser journeys.
 * Every case uses a new browser profile; no fixture writes reach a network API.
 * The public scenario loader supplies the additional problem-state fixtures.
 */
export const LIFECYCLE_FIXTURES = Object.freeze({
  prepay: {
    name: 'Rani Uji Prabayar', partySize: 2, tableId: 'tbl_m06',
    itemId: 'item_teh_melati', addonId: 'item_croissant', policy: 'PREPAY',
    partialPaymentIdr: 10000, partialTenderIdr: 20000,
  },
  payLater: {
    name: 'Dimas Uji Pascabayar', partySize: 2, tableId: 'tbl_m06',
    itemId: 'item_teh_melati', policy: 'PAY_LATER',
  },
  takeaway: {
    name: 'Sari Uji Bawa Pulang', policy: 'PAY_LATER',
    itemIds: ['item_teh_melati', 'item_croissant'], discountIdr: 5000,
  },
  rejected: { name: 'Bima Uji Penolakan', tableId: 'tbl_m06', itemId: 'item_teh_melati' },
  exceptionReason: 'Tamu meninggalkan kafe sebelum melunasi tagihan; dicatat manajer untuk tindak lanjut.',
  cancellationReason: 'Menu tidak jadi disajikan atas permintaan tamu; pembayaran dikembalikan.',
});

export const LIFECYCLE_CASES = Object.freeze([
  { id: 'prepay-addon-close', title: 'Prabayar, QR batal/lunas, tambah pesanan, tunai sebagian, penyajian, pulang dan bersih' },
  { id: 'paylater-close', title: 'Bayar belakangan: dapur berjalan sebelum lunas, kepulangan menunggu pembayaran' },
  { id: 'takeaway-close', title: 'Pesanan kasir bawa pulang, diskon, pembayaran, pengambilan dan penutupan' },
  { id: 'reject-request', title: 'Staf menolak permintaan, pelanggan melihat alasan, kunjungan kosong dapat ditutup' },
  { id: 'cancel-refund', title: 'Pembatalan item yang telah dibayar mengembalikan stok dan uang sekali' },
  { id: 'deferred-refund', title: 'Pengembalian tertunda memblokir penutupan sampai uang benar-benar dikembalikan' },
  { id: 'split-merge', title: 'Pisah dan gabung mempertahankan total serta status tagihan pesanan pelanggan' },
  { id: 'exception-departure', title: 'Kepulangan bermasalah membutuhkan alasan dan mempertahankan piutang' },
  { id: 'external-counter', title: 'Paket kasir eksternal: konfirmasi struk, penyajian sederhana, dan kunjungan selesai' },
  { id: 'waitlist-customer-staff', title: 'Antrean pelanggan, pemanggilan staf, meja ditahan, duduk, dan status pribadi tersimpan' },
  { id: 'scenario-picker', title: 'Semua data contoh skenario dapat dimuat ulang dengan keadaan yang sesuai' },
]);
