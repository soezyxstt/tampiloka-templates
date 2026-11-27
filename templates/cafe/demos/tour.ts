import type { DemoActionStep, DemoTourText } from '@tampiloka/ui-core/demo';
import { isModuleEnabled as enabled } from './config';

type Steps = [DemoActionStep, ...DemoActionStep[]];
type StepOptions = Omit<DemoActionStep, 'title' | 'instruction' | 'target'>;
const target = (name: string) => `[data-demo-target="${name}"]`;
const choice = (name: string) => `#staff-content [data-choice="${name}"]`;
const section = (name: string) => `[data-cafe-section="${name}"]`;
const onSection = (name: string) => `[data-active-section="${name}"]`;
const paid = '[data-demo-payment-state="SETTLED"]';
const staffBillPaid = '[data-demo-bill-paid]';
const fulfilled = '[data-demo-fulfillment="complete"]';

const step = (title: DemoTourText, instruction: DemoTourText, selector: string, options?: StepOptions): DemoActionStep =>
  ({ title, instruction, target: selector, ...options });
const action = (name: string, title: DemoTourText, instruction: DemoTourText, options?: StepOptions) =>
  step(title, instruction, target(name), options);

const requiredChoice = {
  selector: 'div[data-demo-tour-prompt],fieldset[data-demo-tour-prompt],#pos-variant[data-demo-tour-prompt]',
  instruction: ['Pilih dari opsi yang disorot.', 'Select from the highlighted options.'],
} as const;

export function tableEntryTour(onOpenTable: (target: HTMLElement) => void): Steps {
  return [step(
    ['Mulai dari meja', 'Start at a table'],
    ['Pilih meja yang tersedia, lalu klik Buka menu meja. Jika semua meja terisi, buka menu untuk mencoba bawa pulang.', 'Choose an available table, then select Open table menu. If all tables are occupied, open the menu to try takeaway.'],
    '.demo-entry-open, [data-demo-target="customer-browse-menu"]',
    { onNavigate: onOpenTable },
  )];
}

export function customerTour(tableRoute: boolean, staffHref: string): Steps {
  const order = enabled('ordering');
  const staffLink = { href: staffHref, label: ['Buka staf di tab baru', 'Open staff in a new tab'] } as const;
  const steps: Steps = [
    step(['Buka menu', 'Open the menu'], ['Pilih Menu pada navigasi pelanggan.', 'Select Menu in the customer navigation.'],
      '[data-demo-screen="menu"]', { skipWhen: '[data-demo-screen="menu"][aria-current="page"]' }),
  ];
  if (order && !tableRoute) steps.push(
    action('customer-service', ['Pilih layanan', 'Choose service'], ['Buka pilihan meja dan layanan di bagian atas menu.', 'Open the table and service picker at the top of the menu.']),
    step(['Pilih bawa pulang', 'Choose takeaway'], ['Klik Bawa pulang untuk memesan tanpa kode meja.', 'Select Takeaway to order without a table code.'], '[data-choice="TAKEAWAY"]'),
    action('customer-service-save', ['Simpan layanan', 'Save service'], ['Klik Simpan pilihan untuk kembali ke menu.', 'Select Save selection to return to the menu.']),
  );
  steps.push(step(
    ['Pilih hidangan', 'Choose a dish'],
    [order ? 'Klik nama hidangan yang tersedia untuk melihat varian dan pilihan tambahan.' : 'Klik nama hidangan untuk melihat rinciannya. Sampaikan pilihan Anda kepada staf.', order ? 'Select an available dish to see its sizes and extras.' : 'Select a dish to see its details. Give your choices to staff.'],
    order ? `${target('cafe-dish')}[data-orderable]` : target('cafe-dish'),
  ));
  if (!order) return steps;
  steps.push(
    action('customer-add', ['Tambahkan ke keranjang', 'Add to cart'], ['Klik Tambah ke keranjang untuk menyimpan pilihan Anda.', 'Select Add to cart to save your choices.'], { result: 'customer-add', prerequisite: requiredChoice }),
    action('customer-cart', ['Buka keranjang', 'Open the cart'], ['Klik Lihat keranjang untuk mengecek item dan jumlahnya.', 'Select View cart to check the items and quantities.']),
    action('customer-review', ['Periksa pesanan', 'Review the order'], ['Klik Pesan untuk melihat total akhir.', 'Select Order to see the final total.'], {
      result: 'customer-review',
      prerequisite: {
        selector: '[data-demo-tour-prompt]',
        instruction: ['Isi nama pemesan terlebih dahulu (minimal 2 karakter).', 'Enter your name first (at least 2 characters).'],
      },
    }),
    action('customer-submit', ['Kirim pesanan', 'Submit the order'], ['Cek total, lalu klik Kirim pesanan.', 'Check the total, then select Submit order.'], { result: 'customer-submit' }),
    action('customer-order-bill', ['Buka tagihan pesanan', 'Open the order bill'], ['Klik tombol tagihan pada pesanan yang baru dikirim. Jika masih menunggu konfirmasi, terima pesanan dengan nama Anda sebagai kasir di tab staf, lalu kembali ke sini.', 'Select the bill on the order you placed. If it is awaiting confirmation, accept the order under your name as cashier in the staff tab, then return here.'], { link: staffLink }),
  );
  if (enabled('payments')) steps.push(
    action('customer-create-payment', ['Buat instruksi pembayaran', 'Create payment instructions'], ['Pilih QRIS atau transfer bank, lalu klik tombol untuk membuat instruksi demo.', 'Choose QRIS or bank transfer, then select the button to create demo instructions.'], { result: 'customer-create-payment', skipWhen: paid, recordFrom: target('customer-pending-payment') }),
    action('demo-options', ['Buka simulasi pembayaran', 'Open payment simulation'], ['Klik Opsi demo pada toolbar untuk mencoba pembayaran tanpa uang sungguhan.', 'Select Demo options in the toolbar to try payment without real money.'], { skipWhen: paid }),
    action('demo-settle', ['Simulasikan pembayaran', 'Simulate payment'], ['Di bagian Pembayaran, klik Simulasikan lunas pada tagihan atas nama Anda.', 'Under Payments, select Simulate paid on the bill in your name.'], { result: 'demo-settle', sameRecord: true, skipWhen: paid }),
    action('demo-options-close', ['Kembali ke tagihan', 'Return to the bill'], ['Tutup Opsi demo untuk melihat status tagihan.', 'Close Demo options to see the bill status.'], { skipWhen: paid }),
  );
  steps.push(
    step(['Periksa struk digital', 'Check the digital receipt'], enabled('payments')
      ? ['Struk muncul setelah tagihan demo lunas.', 'The receipt appears once the demo bill is paid.']
      : ['Di tab staf, catat pembayaran di kasir atas nama Anda. Struk muncul di sini setelah tagihan lunas.', 'In the staff tab, record the counter payment for the bill in your name. The receipt appears here once paid.'],
      target('customer-receipt'), { waitFor: `${paid} ${target('customer-receipt')}`, ...(!enabled('payments') && { link: staffLink }) }),
    step(['Lacak pesanan', 'Track the order'], ['Klik Pesanan di navigasi bawah untuk melihat status penyajian.', 'Select Orders in the bottom navigation to see the serving status.'], '[data-demo-screen="pesanan"]'),
    step(['Tunggu pesanan disajikan', 'Wait for the order to be served'], enabled('kitchen')
      ? ['Di tab staf, pilih identitas Dapur atau Bar sesuai hidangan. Mulai siapkan, tandai siap, lalu tandai disajikan atau diambil. Kembali ke sini untuk melihat hasilnya.', 'In the staff tab, choose Kitchen or Bar for your dish. Start preparing it, mark it ready, then mark it served or collected. Return here to see the result.']
      : ['Di tab staf, buka Pesanan masuk dan tandai pesanan Anda disajikan atau diambil. Kembali ke sini untuk melihat hasilnya.', 'In the staff tab, open Incoming orders and mark your order served or collected. Return here to see the result.'],
      '[data-demo-fulfillment]', { waitFor: fulfilled, link: staffLink }),
  );
  return steps;
}

const cashierSection = () => step(['Buka ruang kasir', 'Open the cashier workspace'], ['Pilih Kasir atau Pesanan masuk pada navigasi staf.', 'Select Cashier or Incoming orders in staff navigation.'], section('kasir'), { skipWhen: onSection('kasir') });
const noRequests: DemoTourText = ['Belum ada pesanan masuk. Kirim pesanan dari tab pelanggan atau lewati langkah ini.', 'There are no incoming orders. Submit one from the customer tab or skip this step.'];
const noWork: DemoTourText = ['Belum ada item yang bisa diproses. Pilih Stasiun saya dan filter Aktif, atau lewati langkah ini.', 'No items can be processed. Select My station and the Active filter, or skip this step.'];

function cashierTour(customerHref?: string): Steps {
  const steps: Steps = [cashierSection()];
  const customerLink = customerHref ? { href: customerHref, label: ['Buka pelanggan di tab baru', 'Open customer in a new tab'] } as const : undefined;
  if (enabled('ordering')) steps.push(
    step(['Buka pesanan masuk', 'Open incoming orders'], ['Klik Pesanan masuk untuk melihat permintaan pelanggan.', 'Select Incoming orders to see customer requests.'], choice('orders')),
    action('cashier-accept', ['Terima pesanan', 'Accept an order'], ['Periksa nama pemesan dan isi pesanan, lalu klik Terima.', 'Check the customer and their items, then select Accept.'], { result: 'cashier-accept', unavailable: noRequests, link: customerLink }),
  );
  if (enabled('cashier')) steps.push(
    action('cashier-new-order', ['Catat pesanan di kasir', 'Enter a counter order'], ['Klik Pesanan baru untuk mencoba transaksi langsung di kasir.', 'Select New order to try a walk-up transaction.']),
    action('pos-item', ['Pilih hidangan', 'Choose an item'], ['Klik salah satu hidangan yang tersedia.', 'Select an available item.']),
    action('pos-add', ['Tambahkan item', 'Add the item'], ['Klik Tambah untuk memasukkan item ke pesanan.', 'Select Add to include the item in the order.'], { result: 'pos-add', prerequisite: requiredChoice }),
    action('pos-review', ['Periksa pesanan', 'Review the order'], ['Klik Periksa pesanan dan cek total.', 'Select Review order and check the total.'], { result: 'pos-review' }),
    action('pos-submit', ['Buat tagihan', 'Create the bill'], ['Klik Buat tagihan untuk menyimpan pesanan dan membuka tagihannya.', 'Select Create bill to save the order and open its bill.'], { result: 'pos-submit' }),
    action('cashier-shift', ['Buka pengaturan shift', 'Manage the cashier shift'], ['Klik Buka shift sebelum menerima pembayaran tunai.', 'Select Open shift before accepting cash.'], { skipWhen: '[data-demo-shift-open="true"]', skipWhenForRecord: staffBillPaid }),
    action('cashier-open-shift', ['Buka shift kasir', 'Open the cashier shift'], ['Periksa modal awal, lalu klik Buka shift kasir.', 'Check the opening float, then select Open cashier shift.'], { result: 'OPEN_SHIFT', skipWhen: '[data-demo-shift-open="true"]', skipWhenForRecord: staffBillPaid }),
    step(['Kembali ke tagihan', 'Return to the bill'], ['Tutup pengaturan shift untuk melanjutkan pembayaran.', 'Close the shift settings to continue with payment.'], '[data-ui=dialog-content]:has([data-demo-shift-content]) > div > button[aria-label]', { skipWhen: '[data-demo-shift-open="true"]', skipWhenForRecord: staffBillPaid }),
    step(['Pilih tunai', 'Select cash'], ['Klik Tunai pada pilihan metode pembayaran.', 'Select Cash as the payment method.'], '.cafe-tender-method [data-choice="CASH"]', { sameRecord: true, skipWhenForRecord: staffBillPaid }),
    action('cashier-exact', ['Isi uang diterima', 'Enter cash received'], ['Klik Uang pas untuk mengisi jumlah sesuai saldo tagihan.', 'Select Exact amount to enter the balance due.'], { sameRecord: true, skipWhenForRecord: staffBillPaid }),
    action('cashier-receive-cash', ['Catat pembayaran tunai', 'Record the cash payment'], ['Klik Terima tunai untuk mencatat pembayaran pada tagihan ini.', 'Select Accept cash to record payment on this bill.'], { result: 'cashier-receive-cash', sameRecord: true, skipWhenForRecord: staffBillPaid }),
  );
  if (!enabled('cashier') && enabled('payments')) steps.push(
    action('demo-options', ['Buka opsi demo', 'Open demo options'], ['Klik Opsi demo untuk melihat instruksi pembayaran yang dibuat pelanggan.', 'Select Demo options to find payment instructions created by customers.']),
    action('demo-settle', ['Selesaikan simulasi pembayaran', 'Complete the payment simulation'], ['Klik Simulasikan lunas pada pembayaran yang ingin dicoba.', 'Select Simulate paid on the payment you want to try.'], {
      result: 'demo-settle', sameRecord: true, unavailable: ['Jika tidak ada instruksi, buat QRIS atau transfer bank sebagai pelanggan, lalu buka kembali Opsi demo.', 'If no instructions appear, create QRIS or bank transfer instructions as a customer, then reopen Demo options.'],
    }),
    action('demo-options-close', ['Kembali ke pesanan', 'Return to orders'], ['Tutup Opsi demo untuk kembali ke pesanan masuk.', 'Close Demo options to return to incoming orders.']),
  );
  if (!enabled('cashier') && !enabled('payments')) steps.push(
    action('counter-open', ['Pilih tagihan kasir', 'Choose a counter bill'], ['Klik Konfirmasi pembayaran kasir pada tagihan.', 'Select Confirm counter payment on a bill.'], { sameRecord: true, unavailable: ['Belum ada tagihan yang menunggu pembayaran kasir.', 'No bills are awaiting counter payment.'] }),
    action('counter-confirm', ['Konfirmasi penerimaan', 'Confirm payment received'], ['Isi referensi, centang konfirmasi, lalu klik Catat pembayaran kasir.', 'Enter a reference, check the confirmation box, then select Record counter payment.'],
      { result: 'counter-confirm', sameRecord: true, unavailable: ['Buka tagihan untuk mengisi konfirmasi, atau lewati jika tidak ada tagihan.', 'Open a bill to complete confirmation, or skip if no bill is available.'] }),
  );
  if (!enabled('kitchen')) steps.push(
    step(['Buka daftar pesanan', 'Open the order list'], ['Kembali ke Pesanan masuk untuk melihat pesanan yang sudah diterima.', 'Return to Incoming orders to see accepted orders.'], choice('orders'), { skipWhen: '#incoming-orders' }),
    action('cashier-serve', ['Serahkan pesanan', 'Hand over the order'], ['Klik Sudah disajikan atau Sudah diambil setelah pesanan diserahkan.', 'Select Served or Collected after handing over the order.'], {
      result: 'cashier-serve', sameRecord: true, unavailable: ['Belum ada pesanan aktif yang bisa diserahkan. Periksa konfirmasi dan pembayaran terlebih dahulu.', 'No active orders can be handed over yet. Check acceptance and payment first.'],
    }),
  );
  return steps;
}

export function staffTour(role: string, customerHref?: string): Steps {
  if (role === 'CASHIER') return cashierTour(customerHref);
  if ((role === 'KITCHEN' || role === 'BAR') && enabled('kitchen')) return [
    step(['Buka antrean persiapan', 'Open the prep queue'], ['Pilih Dapur & Bar untuk melihat tiket di stasiun Anda.', 'Select Kitchen & bar to see tickets for your station.'], section('dapur'), { skipWhen: onSection('dapur') }),
    step(['Mulai siapkan', 'Start preparing'], ['Klik Mulai siapkan pada salah satu item antrean.', 'Select Start preparing on a queued item.'], '[data-demo-next-status="PREPARING"]', { result: 'PREPARING', unavailable: noWork }),
    step(['Tandai siap', 'Mark ready'], ['Setelah item siap, klik tombol untuk menandainya siap disajikan atau diambil.', 'When the item is ready, use its button to mark it ready for serving or pickup.'], '[data-demo-next-status="READY"]', { result: 'READY', sameRecord: true, unavailable: noWork }),
    step(['Serahkan item', 'Hand over the item'], ['Klik Sudah diantar atau Sudah diambil setelah item diserahkan.', 'Select Delivered or Collected after handing over the item.'], ':is([data-demo-next-status="DELIVERED"], [data-demo-next-status="PICKED_UP"])', { result: ['DELIVERED', 'PICKED_UP'], sameRecord: true, unavailable: noWork }),
  ];
  if (role === 'WAITER' && enabled('tables')) return [
    step(['Layani meja', 'Help guests at tables'], ['Buka Meja & Antrean untuk melihat layanan meja.', 'Open Tables & waitlist to see table service.'], section('meja'), { skipWhen: onSection('meja') }),
    step(['Buka panggilan pelayan', 'Open guest requests'], ['Pilih Panggilan pelayan untuk melihat permintaan tamu.', 'Select Guest requests to see requests for help.'], choice('PANGGILAN')),
    action('waiter-acknowledge', ['Tangani permintaan', 'Handle a request'], ['Klik Tangani pada panggilan yang baru masuk.', 'Select Handle on a new guest request.'],
      { result: 'waiter-acknowledge', unavailable: ['Belum ada panggilan baru. Buat panggilan dari menu pelanggan atau lewati langkah ini.', 'No new guest requests. Call staff from the customer menu or skip this step.'] }),
    action('waiter-resolve', ['Selesaikan panggilan', 'Resolve the request'], ['Setelah membantu tamu, klik Selesai pada panggilan tersebut.', 'After helping the guest, select Done on that request.'],
      { result: 'waiter-resolve', sameRecord: true, unavailable: ['Belum ada panggilan yang sedang ditangani.', 'No guest requests are in progress.'] }),
    step(['Periksa antrean', 'Review the waitlist'], ['Pilih Antrean untuk melihat siapa yang menunggu meja.', 'Select Waitlist to see who is waiting for a table.'], choice('ANTREAN')),
    action('waiter-call', ['Panggil tamu', 'Call a guest'], ['Klik Panggil tamu untuk memanggil tamu ke meja yang dipilih.', 'Select Call guest to invite the guest to the chosen table.'], {
      result: 'waiter-call', prerequisite: { selector: '[data-demo-tour-prompt]', scope: '[data-waitlist-id]', instruction: ['Pilih salah satu meja yang tersedia.', 'Select an available table.'] }, unavailable: ['Belum ada tamu yang menunggu meja yang tersedia.', 'No waiting guest has an available table.'],
    }),
    action('waiter-seat', ['Tempatkan tamu', 'Seat the guest'], ['Setelah tamu datang, klik Tempatkan di meja pada baris yang sama.', 'When the guest arrives, select Seat at table on the same row.'], {
      result: 'waiter-seat', sameRecord: true, unavailable: ['Belum ada tamu yang siap ditempatkan.', 'No guests are ready to be seated.'],
    }),
  ];
  if (role === 'OWNER' || role === 'MANAGER') {
    const steps: DemoActionStep[] = [];
    if (enabled('dashboard') || enabled('cashier')) steps.push(step(['Buka laporan', 'Open reports'], ['Pilih Laporan untuk memeriksa penjualan dan shift kasir.', 'Select Reports to review sales and cashier shifts.'], section('laporan')));
    if (enabled('dashboard')) steps.push(step(['Tinjau penjualan mingguan', 'Review weekly sales'], ['Klik Mingguan untuk mengganti periode laporan.', 'Select Week to change the reporting period.'], choice('week')));
    if (enabled('catalog') || enabled('cashier')) steps.push(
      step(['Buka katalog dan stok', 'Open catalogue and stock'], ['Pilih Katalog & Stok untuk meninjau persediaan.', 'Select Catalogue & stock to review inventory.'], section('menu')),
      action('supervisor-stock', ['Buka batas stok harian', 'Open daily stock limits'], ['Buka Batas stok harian untuk melihat stok fisik dan porsi yang masih bisa dijual.', 'Open Daily stock limit to see physical stock and servings available to sell.'], {
        skipWhen: `details[open] > ${target('supervisor-stock')}`, unavailable: ['Belum ada stok dengan batas harian.', 'There are no daily stock limits.'],
      }),
      action('supervisor-update-stock', ['Perbarui stok', 'Update stock'], ['Klik Perbarui stok untuk menyimpan jumlah yang sudah diperiksa.', 'Select Update stock to save the count you checked.'], {
        result: 'supervisor-update-stock', prerequisite: {
          selector: 'input[data-demo-tour-prompt]', scope: '[data-stock-pool-id]',
          instruction: ['Sesuaikan jumlah dengan stok fisik, lalu pilih Jumlah sudah sesuai.', 'Check the physical count, edit the number if needed, then select Count checked.'],
          confirm: ['Jumlah sudah sesuai', 'Count checked'],
        }, unavailable: ['Belum ada stok yang bisa diperbarui.', 'There is no stock to update.'],
      }),
    );
    const settings = step(['Buka pengaturan', 'Open settings'], ['Pilih Pengaturan untuk mengecek kebijakan operasional yang aktif.', 'Select Settings to review the active operating policies.'], section('pengaturan'));
    const [first = settings, ...rest] = steps.length ? [...steps, settings] : [settings];
    return [first, ...rest];
  }
  return [step(['Lihat tugas yang tersedia', 'See available tasks'], ['Pilih salah satu bagian ruang staf yang tersedia untuk peran ini.', 'Select a staff workspace section available to this role.'], '[data-cafe-section], .staff-mobile-nav [data-choice]')];
}
