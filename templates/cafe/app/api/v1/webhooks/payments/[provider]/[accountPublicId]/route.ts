import { NextResponse } from 'next/server';
import { isModuleEnabled } from '@/src/config/cafe';

export const dynamic = 'force-dynamic';

/** No live provider is bundled. An unsigned callback must never settle a bill. */
export async function POST() {
  if (!isModuleEnabled('payments')) {
    return NextResponse.json({ error: { code: 'MODULE_DISABLED', message: 'Pembayaran online tidak aktif.', retryable: false } }, { status: 403 });
  }
  return NextResponse.json({
    error: {
      code: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      message: 'Penyedia pembayaran belum tersambung. Webhook tidak mengubah tagihan. Gunakan simulasi demo untuk pengujian.',
      retryable: false,
    },
  }, { status: 501 });
}
