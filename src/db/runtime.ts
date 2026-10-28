import { CapabilityError } from '../domain/capabilities.ts';

/** Fail closed: demo PINs and synthetic settlements must never reach a real SQL database. */
export function assertDemoRuntime(): void {
  if (process.env.CAFE_DEMO_DB !== '1') {
    throw new CapabilityError(
      'LIVE_ADAPTER_REQUIRED',
      'Jalankan npm run demo untuk demo lokal. Layanan nyata memerlukan autentikasi staf, sesi pelanggan, dan penyedia pembayaran yang terverifikasi.',
      503,
    );
  }
}

export function assertValidOutlet(slug: string, configuredSlug: string): void {
  if (slug !== configuredSlug) throw new CapabilityError('OUTLET_NOT_FOUND', 'Outlet tidak ditemukan.', 404);
}
