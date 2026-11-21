import type { DemoTourContent, DemoTourStep } from '@tampiloka/ui-core/demo';
import { isModuleEnabled as enabled } from './config';

export function customerTour(tableEntry: boolean): DemoTourContent['steps'] {
  const steps: [DemoTourStep, ...DemoTourStep[]] = [
    [['Lihat menu', 'Browse the menu'], ['Pilih kategori, lalu buka hidangan untuk melihat pilihan dan harganya.', 'Pick a category, then open a dish to see its options and price.']],
  ];
  if (tableEntry) steps.unshift(
    [['Mulai dari meja', 'Start at a table'], ['Pilih meja untuk mencoba layanan meja, atau pilih Lihat menu untuk langsung menjelajah.', 'Choose a table to try table service, or select View menu to browse.']],
  );
  steps.push(enabled('ordering')
    ? [['Coba pesan', 'Try ordering'], ['Tambahkan hidangan ke keranjang, lalu periksa pesanan sebelum dikirim.', 'Add a dish to your cart, then review the order before sending it.']]
    : [['Pesan lewat staf', 'Order with staff'], ['Setelah memilih hidangan, sampaikan pesanan ke staf di kasir.', 'Once you’ve chosen a dish, place your order with staff at the counter.']]);
  return steps;
}

export function staffTour(role: string): DemoTourContent['steps'] {
  const steps: DemoTourStep[] = [];
  if (role === 'OWNER' || role === 'MANAGER') {
    if (enabled('dashboard') || enabled('cashier')) steps.push(
      [['Cek kegiatan kafe', 'Review cafe activity'], ['Buka bagian laporan atau shift kasir untuk melihat ringkasan kegiatan.', 'Open the reports or cashier shifts section to review activity.']],
    );
    if (enabled('catalog') || enabled('cashier')) steps.push(
      [['Cek menu dan stok', 'Review the menu and stock'], ['Buka Katalog & Stok untuk melihat hidangan yang tersedia.', 'Open Catalogue & stock to see which dishes are available.']],
    );
    steps.push([['Lihat pengaturan', 'Review settings'], ['Buka Pengaturan untuk melihat opsi yang aktif pada mode ini.', 'Open Settings to see the options available in this mode.']]);
  } else {
    if (role === 'WAITER' && enabled('tables')) steps.push(
      [['Layani meja', 'Help guests at tables'], ['Buka Meja & Antrean untuk melihat meja yang aktif dan permintaan pelanggan.', 'Open Tables & waitlist to see active tables and guest requests.']],
    );
    if ((role === 'BAR' || role === 'KITCHEN') && enabled('kitchen')) steps.push(
      [['Siapkan pesanan', 'Prepare orders'], ['Buka Dapur & Bar. Gunakan filter Stasiun saya untuk melihat tugas di bagian ini.', 'Open Kitchen & bar. Use My station to see tickets for your station.']],
      [['Tandai siap', 'Mark items ready'], ['Perbarui status pesanan saat mulai dibuat dan saat siap disajikan.', 'Update the order status when preparation starts and when the item is ready.']],
    );
    if (role === 'CASHIER') {
      if (enabled('ordering')) steps.push(
        [['Cek pesanan masuk', 'Review incoming orders'], ['Buka bagian pesanan untuk melihat pesanan pelanggan yang masuk.', 'Open the orders section to see incoming customer orders.']],
      );
      if (enabled('cashier')) steps.push(
        [['Buka tagihan', 'Open a bill'], ['Di Kasir, pilih Tagihan untuk melihat rincian pesanan dan mencoba mencatat pembayaran.', 'In Cashier & orders, choose Bills to review an order and try recording a payment.']],
      );
    }
  }

  return steps.length > 0
    ? [steps[0], ...steps.slice(1)]
    : [[['Lihat tugas yang tersedia', 'See available tasks'], ['Buka salah satu menu ruang staf untuk melihat tugas yang tersedia bagi peran ini.', 'Open a staff workspace section to see the tasks available to this role.']]];
}
