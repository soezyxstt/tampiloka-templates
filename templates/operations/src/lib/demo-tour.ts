import type { DemoTourContent, DemoTourStep, DemoTourText } from '@tampiloka/ui-core/demo';
import type { Route } from './navigation';

const tasks: Record<Route['view'], [DemoTourText, DemoTourStep]> = {
  owner: [
    ['Pengelola', 'Owner'],
    [['Tinjau akses tim', 'Review team access'], ['Buka Tim & akses untuk melihat peran dan lokasi yang ditugaskan ke akun contoh.', 'Open Team & access to see the roles and locations assigned to sample accounts.'], "[data-demo-target=operations-access]", "[data-demo-target=operations-more]"],
  ],
  inventory: [
    ['Gudang', 'Inventory'],
    [['Cek stok gudang', 'Check warehouse stock'], ['Buka Persediaan untuk melihat jumlah barang, lalu buka Pengiriman untuk melihat perpindahan stok.', 'Open Inventory to check quantities, then open Shipments to review stock transfers.'], "[data-demo-target=operations-stock]"],
  ],
  receiver: [
    ['Penerima', 'Receiver'],
    [['Cek barang masuk', 'Check incoming goods'], ['Buka Penerimaan untuk meninjau pengiriman yang masuk dan jumlah barangnya.', 'Open Receiving to review incoming shipments and item quantities.'], "[data-demo-target=operations-receiving]"],
  ],
  cashier: [
    ['Kasir', 'Cashier'],
    [['Coba transaksi kasir', 'Try a sale'], ['Buka Kasir dan pilih barang untuk membuat transaksi contoh.', 'Open Cashier and select items to create a sample sale.'], "[data-demo-target=operations-cashier]"],
  ],
  pricing: [
    ['Harga', 'Pricing'],
    [['Tinjau harga jual', 'Review selling prices'], ['Buka Harga & promosi untuk melihat harga yang berlaku dan mencoba mengatur harga contoh.', 'Open Prices & promotions to review current prices and try setting a sample price.'], "[data-demo-target=operations-pricing]"],
  ],
  auditor: [
    ['Pemeriksa', 'Auditor'],
    [['Telusuri transaksi', 'Trace a transaction'], ['Buka Jejak audit, lalu cari dokumen untuk melihat catatan dan mutasi stok terkait.', 'Open Audit trail, then find a document to see its records and related stock movements.'], "[data-demo-target=operations-audit]", "[data-demo-target=operations-more]"],
  ],
  mixed: [
    ['Peran ganda', 'Mixed permissions'],
    [['Coba dua tugas', 'Try both assignments'], ['Gunakan Kasir di lokasi yang ditugaskan untuk penjualan dan Harga & promosi di lokasi yang ditugaskan untuk harga.', 'Use Cashier at the location assigned for sales and Prices & promotions at the location assigned for pricing.'], "[data-demo-target=operations-cashier]", "[data-demo-target=operations-pricing]"],
  ],
};

export function operationsTour(route: Route): DemoTourContent {
  const [role, task] = tasks[route.view];
  return {
    id: `${route.view}:${route.mode}`,
    language: route.lang,
    role,
    steps: [
      [['Pilih lokasi', 'Choose a location'], ['Pilih lokasi kerja yang tersedia, lalu cek Ringkasan sebelum mulai.', 'Choose an available work location, then check Overview before getting started.'], ".op-sidebar .op-field button"],
      task,
    ],
  };
}
